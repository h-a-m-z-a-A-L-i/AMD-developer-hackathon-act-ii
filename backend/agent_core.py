"""
agent_core.py
--------------
Handles calling an LLM agent (Fireworks AI, or a local Ollama instance shared via ngrok)
and executing whatever Python analysis code the agent writes, in a controlled namespace.

Priority order: FIREWORKS_API_KEY (if set) -> OLLAMA_BASE_URL (if set) -> rule-based fallback.
This means teammates can each set whichever env var applies to them and it just works,
without touching any code.
"""

import os
import json
import traceback

FIREWORKS_API_KEY = os.environ.get("FIREWORKS_API_KEY", "")
FIREWORKS_MODEL = os.environ.get("FIREWORKS_MODEL", "accounts/fireworks/models/llama-v3p1-70b-instruct")
FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions"

# Local Ollama, shared via ngrok tunnel (or localhost if running your own).
# Default here is the team's shared ngrok URL - override with OLLAMA_BASE_URL env var if needed.
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "https://backshift-luckily-unsaddle.ngrok-free.dev")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1")


def has_llm():
    return bool(FIREWORKS_API_KEY) or bool(OLLAMA_BASE_URL)


def call_fireworks(system_prompt: str, user_prompt: str) -> str:
    """Calls Fireworks AI chat completions endpoint. Returns raw text response."""
    import requests

    if not FIREWORKS_API_KEY:
        raise RuntimeError("FIREWORKS_API_KEY not set - cannot call Fireworks.")

    resp = requests.post(
        FIREWORKS_URL,
        headers={
            "Authorization": f"Bearer {FIREWORKS_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": FIREWORKS_MODEL,
            "max_tokens": 800,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def call_ollama(system_prompt: str, user_prompt: str) -> str:
    """Calls a local (or ngrok-tunneled) Ollama instance using its OpenAI-compatible endpoint."""
    import requests

    if not OLLAMA_BASE_URL:
        raise RuntimeError("OLLAMA_BASE_URL not set - cannot call Ollama.")

    resp = requests.post(
        f"{OLLAMA_BASE_URL.rstrip('/')}/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",  # bypasses ngrok's free-tier warning interstitial
        },
        json={
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=120,  # local models can be slower than a hosted API
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def call_llm(system_prompt: str, user_prompt: str) -> str:
    """Tries Fireworks first (if key set), then falls back to Ollama."""
    if FIREWORKS_API_KEY:
        try:
            return call_fireworks(system_prompt, user_prompt)
        except Exception:
            pass  # fall through to Ollama
    if OLLAMA_BASE_URL:
        return call_ollama(system_prompt, user_prompt)
    raise RuntimeError("No LLM backend available (neither FIREWORKS_API_KEY nor OLLAMA_BASE_URL usable).")


def extract_code_block(text: str) -> str:
    """Pulls python code out of a ```python ... ``` fenced block, or returns text as-is."""
    if "```python" in text:
        return text.split("```python", 1)[1].split("```", 1)[0].strip()
    if "```" in text:
        return text.split("```", 1)[1].split("```", 1)[0].strip()
    return text.strip()


def run_agent_code(code: str, patient_row: dict) -> dict:
    """
    Executes agent-generated (or fallback template) code in a restricted namespace.
    The code MUST set a variable called `result` = {"risk_score": float 0-1,
    "flag": bool, "reasoning": str}.
    """
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
