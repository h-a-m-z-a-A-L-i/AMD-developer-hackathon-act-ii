"""
specialists.py
----------------
Defines the four specialist agents and their system prompts.

The model must generate executable Python that produces a `result` dict. If
no LLM is reachable or code execution fails, the specialist reports itself as
unavailable.
"""

import random
import time

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
   these exact keys:
     - "risk_score" (float 0-1)
     - "flag" (bool) - this MUST be mechanically DERIVED from risk_score in code
       (e.g. `flag = risk_score >= 0.4`), never a second, separately-reasoned
       judgment call. flag and risk_score are only allowed to disagree if you
       pick your own explicit numeric flag-threshold and use it consistently -
       never eyeball flag independently of the number you just computed. This
       is what stops the UI from showing a low risk_score with an "Anomaly
       Flagged" label, or a high risk_score marked "Within Boundary".
     - "reasoning" (str) - MUST name the specific numeric cutoff(s) you used and the
       patient's actual value for each, e.g. "eGFR of 72.6 is below the 84.8 cutoff
       I'm using for early renal stress". Do not describe a threshold in words only -
       state the number.
     - "thresholds_used" (dict[str, float]) - every numeric cutoff you actually applied
       in your code, keyed by a short label, e.g. {"eGFR cutoff": 84.8}. This MUST
       match the numbers named in `reasoning` exactly - never report a different
       number here than what your code actually compared against.
6. Do not import any modules. Do not read files or access the network. Only use the
   `patient` dict that is already available to you.
7. NEVER assign risk_score by picking from a small set of preset numbers (e.g. an
   if/else chain landing on 0.1/0.3/0.5/0.7/0.8/1.0). risk_score MUST be COMPUTED as
   a continuous function of how far the patient's actual value sits from your
   cutoff(s) - e.g. take the proportional gap between the value and the cutoff
   (scaled against a clinically reasonable range for that metric) so two different
   patients essentially never land on the same score. A genuinely computed score
   will usually NOT be a clean multiple of 0.05 or 0.1 (e.g. 0.62 or 0.437, not 0.6
   or 0.4) - if your formula keeps producing round numbers, it's too coarse; use the
   actual proportional distance from the cutoff instead of a flat bump per band.
7b. AVOID SATURATION: if you use a curve (e.g. a sigmoid/logistic function) to turn
    the gap-from-cutoff into a 0-1 score, keep the steepness modest. A steep curve
    collapses every patient who is even moderately past the cutoff to ~0.97-0.999,
    which displays as a flat, meaningless "100%" once rounded - that's just as
    uninformative as picking round numbers directly. A well-tuned curve should keep
    even a patient whose value is far outside your cutoff somewhere around
    0.80-0.95, not pinned at the ceiling, and should keep a patient far inside safe
    range around 0.02-0.12, not pinned at the floor. If your gap/spread math would
    push the exponent so large it saturates (e.g. |4 * gap| > ~3), widen the spread
    or soften the multiplier so the curve keeps discriminating between "bad" and
    "very bad" instead of treating both as maximum risk.
7c. COMBINING MULTIPLE FACTORS: if you compute more than one sub-score (e.g. one
    per lab value) before producing the final risk_score, sanity-check each
    sub-score against its own gap before combining: a value that is CLEARLY past
    its cutoff (e.g. the gap is a large multiple of the cutoff itself, like a UACR
    of 250 against a cutoff of 100) must never end up contributing a near-zero
    sub-score - if your formula produces that, your spread constant for that
    specific metric is miscalibrated; fix the spread, don't let the bad sub-score
    through. When combining, prefer taking the maximum of the sub-scores (or a
    weighted average where every clearly-abnormal sub-score keeps real weight) -
    never combine in a way (like a plain average diluted by one broken near-zero
    term) that lets one mis-scaled sub-score silently cancel out a real signal
    from another. If your `reasoning` text names a value as concerning, the final
    `risk_score` must reflect that - don't describe a factor as abnormal and then
    report a combined score that quietly ignores it.
8. Write `result` as ONE single dict literal - every required key must appear between
   the opening `{` and the one closing `}`. Do NOT close the dict early and then keep
   writing keys as separate bare lines. This is WRONG and will crash with a syntax
   error:
       result = {
           "risk_score": risk_score,
       }
       "flag": flag,
       "reasoning": reasoning,
   All keys - "risk_score", "flag", "reasoning", "thresholds_used" - belong inside the
   SAME braces, before the single closing `}`.

Example of the ONLY acceptable response format (illustrative structure only - do
NOT reuse this specific metric, cutoff, or scaling range; decide your own for the
domain you were asked about). Note how risk_score is COMPUTED from the proportional
gap to the cutoff with a MODEST curve steepness (not chosen from a preset list, and
not so steep it saturates to a flat 100%/0%) - this is what keeps two different
patients from landing on the same round, or maxed-out, score:
```python
some_value = patient["some_field"]
cutoff = 42.0
# `spread` is the range over which risk climbs from ~0 to ~1 past the cutoff -
# pick a clinically reasonable spread for this metric, not a fixed constant.
spread = 20.0
gap = (some_value - cutoff) / spread
# Steepness of 1.6-2.2 keeps even a patient far past cutoff in the ~0.85-0.95
# range instead of pinning at ~1.0 - a steeper constant (like 4+) saturates too
# fast and makes every bad patient look identically "maximum risk".
risk_score = 1 / (1 + 2.71828 ** (-1.8 * gap))
result = {
    "risk_score": risk_score,
    "flag": risk_score >= 0.4,
    "reasoning": f"Value {some_value} vs the {cutoff} early-warning cutoff gives a computed risk of {risk_score:.3f}.",
    "thresholds_used": {"some_field cutoff": cutoff},
}
```
"""


# Field lists specify which patient inputs each specialist reads.
RENAL_FIELDS = ["egfr", "uacr_mg_g", "creatinine_mg_dl"]
NEUROPATHY_FIELDS = ["years_with_diabetes", "a1c_percent"]
RETINAL_FIELDS = ["systolic_bp", "years_with_diabetes"]
CARDIO_FIELDS = ["ldl_mg_dl", "hdl_mg_dl", "triglycerides_mg_dl"]


# System prompts describe the clinical lens; numeric cutoffs are chosen by the model.
RENAL_SYSTEM_PROMPT = """You are a renal (kidney) specialist agent analyzing diabetic patient
lab data to catch early kidney stress BEFORE standard diagnostic thresholds are hit (i.e. your
cutoffs should be more conservative/sensitive than standard disease-stage cutoffs like eGFR 60
or UACR 30, since the goal is catching risk early). Use your own clinical knowledge to decide
the specific numeric early-warning cutoffs for eGFR and UACR (and creatinine if relevant) for
THIS patient, and apply them consistently. Write Python code that reads the `patient` dict and
sets a `result` dict as instructed below.""" + STRICT_CODE_FORMAT_INSTRUCTIONS

NEUROPATHY_SYSTEM_PROMPT = """You are a diabetic neuropathy risk specialist agent. Longer
diabetes duration and higher A1c are the strongest available predictors of nerve damage risk in
single-visit survey data (true day-to-day glucose variability isn't available here). Use your
own clinical knowledge to decide specific early-warning numeric cutoffs for years-with-diabetes
and A1c (early-warning means more sensitive than standard "poor control" cutoffs like A1c 7.0),
and apply them consistently. Write Python code that reads the `patient` dict and sets a `result`
dict as instructed below.""" + STRICT_CODE_FORMAT_INSTRUCTIONS

RETINAL_SYSTEM_PROMPT = """You are a diabetic retinopathy risk specialist agent. Elevated blood
pressure combined with longer diabetes duration is a strong predictor of retinal damage risk,
independent of glucose control. Use your own clinical knowledge to decide specific early-warning
numeric cutoffs for systolic BP and years-with-diabetes, and apply them consistently. Write
Python code that reads the `patient` dict and sets a `result` dict as instructed below.""" + STRICT_CODE_FORMAT_INSTRUCTIONS

CARDIO_SYSTEM_PROMPT = """You are a cardiovascular risk specialist agent analyzing a diabetic
patient's lipid panel. Diabetics face elevated cardiovascular risk that a normal A1c does not
capture. Use your own clinical knowledge to decide specific early-warning numeric cutoffs for
LDL, HDL, and triglycerides, and apply them consistently. Write Python code that reads the
`patient` dict and sets a `result` dict as instructed below.""" + STRICT_CODE_FORMAT_INSTRUCTIONS


SPECIALISTS = {
    "renal": RENAL_SYSTEM_PROMPT,
    "neuropathy": NEUROPATHY_SYSTEM_PROMPT,
    "retinal": RETINAL_SYSTEM_PROMPT,
    "cardiovascular": CARDIO_SYSTEM_PROMPT,
}

SPECIALIST_FIELDS = {
    "renal": RENAL_FIELDS,
    "neuropathy": NEUROPATHY_FIELDS,
    "retinal": RETINAL_FIELDS,
    "cardiovascular": CARDIO_FIELDS,
}

# All 4 specialists fan out from START in the same LangGraph invoke() call, so
# without this they hit the active provider at essentially the same instant -
# and each can retry on failure (see MAX_ATTEMPTS below), so a single patient
# run can burst up to 8 near-simultaneous requests at the provider. Free/
# low-tier API keys commonly rate-limit on requests-per-second, not just
# per-minute, so that burst is a likely cause of the "some specialists
# unavailable" pattern even though _post_with_retry() already backs off on
# 429s - retrying inside the same burst window doesn't help if all 4 hit the
# window at once.
#
# Staggering the START of each specialist's first attempt (small, fixed,
# per-specialist offsets - not random) spreads the burst out over ~1.2s
# without meaningfully slowing the overall pipeline (specialists still run
# concurrently, they just don't all dial out in the same instant), and keeps
# runs reproducible since the offsets are deterministic rather than
# randomized per-run.
STAGGER_DELAY_SECONDS = {
    "renal": 0.0,
    "neuropathy": 0.4,
    "retinal": 0.8,
    "cardiovascular": 1.2,
}


def _unavailable_result(name: str, start: float, input_labs: dict, reason: str) -> dict:
    """Return an unavailable specialist result with no fabricated risk values."""
    duration_ms = int((time.perf_counter() - start) * 1000)
    return {
        "specialist": name,
        "used_llm": False,
        "available": False,
        "risk_score": None,
        "flag": None,
        "reasoning": f"Analysis unavailable: {reason}",
        "thresholds_used": {},
        "steps": [f"No analysis performed - {reason}"],
        "duration_ms": duration_ms,
        "input_labs": input_labs,
        "code_used": None,
    }


def run_specialist(name: str, patient: dict) -> dict:
    """Run one specialist through a live LLM and return its result."""
    system_prompt = SPECIALISTS[name]
    input_labs = {k: patient[k] for k in SPECIALIST_FIELDS[name] if k in patient}

    # Stagger this specialist's dial-out so all 4 don't hit the provider in
    # the same instant (see STAGGER_DELAY_SECONDS above). Deliberately
    # happens BEFORE has_llm()'s own connectivity ping too - if the delay
    # were only around the scoring call, the status-check ping every
    # specialist fires first would still burst all 4 at once. `start` is
    # captured AFTER the stagger, not before, so duration_ms reflects this
    # specialist's actual work time and doesn't make later-staggered
    # specialists (e.g. cardiovascular at +1.2s) look artificially slower
    # than renal in the Benchmark tab.
    time.sleep(STAGGER_DELAY_SECONDS.get(name, 0.0))
    start = time.perf_counter()

    if not has_llm():
        return _unavailable_result(
            name, start, input_labs,
            reason="no LLM backend (Fireworks/AMD) is currently reachable.",
        )

    user_prompt = (
        f"Analyze this patient's data for {name} risk: {patient}\n"
        f"Respond ONLY with a python code block that sets a `result` dict as instructed."
    )

    # Small/cheap models occasionally mangle the required dict format (e.g.
    # closing `result = {` early and continuing keys as bare, un-braced lines)
    # rather than getting the underlying clinical logic wrong, so one retry
    # with the real error shown back to it gives it a chance to self-correct
    # before honestly reporting the specialist as unavailable. Deliberately
    # kept at 2 total attempts, not more: all 4 specialists run in parallel,
    # so every extra attempt multiplies concurrent calls against the active
    # provider's rate limit - a 3rd attempt here previously caused OTHER
    # specialists to start failing with connection/rate errors instead of
    # fixing this one.
    MAX_ATTEMPTS = 2
    try:
        prompt = user_prompt
        output = None
        code = None
        last_reasoning = None
        for attempt in range(MAX_ATTEMPTS):
            raw = call_llm(system_prompt, prompt)
            code = extract_code_block(raw)
            output = run_agent_code(code, patient)
            is_error = output["reasoning"].startswith("[EXECUTION ERROR]") or output["reasoning"].startswith("[ERROR]")
            if not is_error:
                break
            last_reasoning = output["reasoning"]
            # Brief, small, jittered pause before retrying. Without this, a
            # failed attempt 1 re-dials instantly - and for renal in
            # particular (0.0s stagger, so it's always first), that instant
            # retry lands right in the window where neuropathy/retinal/
            # cardiovascular are waking up from their own staggers and
            # firing their first attempts, recreating the exact rate-limit
            # burst the staggering was meant to avoid. This is separate from
            # _post_with_retry's own 429 backoff in agent_core.py, which only
            # covers retries WITHIN one HTTP call, not between specialist-
            # level attempts.
            remaining_stagger = max(STAGGER_DELAY_SECONDS.values()) - STAGGER_DELAY_SECONDS.get(name, 0.0)
            time.sleep(remaining_stagger + 0.5 + random.uniform(0, 0.4))
            prompt = (
                f"{user_prompt}\n\nYour previous attempt failed with this error:\n"
                f"{last_reasoning}\n"
                f"Fix it. Remember: output ONLY a valid python code block, no other text."
            )
        else:
            return _unavailable_result(
                name, start, input_labs,
                reason=f"LLM-generated code failed {MAX_ATTEMPTS} times in a row: {last_reasoning}",
            )
    except Exception as e:
        return _unavailable_result(name, start, input_labs, reason=f"LLM call failed: {e}")

    # LLM writes arbitrary code, so we can't introspect its reasoning at the
    # same granularity a rule-based system would. Synthesize a real (not
    # generic) trace from the provider name and actual result, unless the
    # LLM's own code happened to set "steps" already.
    if not output.get("steps"):
        from agent_core import get_llm_status
        provider = get_llm_status()
        output["steps"] = [
            f"LLM ({provider}) generated custom risk-scoring code",
            f"Executed in sandbox -> risk_score={output.get('risk_score', 0.0):.2f}",
        ]

    duration_ms = int((time.perf_counter() - start) * 1000)

    output["specialist"] = name
    output["used_llm"] = True
    output["available"] = True
    output["duration_ms"] = duration_ms
    output["input_labs"] = input_labs
    output["code_used"] = code
    output.setdefault("thresholds_used", {})
    output.setdefault("steps", [])

    return output
