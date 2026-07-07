# Backend Overview

This backend is the reasoning engine behind the Diabetic Complication Swarm prototype. It loads patient data, runs specialist-style analysis across multiple diabetes-related complication domains, and produces a synthesis recommendation that can be shown in the frontend dashboard.

## What the backend does

The system currently supports four specialist analysis paths:

- Renal risk
- Neuropathy risk
- Retinal risk
- Cardiovascular risk

Each specialist produces a risk score, a flag, and reasoning. A synthesis layer then combines those outputs into a concise recommendation for the clinician-facing experience.

## Core files

- [main.py](main.py) — FastAPI entry point that exposes patient listing and analysis endpoints for the frontend
- [run_pipeline.py](run_pipeline.py) — end-to-end pipeline runner for executing the workflow on one or more patients
- [specialists.py](specialists.py) — specialist analysis logic and fallback rules for each risk domain
- [synthesis_agent.py](synthesis_agent.py) — synthesis layer that turns specialist results into a simple referral-style recommendation
- [agent_core.py](agent_core.py) — wrapper for LLM-based execution and safe fallback behavior
- [build_real_dataset.py](build_real_dataset.py) — prepares the patient dataset from source files
- [real_patients.csv](real_patients.csv) — the patient dataset used by the pipeline

## Data source and realism

The backend is built around a real patient dataset workflow using CDC NHANES 2017–2018 survey data. The project uses public, de-identified survey data rather than synthetic patient records.

That said, this is still a prototype and not a clinical-grade decision support product. NHANES is a single-visit survey dataset, so it does not contain longitudinal glucose trends or full diabetes-duration history. The specialists therefore use simplified but transparent proxy logic where needed, and the backend explicitly communicates that limitation in its reasoning output.

## How the pipeline works

1. Load the patient dataset.
2. Run each specialist over the patient record.
3. Collect the specialist risk outputs.
4. Synthesize those outputs into a final recommendation.
5. Return the results to the frontend or print them in the terminal.

## Running it locally

### 1. Create and activate a Python environment

This project is currently expected to run with Python 3.12. If your machine defaults to Python 3.13, override it to 3.12 when creating the environment.

```bash
cd backend

# Create virtual environment with Python 3.12
# On macOS / Linux:
python3.12 -m venv .venv
# On Windows (using the Python Launcher):
py -3.12 -m venv .venv

# Activate virtual environment
# On macOS / Linux:
source .venv/bin/activate
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the pipeline directly

```bash
python run_pipeline.py --patient P93758
```

This runs the workflow for a sample patient and demonstrates the full analysis loop.

### 4. Start the API server

```bash
python main.py
```

The API will be available at:

- http://localhost:8000/api/patients
- http://localhost:8000/api/analyze/<patient_id>

## LLM and fallback behavior

The backend can run in two modes:

- Deterministic fallback mode: works without an API key and uses rule-based logic.
- LLM-assisted mode: if the relevant environment variables are present, the system can use an LLM backend for generation and execution.

If the LLM path fails at runtime, the system falls back gracefully so the demo remains usable.

## Current status

The backend is now in a working prototype stage:

- pipeline execution: working
- specialist analysis: implemented
- synthesis layer: implemented
- API surface: available
- local startup path: improved for reliability

The remaining work is mainly around hardening, clearer configuration, and polishing the overall product experience.
