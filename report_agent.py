"""
report_agent.py
----------------
Discovery Brief Writer - composes a plain-language, exportable clinical brief
from the already-computed pipeline output (specialist results + synthesis).

LLM-only, like the rest of the pipeline now: no deterministic f-string
template fallback. If no LLM is reachable, or the specialist/synthesis inputs
themselves are unavailable, the brief honestly says so instead of assembling
a canned document out of partial or absent data.
"""

from agent_core import has_llm, call_llm

REPORT_SYSTEM_PROMPT = """You are the Discovery Brief Writer for a diabetic complication risk panel. You are given a patient's demographics, labs, and the full output of four specialist agents (renal, neuropathy, retinal, cardiovascular) plus a synthesis recommendation. Some specialists or the synthesis may be marked unavailable - do not invent findings for anything unavailable, and clearly disclose in the brief that the picture is incomplete if so. Write a plain-language clinical brief a primary care physician could read in under a minute. Do not invent any numbers - use only the values provided. Output ONLY the brief text, no preamble."""


def _generate_brief_llm(patient_row: dict, specialist_results: list, synthesis: dict) -> str:
    user_prompt = (
        f"Patient: ID={patient_row.get('patient_id')}, "
        f"Name={patient_row.get('name', '')}, "
        f"Age={patient_row.get('age')}, "
        f"Sex={patient_row.get('sex')}, A1c={patient_row.get('a1c_percent')}%, "
        f"Years with diabetes={patient_row.get('years_with_diabetes')}\n\n"
        f"Labs: {patient_row}\n\n"
        f"Specialist results:\n"
    )
    for s in specialist_results:
        if s.get("available", True) is False:
            user_prompt += f"- {s.get('specialist')}: UNAVAILABLE ({s.get('reasoning')})\n"
        else:
            user_prompt += (
                f"- {s.get('specialist')}: risk_score={s.get('risk_score')}, flag={s.get('flag')}, "
                f"reasoning={s.get('reasoning')}, thresholds_used={s.get('thresholds_used')}, "
                f"used_llm={s.get('used_llm')}\n"
            )

    if synthesis.get("available", True) is False:
        user_prompt += (
            f"\nSynthesis: UNAVAILABLE ({synthesis.get('synthesis_error')})\n\n"
            f"Write the Discovery Brief now, disclosing clearly that synthesis is unavailable and why. "
            f"Still summarize whatever specialist results ARE available."
        )
    else:
        user_prompt += (
            f"\nSynthesis: top_concern={synthesis.get('top_concern')}, "
            f"recommendation={synthesis.get('recommendation')}\n\n"
            f"Write the Discovery Brief now, following a clear section structure "
            f"(header stat block, Clinical Context, Risk Panel Summary, Top Concern, Methodology). "
            f"Use only the numbers given above - do not invent any."
        )
    return call_llm(REPORT_SYSTEM_PROMPT, user_prompt)


def generate_brief(patient_row: dict, specialist_results: list, synthesis: dict) -> str:
    """Entry point. LLM-only - if no LLM backend is reachable, or the call
    fails, this returns an honest unavailable message instead of a
    deterministic template assembled from whatever data happens to exist."""
    patient_id = patient_row.get("patient_id", "Unknown")

    if not has_llm():
        return (
            f"Discovery Brief unavailable for patient {patient_id}: "
            f"no LLM backend (Fireworks/AMD) is currently reachable. "
            f"No report was generated - this is not a placeholder or partial brief."
        )

    try:
        return _generate_brief_llm(patient_row, specialist_results, synthesis)
    except Exception as e:
        return (
            f"Discovery Brief unavailable for patient {patient_id}: "
            f"the LLM call failed ({e}). No report was generated - "
            f"this is not a placeholder or partial brief."
        )
