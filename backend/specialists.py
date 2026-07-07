"""
specialists.py
----------------
Defines the 4 specialist agents: renal, neuropathy, retinal, cardiovascular.

Each specialist has:
  - a system_prompt (its "clinical lens")
  - a build_user_prompt(patient) function describing the task to the LLM
  - a fallback_code(patient) template used when no Fireworks API key is set,
    so the pipeline is fully runnable/demoable without needing the API.

When FIREWORKS_API_KEY is set, the real LLM writes its own analysis code,
which then gets executed the same way the fallback code would be.
"""

from agent_core import has_llm, call_llm, extract_code_block, run_agent_code


# Appended to every specialist's system prompt. Small/fast models (like 7B-class
# ones used for cheap testing) are prone to mixing plain English into code blocks,
# which causes SyntaxErrors when executed. This block exists specifically to stop
# that failure mode with blunt, repeated, unambiguous formatting instructions.
STRICT_CODE_FORMAT_INSTRUCTIONS = """

CRITICAL OUTPUT FORMAT RULES - follow these exactly:
1. Respond with ONE python code block, wrapped in ```python and ```, and NOTHING else.
2. Do NOT include any explanation, commentary, or natural-language sentences before,
   after, or INSIDE the code block. Every line inside the code block must be valid,
   executable Python - no exceptions, no "notes to self", no half-written sentences.
3. Do NOT point out typos or issues in the prompt. Do NOT comment on the patient data.
   Just write the analysis code.
4. Every line must be syntactically valid Python. If you are not fully sure a line is
   valid Python, do not include it - write simpler code instead.
5. The code MUST end by assigning a dict to a variable named exactly `result` with
   these exact keys: "risk_score" (float 0-1), "flag" (bool), "reasoning" (str).
6. Do not import any modules. Do not read files or access the network. Only use the
   `patient` dict that is already available to you.

Example of the ONLY acceptable response format:
```python
egfr = patient["egfr"]
risk_score = 0.8 if egfr < 84.8 else 0.1
result = {"risk_score": risk_score, "flag": risk_score >= 0.4, "reasoning": "eGFR is low"}
```
"""


# ---------------------------------------------------------------------------
# RENAL SPECIALIST
# ---------------------------------------------------------------------------
RENAL_SYSTEM_PROMPT = """You are a renal (kidney) specialist agent analyzing diabetic patient
lab data to catch early kidney stress BEFORE standard diagnostic thresholds are hit.
Key early-warning cutoffs you know: eGFR below ~84.8 mL/min/1.73m^2 (well above the
standard 60 'disease' cutoff) and UACR above ~15.5 mg/g (below the classic 30 'abnormal'
threshold) both indicate early risk. Write Python code that reads the `patient` dict and
sets a `result` dict: {"risk_score": float 0-1, "flag": bool, "reasoning": str}.""" + STRICT_CODE_FORMAT_INSTRUCTIONS

def renal_fallback_code(patient):
    return f"""
egfr = {patient['egfr']}
uacr = {patient['uacr_mg_g']}
creatinine = {patient['creatinine_mg_dl']}

risk_score = 0.0
reasons = []
if egfr < 84.8:
    risk_score += 0.5
    reasons.append(f"eGFR {{egfr}} is below the early-risk cutoff of 84.8")
if uacr > 15.5:
    risk_score += 0.4
    reasons.append(f"UACR {{uacr}} mg/g is above the early-risk cutoff of 15.5")
if creatinine > 1.1:
    risk_score += 0.1
    reasons.append(f"Creatinine {{creatinine}} mg/dL is at the upper edge of normal")

risk_score = min(risk_score, 1.0)
result = {{
    "risk_score": risk_score,
    "flag": risk_score >= 0.4,
    "reasoning": "; ".join(reasons) if reasons else "No early renal risk markers detected.",
}}
"""


# ---------------------------------------------------------------------------
# NEUROPATHY SPECIALIST
# ---------------------------------------------------------------------------
NEUROPATHY_SYSTEM_PROMPT = """You are a diabetic neuropathy risk specialist agent. You know that
longer diabetes duration and higher A1c are the strongest available predictors of nerve damage
risk in single-visit survey data (true day-to-day glucose variability isn't available here).
Write Python code that reads the `patient` dict and sets a `result` dict:
{"risk_score": float 0-1, "flag": bool, "reasoning": str}.""" + STRICT_CODE_FORMAT_INSTRUCTIONS

def neuropathy_fallback_code(patient):
    return f"""
years = {patient['years_with_diabetes']}
a1c = {patient['a1c_percent']}

risk_score = 0.0
reasons = []
if years > 10:
    risk_score += 0.5
    reasons.append(f"{{years:.0f}} years with diabetes increases cumulative nerve damage risk")
if a1c > 6.8:
    risk_score += 0.3
    reasons.append(f"A1c {{a1c}}% is at the higher end of the 'controlled' range")
if years > 15 and a1c > 6.8:
    risk_score += 0.2
    reasons.append("Long duration combined with A1c elevation is a compounding risk factor")

risk_score = min(risk_score, 1.0)
result = {{
    "risk_score": risk_score,
    "flag": risk_score >= 0.4,
    "reasoning": "; ".join(reasons) if reasons else "No early neuropathy risk markers detected.",
}}
"""


# ---------------------------------------------------------------------------
# RETINAL SPECIALIST
# ---------------------------------------------------------------------------
RETINAL_SYSTEM_PROMPT = """You are a diabetic retinopathy risk specialist agent. You know that
elevated blood pressure combined with longer diabetes duration is a strong predictor of retinal
damage risk, independent of glucose control. Write Python code that reads the `patient` dict
and sets a `result` dict: {"risk_score": float 0-1, "flag": bool, "reasoning": str}.""" + STRICT_CODE_FORMAT_INSTRUCTIONS

def retinal_fallback_code(patient):
    return f"""
bp = {patient['systolic_bp']}
years = {patient['years_with_diabetes']}

risk_score = 0.0
reasons = []
if bp > 130:
    risk_score += 0.5
    reasons.append(f"Systolic BP of {{bp:.0f}} is elevated, a known retinopathy risk factor")
if years > 10:
    risk_score += 0.3
    reasons.append(f"{{years:.0f}} years with diabetes increases retinal risk independent of glucose control")
if bp > 135 and years > 12:
    risk_score += 0.1
    reasons.append("High BP plus long duration is a compounding risk pattern")

risk_score = min(risk_score, 1.0)
result = {{
    "risk_score": risk_score,
    "flag": risk_score >= 0.4,
    "reasoning": "; ".join(reasons) if reasons else "No early retinal risk markers detected.",
}}
"""


# ---------------------------------------------------------------------------
# CARDIOVASCULAR SPECIALIST
# ---------------------------------------------------------------------------
CARDIO_SYSTEM_PROMPT = """You are a cardiovascular risk specialist agent analyzing a diabetic
patient's lipid panel. Diabetics face elevated cardiovascular risk that a normal A1c does not
capture. Write Python code that reads the `patient` dict and sets a `result` dict:
{"risk_score": float 0-1, "flag": bool, "reasoning": str}.""" + STRICT_CODE_FORMAT_INSTRUCTIONS

def cardio_fallback_code(patient):
    return f"""
ldl = {patient['ldl_mg_dl']}
hdl = {patient['hdl_mg_dl']}
trig = {patient['triglycerides_mg_dl']}

risk_score = 0.0
reasons = []
if ldl > 130:
    risk_score += 0.4
    reasons.append(f"LDL of {{ldl}} mg/dL is elevated")
if hdl < 40:
    risk_score += 0.3
    reasons.append(f"HDL of {{hdl}} mg/dL is low (protective cholesterol too low)")
if trig > 150:
    risk_score += 0.3
    reasons.append(f"Triglycerides of {{trig}} mg/dL are elevated")

risk_score = min(risk_score, 1.0)
result = {{
    "risk_score": risk_score,
    "flag": risk_score >= 0.4,
    "reasoning": "; ".join(reasons) if reasons else "No early cardiovascular risk markers detected.",
}}
"""


SPECIALISTS = {
    "renal": (RENAL_SYSTEM_PROMPT, renal_fallback_code),
    "neuropathy": (NEUROPATHY_SYSTEM_PROMPT, neuropathy_fallback_code),
    "retinal": (RETINAL_SYSTEM_PROMPT, retinal_fallback_code),
    "cardiovascular": (CARDIO_SYSTEM_PROMPT, cardio_fallback_code),
}


def run_specialist(name: str, patient: dict) -> dict:
    """Runs one specialist agent on one patient. Uses real LLM if reachable, else fallback -
    and HONESTLY labels which one actually happened, instead of silently mislabeling.
    Retries once with error feedback if the LLM's code fails to execute, before
    giving up and using the rule-based fallback."""
    system_prompt, fallback_fn = SPECIALISTS[name]

    if has_llm():
        user_prompt = (
            f"Analyze this patient's data for {name} risk: {patient}\n"
            f"Respond ONLY with a python code block that sets a `result` dict as instructed."
        )
        try:
            raw = call_llm(system_prompt, user_prompt)
            code = extract_code_block(raw)
            output = run_agent_code(code, patient)

            # If the generated code failed to execute, give the model ONE more
            # chance with the actual error shown to it, before falling back.
            if output["reasoning"].startswith("[EXECUTION ERROR]") or output["reasoning"].startswith("[ERROR]"):
                retry_prompt = (
                    f"{user_prompt}\n\nYour previous attempt failed with this error:\n"
                    f"{output['reasoning']}\n"
                    f"Fix it. Remember: output ONLY a valid python code block, no other text."
                )
                raw_retry = call_llm(system_prompt, retry_prompt)
                code_retry = extract_code_block(raw_retry)
                output_retry = run_agent_code(code_retry, patient)
                if not (output_retry["reasoning"].startswith("[EXECUTION ERROR]") or output_retry["reasoning"].startswith("[ERROR]")):
                    output = output_retry  # retry succeeded, use it
                else:
                    raise RuntimeError("LLM code failed twice, falling back")

            used_llm = True
        except Exception:
            # LLM was reachable but its code didn't work even after a retry -
            # fall back, and say so honestly rather than pretending it was live.
            code = fallback_fn(patient)
            output = run_agent_code(code, patient)
            used_llm = False
    else:
        code = fallback_fn(patient)
        output = run_agent_code(code, patient)
        used_llm = False

    output["specialist"] = name
    output["used_llm"] = used_llm
    if not used_llm:
        output["reasoning"] = f"[LLM OFFLINE - rule-based fallback used] {output['reasoning']}"
    return output