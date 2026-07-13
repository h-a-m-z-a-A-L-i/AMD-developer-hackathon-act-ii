"""
agent_core.py
--------------
Handles calling an LLM agent and executing Python analysis code the agent writes.

Two providers only:
  1. amd_notebook_gemma4       - Gemma 4 26B, GENUINE on-GPU inference via Ollama
                                  on an AMD MI300X (ROCm). Main provider. Points at
                                  our own AMD Cloud GPU droplet.
  2. fireworks_serverless_fast - Fireworks GLM 5.2 (DIRECT, pay-per-token, serverless).
                                  Fallback provider.
Provider connectivity is verified with cached checks.
"""

import os
import threading
import time
import traceback

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed - env vars can still be set manually

# Fireworks AI - pulled from the FIREWORKS_API_KEY environment variable (set
# it in backend/.env, which is gitignored - see backend/.env.example for the
# expected keys).
FIREWORKS_API_KEY = os.environ.get("FIREWORKS_API_KEY", "")
FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions"

# --- Fallback provider: Fireworks serverless, GLM 5.2 (DIRECT, pay-per-token) ---
# Highest Intelligence Index on Fireworks (51) and leads coding benchmarks
# (SWE-bench Verified 77.8%), which matters directly here since every
# specialist call is generating executable Python with fairly strict
# formatting/numeric-reasoning constraints (see STRICT_CODE_FORMAT_INSTRUCTIONS
# in specialists.py) - a stronger model means fewer malformed-code retries.
FIREWORKS_FAST_SERVERLESS_MODEL = os.environ.get(
    "FIREWORKS_FAST_SERVERLESS_MODEL", "accounts/fireworks/models/glm-5p2"
)

# --- Main provider: genuine on-GPU AMD compute (ROCm + Ollama, Gemma 4 26B MoE) ---
# Actually loads and runs Gemma 4 26B locally on an AMD MI300X (ROCm) via
# Ollama's OpenAI-compatible /v1/chat/completions endpoint - real on-GPU
# inference, no Fireworks call involved at all. AMD_OLLAMA_URL points at
# our own AMD Cloud GPU droplet (MI300X). Point AMD_OLLAMA_URL at a
# tunnel/firewalled address only - Ollama has no built-in auth, so port
# 11434 must never be exposed directly to the public internet.
AMD_OLLAMA_URL = os.environ.get("AMD_OLLAMA_URL", "")
AMD_OLLAMA_MODEL = os.environ.get("AMD_OLLAMA_MODEL", "gemma4:26b")

# Cache connectivity checks so we don't ping the provider on every single
# specialist call. A success is cached for a long time (a working provider
# rarely needs re-verifying); a failure is cached only briefly, since a
# transient blip on the very first ping shouldn't lock the whole server
# process into "offline" for its entire lifetime.
_STATUS_CACHE = {"checked_at": 0.0, "provider": None}
_SUCCESS_TTL_SECONDS = 300   # re-verify a healthy provider every 5 minutes
_FAILURE_TTL_SECONDS = 15    # retry quickly after a failure instead of forever

# Guards _STATUS_CACHE. The 4 specialist nodes run in real parallel threads
# (LangGraph fans them out from START), and STAGGER_DELAY_SECONDS in
# specialists.py only staggers each specialist's OWN dial-out - it doesn't
# stop two specialists from both observing a cold/expired cache at once and
# each independently re-running the full connectivity-check chain
# concurrently (one provider's raise-if-unconfigured check -> the other's
# real network round-trip). Without a
# lock, the specialist with the shortest stagger delay (renal, at 0.0s) is
# the one most likely to be the sole thread that pays this cold-check cost
# undefended, right before its own real scoring call - and if that scoring
# call then lands in the exact window where the other 3 specialists wake up
# from their staggers and fire, it has no backoff of its own. The lock
# doesn't remove that latency, but it stops multiple threads from paying it
# redundantly/concurrently and stepping on each other's cache writes.
_STATUS_LOCK = threading.Lock()

# Tracks which literal model/route served the most recent AMD on-GPU call,
# so the Benchmark tab / console output can show specifically which route
# served the last request rather than just a provider name.
_AMD_ROUTE = {"route": None}

# Manual provider override (set via POST /api/providers/select from the
# frontend's provider switcher, or set_forced_provider() directly). When
# None, get_llm_status()/call_llm() use the normal auto-failover chain
# (_PROVIDERS). When set to one of PROVIDER_IDS, only that provider is tried -
# no silent failover to a different one - so switching to e.g. "fireworks" in
# the UI actually guarantees Fireworks is what runs, not just "tried first".
_FORCED_PROVIDER = {"value": None}

# Provider IDs in display order.
#   1. amd_notebook_gemma4       - GENUINE on-GPU inference: Gemma 4 26B via
#                                  Ollama on an AMD MI300X. Main provider.
#   2. fireworks_serverless_fast - Fireworks GLM 5.2 (DIRECT, serverless).
#                                  Fallback if AMD isn't reachable.
PROVIDER_IDS = [
    "amd_notebook_gemma4",
    "fireworks_serverless_fast",
]

# Counts actual call_llm() invocations (including retries), so the Benchmark tab
# can show a real number. Reset at the start of each /api/analyze request.
_LLM_CALL_COUNTER = {"count": 0}


def reset_llm_call_counter() -> None:
    _LLM_CALL_COUNTER["count"] = 0


def get_llm_call_count() -> int:
    return _LLM_CALL_COUNTER["count"]


# Sampling temperature for the risk-scoring calls. This is a model-sampling
# knob, not a clinical value - it doesn't hardcode any score/cutoff, it just
# controls how deterministic vs. random the model is when generating its
# scoring code. Left at the provider default (unset) this was landing close
# to 1.0 on both providers, which is tuned for creative writing variety, not
# for a task where the SAME patient labs should reason to close to the SAME
# score every run. Low-but-not-zero keeps the model from being fully greedy
# (still lets it explore reasonable cutoff choices) while cutting a lot of
# run-to-run noise in the computed risk_score/flag.
SCORING_TEMPERATURE = 0.2

# Max tokens for a specialist/synthesis call. Bumped up from 1000 - GLM 5.2 is
# a reasoning model, and Fireworks' own docs note that for some models the
# reasoning trace lands directly in `content` (no separate `reasoning_content`
# field) rather than being split out - see docs.fireworks.ai/guides/reasoning.
# At 1000 tokens, GLM 5.2 was spending its entire budget on an inline
# "let me think about this..." preamble and never reaching the actual code
# fence, so `extract_code_block()` had nothing to extract but plain English -
# which chokes Python's parser (that's the "unterminated string literal"
# errors: a sentence like "the patient's data" reads as an unterminated
# string to the tokenizer). Applies to EVERY provider/model here (Gemma 4
# included, not just GLM) - non-reasoning models don't need the extra room
# for a thinking trace, but a generous ceiling costs nothing if the model
# doesn't use it (this only caps the max the model COULD generate, it
# doesn't pad every response out to this length) and means one code-format
# retry on a verbose response doesn't run out of room a second time either.
SCORING_MAX_TOKENS = 2500

# AMD/Gemma-specific override: this Gemma 4 26B build produces a visible,
# unprompted internal reasoning preamble on EVERY call (e.g. "Thinking...
# Option 1: 'Ok'... done thinking.") before it gets to the actual answer -
# unlike GLM, this can't be shortened via `reasoning_effort` (Ollama's Gemma
# doesn't accept that param at all, so _is_reasoning_model() below
# deliberately excludes it). That preamble was eating enough of the shared
# SCORING_MAX_TOKENS budget that the actual Python code got cut off mid-line
# for the more complex specialist prompts (confirmed: a real run failed with
# `SyntaxError: '(' was never closed`, i.e. the code stopped generating
# before the expression it was writing was even finished - not a formatting
# mistake, a truncation). Running on our own GPU with no per-token billing,
# so a generous ceiling here costs nothing if unused.
AMD_MAX_TOKENS = 6000

# Explicit context window for the AMD Ollama call. Without this, Ollama
# loads the model at its FULL native context (confirmed via `ollama ps` on
# the droplet: CONTEXT showed 262144) - and since Ollama reserves a KV-cache
# slot sized to num_ctx for EVERY parallel request slot, a 262144-token
# reservation per slot is almost certainly why Ollama was auto-selecting
# OLLAMA_NUM_PARALLEL=1 despite ~192GB of spare VRAM: 4 slots at that size
# doesn't comfortably fit even here, so it falls back to running requests
# one at a time - meaning our 4 "parallel" specialist calls (LangGraph fans
# them out from START) were actually queueing at the model server, not
# running concurrently. A specialist prompt (system prompt + patient dict +
# one retry round) is realistically under ~3000 tokens in, a few hundred
# out - 8192 leaves generous headroom while shrinking the per-slot
# reservation by ~32x, which should let Ollama actually run requests in
# parallel instead of queuing them.
AMD_NUM_CTX = 8192

# Passed as `reasoning_effort` on calls to models Fireworks marks as
# reasoning-capable (currently: anything with "glm" in its model string - see
# _is_reasoning_model below). "low" keeps the model's internal reasoning
# trace short so it reaches the required code block well within
# SCORING_MAX_TOKENS, instead of burning the whole budget thinking out loud.
# Non-reasoning models (e.g. Gemma 4) don't accept this param, so it's only
# ever attached when _is_reasoning_model(model) is True.
REASONING_EFFORT = "low"


def _is_reasoning_model(model_string: str) -> bool:
    """True for model strings Fireworks marks as reasoning-capable (GLM 5.x
    at the time of writing - see docs.fireworks.ai/guides/reasoning). Used to
    decide whether to attach `reasoning_effort` to a request: sending that
    param to a non-reasoning model can be rejected/ignored depending on the
    model, so it's only attached where it's actually meaningful.
    """
    return "glm" in model_string.lower()


def _chat_json_body(model: str, system_prompt: str, user_prompt: str) -> dict:
    """Builds the standard chat-completions request body shared by both
    call_* functions below, so the reasoning-effort/max-tokens fix can't
    silently drift out of sync between the Fireworks and AMD tiers.
    """
    body = {
        "model": model,
        "max_tokens": SCORING_MAX_TOKENS,
        "temperature": SCORING_TEMPERATURE,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    if _is_reasoning_model(model):
        body["reasoning_effort"] = REASONING_EFFORT
    return body


def _post_with_retry(url: str, headers: dict, json_body: dict, timeout: int = 60) -> "requests.Response":
    """POST with retry for transient network/provider issues such as 429s.

    This decreases the chance that one parallel specialist call fails due to
    a rate-limit spike while the others succeed.
    """
    import requests
    last_exc: Exception | None = None
    for attempt in range(4):
        try:
            resp = requests.post(url, headers=headers, json=json_body, timeout=timeout)
        except requests.exceptions.RequestException as e:
            last_exc = e
            time.sleep(0.6 * (attempt + 1))
            continue
        if resp.status_code == 429:
            last_exc = RuntimeError(f"Rate limited (429) by provider (attempt {attempt + 1}/4)")
            # Free/test-tier rate limits are commonly per-minute, not
            # per-second, so a sub-second retry just hits the same wall
            # again - back off further each attempt (up to ~6s on the last
            # try) to actually clear the window instead of retrying inside it.
            time.sleep(1.5 * (attempt + 1))
            continue
        resp.raise_for_status()
        return resp
    raise last_exc if last_exc else RuntimeError("Request failed after retries.")


def call_fireworks_serverless_fast(system_prompt: str, user_prompt: str) -> str:
    """Fallback provider: Fireworks serverless, GLM 5.2 (DIRECT, pay-per-token,
    no GPU-hour billing)."""
    if not FIREWORKS_API_KEY:
        raise RuntimeError("FIREWORKS_API_KEY not set.")
    resp = _post_with_retry(
        FIREWORKS_URL,
        headers={"Authorization": f"Bearer {FIREWORKS_API_KEY}", "Content-Type": "application/json"},
        json_body=_chat_json_body(FIREWORKS_FAST_SERVERLESS_MODEL, system_prompt, user_prompt),
        timeout=60,
    )
    return resp.json()["choices"][0]["message"]["content"]


def call_amd_notebook_gemma4(system_prompt: str, user_prompt: str) -> str:
    """Main provider: GENUINE on-GPU AMD compute - Gemma 4 26B (MoE) running
    locally via Ollama on an AMD MI300X (ROCm).

    Hits Ollama's NATIVE /api/chat endpoint, NOT the OpenAI-compatible
    /v1/chat/completions one. Reason: Gemma 4 has a confirmed Ollama bug on
    the OpenAI-compat endpoint (ollama/ollama#15288) where the "think"/
    "reasoning_effort" controls aren't honored - generated text lands in a
    separate "reasoning" field instead of "content", and there's no way to
    turn off Gemma's always-on reasoning preamble through that path. The
    native endpoint honors `"think": false` correctly for this model, which
    is what actually kills the preamble that was eating the AMD_MAX_TOKENS
    budget and truncating generated code. `AMD_OLLAMA_URL` is configured as
    the /v1/chat/completions URL in .env - the native path is derived from
    it below so no .env change is needed.
    """
    if not AMD_OLLAMA_URL:
        raise RuntimeError(
            "AMD_OLLAMA_URL not set - launch the AMD Cloud GPU droplet, "
            "`ollama pull gemma4:26b` there, and set "
            "AMD_OLLAMA_URL in backend/.env to its "
            "http://<tunnel-or-ip>:11434/v1/chat/completions URL."
        )
    native_url = AMD_OLLAMA_URL
    if native_url.endswith("/v1/chat/completions"):
        native_url = native_url[: -len("/v1/chat/completions")] + "/api/chat"
    resp = _post_with_retry(
        native_url,
        headers={"Content-Type": "application/json"},
        json_body={
            "model": AMD_OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            # The actual fix: native /api/chat honors this for Gemma 4,
            # unlike /v1/chat/completions (ollama/ollama#15288). Disables
            # the always-on reasoning preamble entirely.
            "think": False,
            "stream": False,
            # Unquoted int, not the string "-1" - the native /api/chat schema
            # parses this as a Go time.Duration when it's a string (rejecting
            # "-1" with "time: missing unit in duration" - confirmed via a
            # live curl against the droplet), but accepts a bare integer
            # meaning "never unload" directly. The OpenAI-compat endpoint we
            # used to call was more lenient about this; the native one isn't.
            "keep_alive": -1,
            # Native endpoint takes generation params under "options", not
            # top-level "temperature"/"max_tokens" like the OpenAI-compat one.
            "options": {
                "temperature": SCORING_TEMPERATURE,
                "num_predict": AMD_MAX_TOKENS,
                "num_ctx": AMD_NUM_CTX,
            },
        },
        # Real on-GPU generation (not a thin relay) - give it more room than
        # the Fireworks DIRECT tier.
        timeout=180,
    )
    _AMD_ROUTE["route"] = f"amd_ollama_on_gpu::{AMD_OLLAMA_MODEL}"
    # Native /api/chat response shape differs from OpenAI's
    # choices[0].message.content - it's message.content directly.
    return resp.json()["message"]["content"]


# Auto-failover chain, tried in order: genuine on-GPU AMD compute via Ollama
# running Gemma 4 26B (main) -> Fireworks GLM 5.2 (fallback, DIRECT). The AMD
# provider requires AMD_OLLAMA_URL to point at a live Ollama instance serving
# gemma4:26b on our own AMD Cloud GPU droplet.
_PROVIDERS = [
    ("amd_notebook_gemma4", call_amd_notebook_gemma4),
    ("fireworks_serverless_fast", call_fireworks_serverless_fast),
]

# Every selectable provider's actual call function - used by call_llm() when
# a manual override is active, and by get_llm_status() when testing a single
# forced provider instead of the auto chain.
_ALL_PROVIDER_FNS = dict(_PROVIDERS)


def set_forced_provider(provider: str | None) -> None:
    """Manually pin call_llm()/get_llm_status() to a single provider (one of
    PROVIDER_IDS), or pass None to go back to the normal auto-failover chain.
    Invalidates the cached status immediately so the next call/status check
    actually re-tests under the new selection instead of serving a stale
    result from before the switch.
    """
    if provider is not None and provider not in PROVIDER_IDS:
        raise ValueError(f"Unknown provider '{provider}'. Must be one of {PROVIDER_IDS} or None.")
    _FORCED_PROVIDER["value"] = provider
    _STATUS_CACHE["checked_at"] = 0.0
    _STATUS_CACHE["provider"] = None


def get_forced_provider() -> str | None:
    return _FORCED_PROVIDER["value"]


def get_llm_status() -> str | None:
    """Returns the first reachable provider, caching results briefly.

    If a provider is forced, only it is tested.
    """
    forced = _FORCED_PROVIDER["value"]
    now = time.monotonic()
    ttl = _SUCCESS_TTL_SECONDS if _STATUS_CACHE["provider"] else _FAILURE_TTL_SECONDS
    if now - _STATUS_CACHE["checked_at"] < ttl:
        return _STATUS_CACHE["provider"]

    # Cold/expired cache: only ONE thread should actually run the
    # connectivity-check chain. Without this lock, every specialist thread
    # that observes the same stale cache (a near-guarantee right after
    # server start, since all 4 start within the same ~1.2s stagger window)
    # independently re-runs the full provider-chain check concurrently,
    # multiplying real network calls right before each specialist's actual
    # scoring call. Blocking on the lock (instead of skipping) is
    # intentional: a thread that loses the race should wait for and reuse
    # the winner's fresh result, not silently skip past a status check it
    # still needs.
    with _STATUS_LOCK:
        # Re-check inside the lock: another thread may have just refreshed
        # the cache while this thread was waiting to acquire it.
        now = time.monotonic()
        ttl = _SUCCESS_TTL_SECONDS if _STATUS_CACHE["provider"] else _FAILURE_TTL_SECONDS
        if now - _STATUS_CACHE["checked_at"] < ttl:
            return _STATUS_CACHE["provider"]

        candidates = [(forced, _ALL_PROVIDER_FNS[forced])] if forced else _PROVIDERS
        for name, fn in candidates:
            try:
                fn("You are a test.", "Reply with the single word: ok")
                _STATUS_CACHE["provider"] = name
                break
            except Exception as e:
                # Log the real reason each provider failed (rather than a
                # silent `except Exception: continue`) so connectivity
                # issues can actually be diagnosed instead of guessed at.
                print(f"[PROVIDER CHECK FAILED] {name}: {type(e).__name__}: {e}")
                continue
        else:
            _STATUS_CACHE["provider"] = None

        _STATUS_CACHE["checked_at"] = now
        return _STATUS_CACHE["provider"]


def has_llm() -> bool:
    """Honest check: is a backend actually reachable right now, not just configured."""
    return get_llm_status() is not None


def get_provider_detail() -> str | None:
    """Returns a human-readable provider status string, including the active route."""
    provider = get_llm_status()
    if provider is None:
        return None
    if provider == "amd_notebook_gemma4":
        return f"{AMD_OLLAMA_MODEL} (genuine on-GPU inference, AMD MI300X via Ollama)"
    return provider


def call_llm(system_prompt: str, user_prompt: str) -> str:
    """
    Calls the currently available provider, or raises if none are reachable.
    """
    provider = get_llm_status()
    if provider is None:
        raise RuntimeError("LLM_OFFLINE: no configured backend (Fireworks/AMD droplet) is reachable.")

    fn = _ALL_PROVIDER_FNS[provider]
    _LLM_CALL_COUNTER["count"] += 1
    return fn(system_prompt, user_prompt)


def extract_code_block(text: str) -> str:
    # Defensive strip for reasoning models: Fireworks' docs note that some
    # reasoning models put their thinking trace directly in `content` inside
    # <think>...</think> tags rather than the separate `reasoning_content`
    # field. If that happens despite REASONING_EFFORT above, drop it before
    # looking for the code fence rather than trying to exec the reasoning
    # text itself.
    if "<think>" in text and "</think>" in text:
        text = text.split("</think>", 1)[1]
    if "```python" in text:
        return text.split("```python", 1)[1].split("```", 1)[0].strip()
    if "```" in text:
        return text.split("```", 1)[1].split("```", 1)[0].strip()
    return text.strip()


def run_agent_code(code: str, patient_row: dict) -> dict:
    namespace = {"patient": patient_row, "result": None}
    try:
        exec(code, {"__builtins__": __builtins__}, namespace)
    except Exception as e:
        return {
            "risk_score": 0.0,
            "flag": False,
            "reasoning": f"[EXECUTION ERROR] {e}\n{traceback.format_exc(limit=2)}",
            "steps": [],
        }
    result = namespace.get("result")
    if not isinstance(result, dict):
        return {"risk_score": 0.0, "flag": False, "reasoning": "[ERROR] agent code did not set `result` dict", "steps": []}
    # Allow (but don't require) executed code to set a "steps" key in `result`.
    # Fallback code doesn't set it, so it defaults to an empty list here and gets
    # overridden by specialists.py with generated steps.
    result.setdefault("steps", [])

    # Defensive clamp on whatever the executed code (LLM-written or fallback)
    # actually computed for risk_score. This is NOT a hardcoded/fake output -
    # it's a post-execution guard on the AI's own numeric result, since
    # LLM-generated scoring code has no guarantee it stays inside the promised
    # 0-1 range (the fallback templates already self-clamp via min(x, 1.0), but
    # arbitrary LLM code doesn't). The real number the AI computed is preserved
    # unless it's out of contract, in which case it's bounded, never replaced.
    try:
        raw_score = float(result.get("risk_score", 0.0))
    except (TypeError, ValueError):
        raw_score = 0.0
    result["risk_score"] = max(0.0, min(1.0, raw_score))

    return result
