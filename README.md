# Backend Overview

This backend is the reasoning engine behind the Diabetic Complication Swarm (GlycoSwarm AI). It loads patient data, runs specialist-style analysis across multiple diabetes-related complication domains, and produces a synthesis recommendation that can be shown in the frontend dashboard.

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
- [specialists.py](specialists.py) — specialist system prompts, strict code-format rules, and orchestration for each risk domain
- [synthesis_agent.py](synthesis_agent.py) — synthesis layer that turns specialist results into a simple referral-style recommendation
- [agent_core.py](agent_core.py) — the two-provider LLM chain (AMD Gemma 4 26B via Ollama on the AMD GPU droplet, Fireworks GLM 5.2) plus sandboxed code execution
- [build_real_dataset.py](build_real_dataset.py) — prepares the patient dataset from source files
- [real_patients.csv](real_patients.csv) — the patient dataset used by the pipeline

## Data source and realism

The backend is built around a real patient dataset workflow using CDC NHANES 2017–2018 survey data. The project uses public, de-identified survey data rather than synthetic patient records.

That said, this is a demo/prototype system and not a clinical-grade decision support product (see the root README's "What's real vs. what is demo/prototype" section). NHANES is a single-visit survey dataset, so it does not contain longitudinal glucose trends or full diabetes-duration history. The specialists therefore use simplified but transparent proxy logic where needed, and the backend explicitly communicates that limitation in its reasoning output.

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

## LLM providers and honest-unavailable behavior

There is no rule-based/deterministic fallback. The backend tries exactly two LLM providers, in order:

1. **Gemma 4 26B via Ollama**, running genuinely on-GPU - main provider. Points at our own AMD Cloud GPU droplet (MI300X/ROCm).
2. **Fireworks GLM 5.2** (serverless, direct API call) - fallback provider, used only if AMD isn't reachable.

If neither provider is reachable, or the LLM-generated code fails after retries, the affected specialist/synthesis/report step honestly reports itself as "unavailable" instead of silently substituting canned or rule-based output. See `agent_core.py` for the provider chain.

## Current status

The backend pipeline is complete and demo-ready:

- pipeline execution: working
- specialist analysis: implemented
- synthesis layer: implemented
- API surface: available
- local startup path: documented and verified

See the root [README.md](../README.md#current-project-status) for the full project-level status table.
