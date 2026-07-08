"""
backend/main.py
------------------
FastAPI server wrapping the NHANES multi-agent pipeline.
Provides web endpoints for the Next.js frontend.
"""

import json
import time
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Import the patient execution pipeline straight from your engineer's script
from run_pipeline import run_patient, run_patient_streaming, build_graph
from agent_core import get_llm_status, reset_llm_call_counter, get_llm_call_count
from report_agent import generate_brief

BACKEND_DIR = Path(__file__).resolve().parent

# Compile the LangGraph agent orchestration flow
graph_flow = build_graph()

app = FastAPI(
    title="Diabetic Complication Early-Warning Swarm",
    description=(
        "Multi-agent system that screens already-diagnosed diabetic patients "
        "for early signs of renal, neuropathic, retinal, and cardiovascular "
        "complications - before they cross standard diagnostic thresholds. "
        "This system does NOT diagnose diabetes itself; it assumes a diagnosed "
        "patient and screens for downstream organ complications using NHANES "
        "2017-2018 patient records."
    ),
    version="1.0.0",
)

# Allow your Next.js frontend workspace to fetch data securely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to ["http://localhost:3000"] in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the patient dataset into memory for instant lookup queries
try:
    PATIENTS_DF = pd.read_csv(BACKEND_DIR / "real_patients.csv")
except Exception as e:
    print(f"[CRITICAL] Could not read real_patients.csv: {e}")
    PATIENTS_DF = pd.DataFrame()


class PatientAnalysisResponse(BaseModel):
    patient_id: str
    demographics: dict
    labs: dict
    specialists: list
    synthesis: dict
    benchmark: Optional[dict] = None


def _get_patient_row(patient_id: str) -> dict:
    if PATIENTS_DF.empty:
        raise HTTPException(status_code=500, detail="Patient file database uninitialized.")
    match = PATIENTS_DF[PATIENTS_DF["patient_id"] == patient_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found.")
    return match.iloc[0].to_dict()


def _labs_dict(patient_row: dict) -> dict:
    return {
        "egfr": float(patient_row["egfr"]),
        "uacr_mg_g": float(patient_row["uacr_mg_g"]),
        "creatinine_mg_dl": float(patient_row["creatinine_mg_dl"]),
        "ldl_mg_dl": float(patient_row["ldl_mg_dl"]),
        "hdl_mg_dl": float(patient_row["hdl_mg_dl"]),
        "triglycerides_mg_dl": float(patient_row["triglycerides_mg_dl"]),
        "systolic_bp": float(patient_row["systolic_bp"]),
    }


@app.get("/", tags=["info"])
@app.get("/api/info", tags=["info"])
def get_system_info():
    """Explains what this system is and is NOT, for anyone hitting the base
    URL or /docs cold (judges, teammates, future maintainers) without having
    to read source code first.
    """
    return {
        "name": "Diabetic Complication Early-Warning Swarm",
        "what_it_does": (
            "Screens already-diagnosed diabetic patients for early signs of "
            "renal, neuropathic, retinal, and cardiovascular complications, "
            "using early-warning thresholds set below standard diagnostic "
            "cutoffs so risk surfaces while it's still preventable."
        ),
        "what_it_does_not_do": (
            "Does not diagnose diabetes itself. Assumes the patient is already "
            "diabetic and screens for downstream organ complications only."
        ),
        "architecture": (
            "4 specialist agents (renal, neuropathy, retinal, cardiovascular) "
            "run in parallel via LangGraph, fan in to a synthesis agent that "
            "picks the top concern and recommendation, then an optional report "
            "agent turns that into a plain-language clinical brief."
        ),
        "data_source": "NHANES 2017-2018 patient records",
        "llm_mode": "offline" if get_llm_status() is None else get_llm_status(),
    }


@app.get("/api/patients", tags=["patients"])
def list_patients():
    """Returns a list of all available sample patients for the UI dropdown selection."""
    if PATIENTS_DF.empty:
        return []
    # Return basic data columns to populate your frontend dashboard selectors
    return PATIENTS_DF[["patient_id", "age", "sex", "a1c_percent"]].to_dict(orient="records")


@app.post("/api/analyze/{patient_id}", response_model=PatientAnalysisResponse, tags=["complication-screening"])
def analyze_patient(patient_id: str):
    """Triggers the full multi-agent code execution loop for a single patient (blocking).

    Kept alongside the new streaming GET endpoint as a fallback / for any
    non-streaming consumer (report generator, curl/Postman testing, etc.).
    """
    patient_row = _get_patient_row(patient_id)

    try:
        reset_llm_call_counter()
        pipeline_start = time.perf_counter()

        # Run the end-to-end evaluation pipeline (Executes agents + synthesis code blocks)
        final_state = run_patient(graph_flow, patient_row, verbose=False)

        total_ms = int((time.perf_counter() - pipeline_start) * 1000)

        specialist_results = [
            final_state["renal_result"],
            final_state["neuropathy_result"],
            final_state["retinal_result"],
            final_state["cardiovascular_result"],
        ]
        synthesis_report = final_state["synthesis"]

        return {
            "patient_id": str(patient_row["patient_id"]),
            "demographics": {
                "age": int(patient_row["age"]),
                "sex": str(patient_row["sex"]),
                "a1c_percent": float(patient_row["a1c_percent"]),
                "years_with_diabetes": float(patient_row["years_with_diabetes"]),
            },
            "labs": _labs_dict(patient_row),
            "specialists": specialist_results,
            "synthesis": synthesis_report,
            "benchmark": {
                "total_duration_ms": total_ms,
                "agents_run": 5,
                "llm_calls_made": get_llm_call_count(),
                "provider": get_llm_status(),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution breakdown: {str(e)}")


@app.post("/api/report/{patient_id}", tags=["complication-screening"])
def generate_report(patient_id: str, analysis: PatientAnalysisResponse):
    """Generates the plain-language Discovery Brief from an already-computed
    analysis result (frontend calls /api/analyze/{id} first, then POSTs that
    result here). Does not re-run the pipeline - avoids an extra LLM call and
    the added latency of re-executing agent code just to write the brief.
    """
    brief_text = generate_brief(
        patient_row={
            "patient_id": patient_id,
            **analysis.demographics,
            **analysis.labs,
        },
        specialist_results=analysis.specialists,
        synthesis=analysis.synthesis,
    )
    return {"patient_id": patient_id, "brief": brief_text}


@app.get("/api/analyze/{patient_id}/stream", tags=["complication-screening"])
def analyze_patient_stream(patient_id: str):
    """Streams pipeline progress as Server-Sent Events: one event per completed
    graph node (4 specialists + synthesis, in whatever order they finish -
    they run in parallel), then a final `pipeline_complete` benchmark summary.

    GET (not POST) because SSE requires GET in most browser EventSource
    implementations.
    """
    patient_row = _get_patient_row(patient_id)

    def event_stream():
        reset_llm_call_counter()
        pipeline_start = time.perf_counter()

        # Real data about what's about to run - not flavor text. The frontend
        # renders this verbatim instead of hardcoding its own opening lines.
        start_event = {
            "stage": "pipeline_start",
            "patient_id": str(patient_row["patient_id"]),
            "agents": ["renal", "neuropathy", "retinal", "cardiovascular"],
            "provider": get_llm_status(),
            "timestamp": time.time(),
        }
        yield f"data: {json.dumps(start_event)}\n\n"

        for node_name, node_output in run_patient_streaming(graph_flow, patient_row):
            event = {"stage": node_name, "data": node_output, "timestamp": time.time()}
            yield f"data: {json.dumps(event)}\n\n"

        total_ms = int((time.perf_counter() - pipeline_start) * 1000)
        summary = {
            "stage": "pipeline_complete",
            "total_duration_ms": total_ms,
            "agents_run": 5,
            "llm_calls_made": get_llm_call_count(),
            "provider": get_llm_status(),
        }
        yield f"data: {json.dumps(summary)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/status", tags=["info"])
def get_status():
    """Returns the current LLM status of the backend (fireworks, featherless, or offline),
    plus the actual model string in use so the Benchmark tab can show e.g.
    'Qwen/Qwen2.5-7B-Instruct via Featherless' instead of just a provider name.
    """
    from agent_core import FIREWORKS_MODEL, FEATHERLESS_MODEL
    provider = get_llm_status()
    model_map = {"fireworks": FIREWORKS_MODEL, "featherless": FEATHERLESS_MODEL}
    return {
        "llm_status": "offline" if provider is None else provider,
        "model": model_map.get(provider),
    }


if __name__ == "__main__":
    import uvicorn
    # Fires up the server on port 8000
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)