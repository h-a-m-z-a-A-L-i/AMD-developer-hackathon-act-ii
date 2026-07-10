"""
backend/main.py
------------------
FastAPI server wrapping the NHANES multi-agent pipeline.
Provides web endpoints for the Next.js frontend.
"""

import json
import time
import uuid
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

# Patient execution pipeline (agent orchestration + graph definition)
from run_pipeline import run_patient, run_patient_streaming, build_graph
from agent_core import (
    get_llm_status,
    get_provider_detail,
    reset_llm_call_counter,
    get_llm_call_count,
    PROVIDER_IDS,
    get_forced_provider,
    set_forced_provider,
)
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

# CORS: allow the Next.js frontend to fetch data from this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to ["http://localhost:3000"] in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Human-readable field labels for validation error messages, since the
# frontend shouldn't have to know our internal field names to show a decent
# message ("Age" reads better than "age", "A1c %" better than "a1c_percent").
_FIELD_LABELS = {
    "name": "Name",
    "age": "Age",
    "sex": "Sex",
    "years_with_diabetes": "Years with diabetes",
    "a1c_percent": "A1c %",
    "egfr": "eGFR",
    "uacr_mg_g": "UACR (mg/g)",
    "creatinine_mg_dl": "Creatinine (mg/dL)",
    "ldl_mg_dl": "LDL (mg/dL)",
    "hdl_mg_dl": "HDL (mg/dL)",
    "triglycerides_mg_dl": "Triglycerides (mg/dL)",
    "systolic_bp": "Systolic BP",
}


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Reformats FastAPI/Pydantic's default validation error payload (a nested
    list of {loc, msg, type, ctx} dicts) into something a form can render
    directly: one short, friendly sentence per bad field. This is what turns
    an out-of-range submission into "tell the user what's wrong and let them
    fix it" instead of a raw 500 or a wall of Pydantic internals - the request
    never reaches patient-building or the pipeline, so nothing downstream can
    break on bad input.

    Response shape (always 422):
    {
      "error": "validation_failed",
      "message": "Please fix the highlighted fields and try again.",
      "fields": [
        {"field": "a1c_percent", "label": "A1c %", "message": "..."}
      ]
    }
    """
    field_errors = []
    for err in exc.errors():
        # err["loc"] looks like ("body", "a1c_percent") for a body field.
        loc = [p for p in err.get("loc", []) if p != "body"]
        field_name = str(loc[-1]) if loc else "input"
        label = _FIELD_LABELS.get(field_name, field_name)

        err_type = err.get("type", "")
        ctx = err.get("ctx", {})
        if err_type == "greater_than_equal":
            message = f"Impossible value detected! Check labs again — {label} can't be below {ctx.get('ge')}."
        elif err_type == "less_than_equal":
            message = f"Impossible value detected! Check labs again — {label} can't be above {ctx.get('le')}."
        elif err_type == "missing":
            message = f"{label} is required."
        elif err_type in ("float_parsing", "float_type", "int_parsing", "int_type"):
            message = f"{label} should be a number only — please remove any letters or symbols."
        else:
            message = f"{label} is invalid."

        field_errors.append({"field": field_name, "label": label, "message": message})

    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_failed",
            "message": "Please fix the highlighted fields and try again.",
            "fields": field_errors,
        },
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


def _run_pipeline_and_build_response(patient_row: dict) -> dict:
    """Runs the full LangGraph pipeline for a single patient dict and shapes
    the result into the PatientAnalysisResponse dict shape. Shared by every
    entry point that needs a full analysis (dataset-driven /api/analyze/{id}
    and the custom-input endpoint below) so the two can't quietly drift apart
    in what they return.

    `patient_row` just needs to look like a real_patients.csv row: same field
    names/types specialists.py expects. Where that dict came from (a CSV
    lookup vs. a custom request body) is irrelevant to the pipeline.
    """
    reset_llm_call_counter()
    pipeline_start = time.perf_counter()

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
            "name": str(patient_row.get("name") or ""),
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
            "provider_detail": get_provider_detail(),
        },
    }


# Single source of truth for custom-patient value ranges. Referenced by both
# CustomPatientInput (POST body, for /api/analyze/custom) and the query-param
# dependency below (GET, for /api/analyze/custom/stream) so the two entry
# points can't drift apart on what counts as a valid value.
CUSTOM_PATIENT_BOUNDS = {
    "age": (1, 120),
    "years_with_diabetes": (0, 90),
    "a1c_percent": (3.0, 20.0),
    "egfr": (1.0, 200.0),
    "uacr_mg_g": (0.0, 10000.0),
    "creatinine_mg_dl": (0.1, 20.0),
    "ldl_mg_dl": (0.0, 1000.0),
    "hdl_mg_dl": (0.0, 200.0),
    "triglycerides_mg_dl": (0.0, 10000.0),
    "systolic_bp": (50.0, 260.0),
}


class CustomPatientInput(BaseModel):
    """Raw lab values submitted directly by a user instead of picking a
    dataset patient by ID. Ranges are generous clinical bounds (not tight
    'normal' ranges) - the goal is to reject garbage/typo'd input before it
    reaches the LLM or the fallback math, not to second-guess real patients
    with unusual-but-plausible values.
    """

    name: Optional[str] = Field(None, max_length=100, description="Optional display name for this custom patient (not used by the pipeline, display-only).")
    age: float = Field(..., ge=CUSTOM_PATIENT_BOUNDS["age"][0], le=CUSTOM_PATIENT_BOUNDS["age"][1])
    sex: str
    years_with_diabetes: float = Field(..., ge=CUSTOM_PATIENT_BOUNDS["years_with_diabetes"][0], le=CUSTOM_PATIENT_BOUNDS["years_with_diabetes"][1])
    a1c_percent: float = Field(..., ge=CUSTOM_PATIENT_BOUNDS["a1c_percent"][0], le=CUSTOM_PATIENT_BOUNDS["a1c_percent"][1])
    egfr: float = Field(..., ge=CUSTOM_PATIENT_BOUNDS["egfr"][0], le=CUSTOM_PATIENT_BOUNDS["egfr"][1])
    uacr_mg_g: float = Field(..., ge=CUSTOM_PATIENT_BOUNDS["uacr_mg_g"][0], le=CUSTOM_PATIENT_BOUNDS["uacr_mg_g"][1])
    creatinine_mg_dl: float = Field(..., ge=CUSTOM_PATIENT_BOUNDS["creatinine_mg_dl"][0], le=CUSTOM_PATIENT_BOUNDS["creatinine_mg_dl"][1])
    ldl_mg_dl: float = Field(..., ge=CUSTOM_PATIENT_BOUNDS["ldl_mg_dl"][0], le=CUSTOM_PATIENT_BOUNDS["ldl_mg_dl"][1])
    hdl_mg_dl: float = Field(..., ge=CUSTOM_PATIENT_BOUNDS["hdl_mg_dl"][0], le=CUSTOM_PATIENT_BOUNDS["hdl_mg_dl"][1])
    triglycerides_mg_dl: float = Field(..., ge=CUSTOM_PATIENT_BOUNDS["triglycerides_mg_dl"][0], le=CUSTOM_PATIENT_BOUNDS["triglycerides_mg_dl"][1])
    systolic_bp: float = Field(..., ge=CUSTOM_PATIENT_BOUNDS["systolic_bp"][0], le=CUSTOM_PATIENT_BOUNDS["systolic_bp"][1])

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Jane Doe",
                "age": 55,
                "sex": "F",
                "years_with_diabetes": 17,
                "a1c_percent": 6.5,
                "egfr": 72.6,
                "uacr_mg_g": 8.4,
                "creatinine_mg_dl": 0.93,
                "ldl_mg_dl": 354,
                "hdl_mg_dl": 49,
                "triglycerides_mg_dl": 213,
                "systolic_bp": 149.3,
            }
        }


def _custom_patient_query_params(
    name: Optional[str] = Query(None, max_length=100),
    age: float = Query(..., ge=CUSTOM_PATIENT_BOUNDS["age"][0], le=CUSTOM_PATIENT_BOUNDS["age"][1]),
    sex: str = Query(...),
    years_with_diabetes: float = Query(..., ge=CUSTOM_PATIENT_BOUNDS["years_with_diabetes"][0], le=CUSTOM_PATIENT_BOUNDS["years_with_diabetes"][1]),
    a1c_percent: float = Query(..., ge=CUSTOM_PATIENT_BOUNDS["a1c_percent"][0], le=CUSTOM_PATIENT_BOUNDS["a1c_percent"][1]),
    egfr: float = Query(..., ge=CUSTOM_PATIENT_BOUNDS["egfr"][0], le=CUSTOM_PATIENT_BOUNDS["egfr"][1]),
    uacr_mg_g: float = Query(..., ge=CUSTOM_PATIENT_BOUNDS["uacr_mg_g"][0], le=CUSTOM_PATIENT_BOUNDS["uacr_mg_g"][1]),
    creatinine_mg_dl: float = Query(..., ge=CUSTOM_PATIENT_BOUNDS["creatinine_mg_dl"][0], le=CUSTOM_PATIENT_BOUNDS["creatinine_mg_dl"][1]),
    ldl_mg_dl: float = Query(..., ge=CUSTOM_PATIENT_BOUNDS["ldl_mg_dl"][0], le=CUSTOM_PATIENT_BOUNDS["ldl_mg_dl"][1]),
    hdl_mg_dl: float = Query(..., ge=CUSTOM_PATIENT_BOUNDS["hdl_mg_dl"][0], le=CUSTOM_PATIENT_BOUNDS["hdl_mg_dl"][1]),
    triglycerides_mg_dl: float = Query(..., ge=CUSTOM_PATIENT_BOUNDS["triglycerides_mg_dl"][0], le=CUSTOM_PATIENT_BOUNDS["triglycerides_mg_dl"][1]),
    systolic_bp: float = Query(..., ge=CUSTOM_PATIENT_BOUNDS["systolic_bp"][0], le=CUSTOM_PATIENT_BOUNDS["systolic_bp"][1]),
) -> CustomPatientInput:
    """Same validation as CustomPatientInput, but sourced from query params
    instead of a JSON body. Needed because browsers' EventSource API (what
    SSE streaming uses on the frontend) can only issue GET requests and can't
    attach a JSON body - so the streaming variant of the custom endpoint has
    to accept the same 11 values as ?query=params instead. Bounds are pulled
    from the same CUSTOM_PATIENT_BOUNDS dict as the POST body model, so the
    two can't silently drift apart.
    """
    return CustomPatientInput(
        name=name,
        age=age,
        sex=sex,
        years_with_diabetes=years_with_diabetes,
        a1c_percent=a1c_percent,
        egfr=egfr,
        uacr_mg_g=uacr_mg_g,
        creatinine_mg_dl=creatinine_mg_dl,
        ldl_mg_dl=ldl_mg_dl,
        hdl_mg_dl=hdl_mg_dl,
        triglycerides_mg_dl=triglycerides_mg_dl,
        systolic_bp=systolic_bp,
    )


def _build_custom_patient_row(payload: CustomPatientInput) -> dict:
    """Turns validated form/API input into a patient dict shaped exactly like
    a real_patients.csv row (same field names specialists.py already reads),
    plus a placeholder patient_id since there's no real dataset row backing
    this request. Nothing here is persisted - it's built fresh per request.
    """
    sex = payload.sex.strip().upper()
    if sex not in ("M", "F"):
        raise HTTPException(
            status_code=422,
            detail={
                "error": "validation_failed",
                "message": "Please fix the highlighted fields and try again.",
                "fields": [
                    {"field": "sex", "label": "Sex", "message": "Sex must be 'M' or 'F'."}
                ],
            },
        )

    placeholder_id = f"CUSTOM-{uuid.uuid4().hex[:8].upper()}"

    return {
        "patient_id": placeholder_id,
        "name": (payload.name or "").strip(),
        "age": payload.age,
        "sex": sex,
        "years_with_diabetes": payload.years_with_diabetes,
        "a1c_percent": payload.a1c_percent,
        "egfr": payload.egfr,
        "uacr_mg_g": payload.uacr_mg_g,
        "creatinine_mg_dl": payload.creatinine_mg_dl,
        "ldl_mg_dl": payload.ldl_mg_dl,
        "hdl_mg_dl": payload.hdl_mg_dl,
        "triglycerides_mg_dl": payload.triglycerides_mg_dl,
        "systolic_bp": payload.systolic_bp,
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
        "llm_mode": "offline" if get_llm_status() is None else get_provider_detail(),
    }


@app.get("/api/patients", tags=["patients"])
def list_patients():
    """Returns a list of all available sample patients for the UI dropdown selection."""
    if PATIENTS_DF.empty:
        return []
    # Basic columns only - enough to populate the dashboard's patient selector
    return PATIENTS_DF[["patient_id", "age", "sex", "a1c_percent"]].to_dict(orient="records")


@app.post("/api/analyze/custom", response_model=PatientAnalysisResponse, tags=["complication-screening"])
def analyze_custom_patient(payload: CustomPatientInput):
    """Same pipeline as /api/analyze/{patient_id}, but for a patient that isn't
    in the dataset - raw lab values are supplied directly in the request body
    instead of looked up by ID. Useful for demoing the system on a
    hypothetical / manually-entered patient without needing a dataset row.

    Input is validated (reasonable clinical ranges) before it ever reaches the
    LLM or the rule-based fallback math. The resulting patient dict is built
    to look exactly like a real_patients.csv row, then handed to the same
    LangGraph pipeline the dataset-driven endpoint uses - no changes to the
    specialists, synthesis agent, or graph itself. Nothing here is persisted;
    each request gets a fresh placeholder ID and is discarded after response.

    NOTE: this route is registered BEFORE /api/analyze/{patient_id} on purpose.
    FastAPI matches routes in registration order, and {patient_id} is a
    catch-all path segment - if it came first, a POST to /api/analyze/custom
    would incorrectly match it with patient_id='custom' instead of hitting
    this handler. Keep this above the dynamic route if either is ever moved.
    """
    patient_row = _build_custom_patient_row(payload)

    try:
        return _run_pipeline_and_build_response(patient_row)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution breakdown: {str(e)}")


@app.post("/api/analyze/{patient_id}", response_model=PatientAnalysisResponse, tags=["complication-screening"])
def analyze_patient(patient_id: str):
    """Triggers the full multi-agent code execution loop for a single patient (blocking).

    Kept alongside the new streaming GET endpoint as a fallback / for any
    non-streaming consumer (report generator, curl/Postman testing, etc.).
    """
    patient_row = _get_patient_row(patient_id)

    try:
        # Runs the end-to-end evaluation pipeline (executes agent + synthesis code blocks)
        return _run_pipeline_and_build_response(patient_row)
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


def _stream_pipeline_events(patient_row: dict):
    """Shared SSE generator used by both streaming endpoints (dataset-driven
    and custom-input) so their event format can't drift apart. Yields
    `data: {...}\n\n` lines: one `pipeline_start`, one event per completed
    graph node (order not guaranteed - the 4 specialists run in parallel),
    then a final `pipeline_complete` benchmark summary.
    """
    reset_llm_call_counter()
    pipeline_start = time.perf_counter()

    # Real data about what's about to run - not flavor text. The frontend
    # renders this verbatim instead of hardcoding its own opening lines.
    start_event = {
        "stage": "pipeline_start",
        "patient_id": str(patient_row["patient_id"]),
        "agents": ["renal", "neuropathy", "retinal", "cardiovascular"],
        "provider": get_llm_status(),
        "provider_detail": get_provider_detail(),
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
        "provider_detail": get_provider_detail(),
    }
    yield f"data: {json.dumps(summary)}\n\n"


@app.get("/api/analyze/custom/validate", tags=["complication-screening"])
def validate_custom_patient(payload: CustomPatientInput = Depends(_custom_patient_query_params)):
    """Validation-only check for custom-patient input: 200 if the values pass
    CUSTOM_PATIENT_BOUNDS, 422 (via the same validation_error_handler as every
    other endpoint) if not. Runs NO pipeline, NO LLM calls, and opens no SSE
    stream - it exists purely so the frontend can pre-flight-check a form
    submission before opening the real EventSource.

    This replaces an earlier approach where the frontend GET'd the actual
    /api/analyze/custom/stream endpoint just to read its status code, then
    discarded the response without closing it. That silently ran the full
    multi-agent pipeline a second time (doubling LLM calls and skewing the
    Benchmark tab's counters) AND left a live text/event-stream HTTP
    connection open forever, since the frontend never consumed or cancelled
    the response body. Repeated custom-patient submissions leaked one
    connection each, eventually exhausting the browser's per-origin
    connection limit (6 for HTTP/1.1) so the *next* EventSource - dataset or
    custom - couldn't open at all and immediately errored out.
    """
    _build_custom_patient_row(payload)  # reuses the same sex-normalization/validation path
    return {"valid": True}


@app.get("/api/analyze/custom/stream", tags=["complication-screening"])
def analyze_custom_patient_stream(payload: CustomPatientInput = Depends(_custom_patient_query_params)):
    """Streaming (SSE) counterpart to POST /api/analyze/custom, for a custom
    patient instead of a dataset ID. Same live agent-by-agent event feed as
    /api/analyze/{patient_id}/stream, powered by the same shared generator -
    so the two streaming endpoints can't drift apart in event format either.

    GET with query params (not POST with a body) because the browser's
    EventSource API - what the frontend uses for SSE - can only issue GET
    requests and cannot attach a JSON body. Validation still happens before
    any of this runs (see _custom_patient_query_params / CUSTOM_PATIENT_BOUNDS),
    so bad values 422 immediately instead of opening a broken stream.

    NOTE: registered BEFORE /api/analyze/{patient_id}/stream on purpose, same
    reasoning as /api/analyze/custom vs /api/analyze/{patient_id} above -
    FastAPI matches routes in registration order and {patient_id} would
    otherwise swallow 'custom' as a literal patient ID.
    """
    patient_row = _build_custom_patient_row(payload)
    return StreamingResponse(_stream_pipeline_events(patient_row), media_type="text/event-stream")


@app.get("/api/analyze/{patient_id}/stream", tags=["complication-screening"])
def analyze_patient_stream(patient_id: str):
    """Streams pipeline progress as Server-Sent Events: one event per completed
    graph node (4 specialists + synthesis, in whatever order they finish -
    they run in parallel), then a final `pipeline_complete` benchmark summary.

    GET (not POST) because SSE requires GET in most browser EventSource
    implementations.
    """
    patient_row = _get_patient_row(patient_id)
    return StreamingResponse(_stream_pipeline_events(patient_row), media_type="text/event-stream")


@app.get("/api/status", tags=["info"])
def get_status():
    """Returns the current LLM status of the backend (fireworks, featherless, or offline),
    the specific route Featherless took (direct vs AMD notebook fallback), plus the
    actual model string in use so the Benchmark tab can show e.g.
    'Qwen/Qwen2.5-7B-Instruct via featherless (direct)' instead of just a provider name.
    """
    from agent_core import FIREWORKS_MODEL, FEATHERLESS_MODEL, NOTEBOOK_OLLAMA_MODELS
    provider = get_llm_status()
    model_map = {"fireworks": FIREWORKS_MODEL, "featherless": FEATHERLESS_MODEL, **NOTEBOOK_OLLAMA_MODELS}
    return {
        "llm_status": "offline" if provider is None else provider,
        "provider_detail": get_provider_detail(),
        "model": model_map.get(provider),
    }


# Human-facing labels + descriptions for the provider switcher dropdown.
# "amd_notebook_qwen"/"amd_notebook_gemma" both route through
# amd_compute/amd_notebook_relay_server.ipynb on the AMD Developer Cloud
# instance, but run that model LOCALLY via Ollama on the AMD GPU - genuine
# on-device compute, not a hosted-API relay. Requires that notebook's last
# cell to be running (with Ollama serving qwen2.5-coder:7b/gemma2).
_PROVIDER_LABELS = {
    "fireworks": {
        "label": "Fireworks: gpt-oss-120b",
        "description": "Main provider. Hosted API, real credits.",
    },
    # FEATHERLESS (TESTING ONLY) - delete this entry when removing Featherless
    # (see backend/DELETE_FEATHERLESS.md).
    "featherless": {
        "label": "Featherless (Direct)",
        "description": "Calls api.featherless.ai directly. Testing-only fallback.",
    },
    "amd_notebook_qwen": {
        "label": "AMD Notebook: Qwen",
        "description": "Runs Qwen2.5-Coder 7B on AMD Developer Cloud's GPU.",
        "amd_compute": True,
    },
    "amd_notebook_gemma": {
        "label": "AMD Notebook: Gemma",
        "description": "Runs Gemma 2 on AMD Developer Cloud's GPU.",
        "amd_compute": True,
    },
}


class ProviderSelection(BaseModel):
    # None/omitted means "auto" - go back to the normal failover chain.
    provider: Optional[str] = None


@app.get("/api/providers", tags=["info"])
def list_providers():
    """Lists every selectable LLM provider for the frontend's provider switcher,
    plus which one (if any) is currently manually forced. "configured" reflects
    whether the relevant env var(s) are actually set - NOT whether the provider
    is reachable right now (that's what /api/status's connectivity check is for).
    """
    from agent_core import FIREWORKS_API_KEY, FEATHERLESS_API_KEY, NOTEBOOK_RELAY_URL
    configured_map = {
        "fireworks": bool(FIREWORKS_API_KEY),
        "featherless": bool(FEATHERLESS_API_KEY),  # FEATHERLESS (TESTING ONLY) - delete this line too
        "amd_notebook_qwen": bool(NOTEBOOK_RELAY_URL),
        "amd_notebook_gemma": bool(NOTEBOOK_RELAY_URL),
    }
    return {
        "providers": [
            {
                "id": pid,
                "label": _PROVIDER_LABELS[pid]["label"],
                "description": _PROVIDER_LABELS[pid]["description"],
                "configured": configured_map[pid],
                "amd_compute": _PROVIDER_LABELS[pid].get("amd_compute", False),
            }
            for pid in PROVIDER_IDS
        ],
        "forced_provider": get_forced_provider(),  # null means "auto"
    }


@app.post("/api/providers/select", tags=["info"])
def select_provider(payload: ProviderSelection):
    """Manually pins the backend to a single provider ("featherless", "fireworks",
    "amd_notebook_qwen", or "amd_notebook_gemma"), or pass provider=null to
    return to the normal auto-failover chain. Takes effect immediately for the
    next LLM call.
    """
    if payload.provider is not None and payload.provider not in PROVIDER_IDS:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown provider '{payload.provider}'. Must be one of {PROVIDER_IDS} or null.",
        )
    set_forced_provider(payload.provider)
    return {
        "forced_provider": get_forced_provider(),
        "llm_status": get_llm_status(),
        "provider_detail": get_provider_detail(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)