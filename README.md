# Diabetic Complication Swarm

Diabetic Complication Swarm is a prototype clinical decision-support experience that combines a Next.js dashboard with a Python multi-agent backend. It presents diabetic complication risk across several organ systems and shows how a panel of specialist agents can synthesize early-warning signals into a simple referral recommendation.

## What the app does

The system is designed to help a clinician quickly review a patient profile and understand which diabetes-related complication risks may deserve closer attention. The backend evaluates a patient across four specialist lenses:

- Renal risk
- Neuropathy risk
- Retinal risk
- Cardiovascular risk

Each specialist produces a risk score and reasoning, and a synthesis step combines those outputs into a concise recommendation.

The frontend presents that workflow in a dashboard with:

- patient selection
- a live analysis trigger
- an organ-risk visualization
- a live reasoning terminal
- a report export action
- an AMD Compute panel showing offline patient-similarity + reasoning-QA results produced on an AMD Instinct MI300X (see below)

## AMD Developer Cloud compute (Track 3)

Alongside the live Featherless/Fireworks-backed backend, this project has a genuinely separate offline workload that runs on an AMD Instinct MI300X via the AMD Developer Cloud: `amd_compute/specialist_eval_and_embeddings.ipynb`. It does two things the live path doesn't:

1. Encodes every patient's lab profile into a similarity embedding (sentence-transformer, run on the AMD GPU) so the dashboard can show "similar patients" next to a result.
2. Judges a batch of the live pipeline's specialist reasoning text with a local model served via Ollama, also on the AMD GPU, as an automated QA signal that doesn't depend on the live API.

Outputs (`amd_compute/outputs/*.json`, `*.npy`, `run_log.txt`) are committed to the repo as proof of the run, and the dashboard's **AMD Compute** panel reads them live off disk — it reports honestly when the notebook hasn't been run yet rather than faking data. Full details, setup, and how judges can verify AMD usage: [`amd_compute/README.md`](amd_compute/README.md).

## What is real vs. what is demo/prototype

This project is a working prototype, not a production medical tool.

### Real parts

- The backend pipeline is real and functional.
- The patient data path is based on a real patient dataset workflow.
- The specialist logic uses explicit clinical-style rules and thresholds.
- The overall architecture is real: frontend, backend API, agent execution, and synthesis flow are all implemented.

### Prototype/demo parts

- The UI is a polished prototype experience, not a full clinical product.
- The specialist reasoning is generated through a sandboxed agent workflow and can be driven by local fallback logic or an LLM backend if configured.
- The system is intended for demo, exploration, and iteration, not for direct clinical deployment.

### Still pending

- Full end-to-end production hardening
- Authentication and role-based access
- Better data provenance and patient safety controls
- More polished reporting and export workflows
- Complete deployment and environment management

## How to run it locally

### 1. Backend

From the repository root:

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

pip install -r requirements.txt
python run_pipeline.py --patient P93758
```

This runs the backend pipeline for a sample patient and verifies that the workflow is operational.

### 2. Start the FastAPI backend

```bash
cd backend
python main.py
```

The API will be available at:

- http://localhost:8000/api/patients
- http://localhost:8000/api/analyze/<patient_id>

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp env.local.example .env.local
npm run dev
```

The dashboard will be available at:

- http://localhost:3000

### 4. Environment notes

The frontend uses a simple environment variable bridge:

- BACKEND_BASE_URL defaults to http://localhost:8000

If you want to use an LLM backend instead of the deterministic fallback logic, set the relevant environment variables in the backend environment before running the pipeline.

## Current project status

The project is now at a demo-ready prototype stage:

- core agent pipeline: implemented and working
- dashboard UI: scaffolded and interactive
- local startup path: improved and clearer
- documentation: rewritten for clarity

The remaining work is primarily about refinement, polish, and product hardening.

