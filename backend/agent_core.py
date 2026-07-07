"""
agent_core.py
--------------
Handles calling an LLM agent (Fireworks AI or Featherless AI) and executing
whatever Python analysis code the agent writes, in a controlled namespace.

Priority order: FIREWORKS_API_KEY -> FEATHERLESS_API_KEY -> offline.

Status is checked by actually testing connectivity once per process (cached),
never by just seeing if a key/URL string is configured - so the reported
status is always true, never a false "LIVE" label.

SECURITY: never hardcode real API keys in this file. Put them in a `.env` file
in this folder (already gitignored - see backend/.env, listed in .gitignore)
so python-dotenv loads them automatically without ever exposing them in the
public GitHub repo. Only .env.example (with blank values) should be committed.
"""

import os
import traceback

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed - env vars can still be set manually

FIREWORKS_API_KEY = os.environ.get("FIREWORKS_API_KEY", "")
FIREWORKS_MODEL = os.environ.get("FIREWORKS_MODEL", "accounts/fireworks/models/llama-v3p1-70b-instruct")
FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions"

# Featherless AI - used for testing now, plan is to switch FEATHERLESS_MODEL to a
# Gemma model ID the day before submission.
FEATHERLESS_API_KEY = os.environ.get("FEATHERLESS_API_KEY", "")
FEATHERLESS_MODEL = os.environ.get("FEATHERLESS_MODEL", "Qwen/Qwen2.5-7B-Instruct")
FEATHERLESS_URL = "https://api.featherless.ai/v1/chat/completions"

# Cache so we only test connectivity once per process, not once per specialist.
_STATUS_CACHE = {"checked": False, "provider": None}


def call_fireworks(system_prompt: str, user_prompt: str) -> str:
    import requests
    if not FIREWORKS_API_KEY:
        raise RuntimeError("FIREWORKS_API_KEY not set.")
    resp = requests.post(
        FIREWORKS_URL,
        headers={"Authorization": f"Bearer {FIREWORKS_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": FIREWORKS_MODEL,
            "max_tokens": 800,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def call_featherless(system_prompt: str, user_prompt: str) -> str:
    import requests
    if not FEATHERLESS_API_KEY:
        raise RuntimeError("FEATHERLESS_API_KEY not set.")
    resp = requests.post(
        FEATHERLESS_URL,
        headers={"Authorization": f"Bearer {FEATHERLESS_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": FEATHERLESS_MODEL,
            "max_tokens": 800,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


_PROVIDERS = [
    ("fireworks", call_fireworks),
    ("featherless", call_featherless),
]


def get_llm_status() -> str | None:
    """
    Tests each configured backend ONCE per process (cached after that) with a
    trivial ping call, and returns the name of the first one that actually
    works, or None if every backend is offline/unreachable.
    """
    if _STATUS_CACHE["checked"]:
        return _STATUS_CACHE["provider"]

    for name, fn in _PROVIDERS:
        try:
            fn("You are a test.", "Reply with the single word: ok")
            _STATUS_CACHE["provider"] = name
            break
        except Exception:
            continue
    else:
        _STATUS_CACHE["provider"] = None

    _STATUS_CACHE["checked"] = True
    return _STATUS_CACHE["provider"]


def has_llm() -> bool:
    """Honest check: is a backend actually reachable right now, not just configured."""
    return get_llm_status() is not None


def call_llm(system_prompt: str, user_prompt: str) -> str:
    """
    Calls whichever backend get_llm_status() found working. Raises a clear
    RuntimeError if none are reachable - callers should catch this and report
    'LLM OFFLINE' honestly rather than silently using a different code path.
    """
    provider = get_llm_status()
    if provider is None:
        raise RuntimeError("LLM_OFFLINE: no configured backend (Fireworks/Featherless) is reachable.")

    fn = dict(_PROVIDERS)[provider]
    return fn(system_prompt, user_prompt)


def extract_code_block(text: str) -> str:
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
        }
    result = namespace.get("result")
    if not isinstance(result, dict):
        return {"risk_score": 0.0, "flag": False, "reasoning": "[ERROR] agent code did not set `result` dict"}
    return result