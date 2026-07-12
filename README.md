<div align="center">

# 🩺 Diabetic Complication Swarm
### (GlycoSwarm AI)

**A multi-agent early-warning system for diabetic complications**

Built for **AMD Developer Hackathon: ACT II — Track 3 (Unicorn Track)**

[Live Demo](https://glycoswarm-ai.vercel.app/) · [Slide Deck](#) · [Demo Video](#)

[![Deployed on Vercel](https://img.shields.io/badge/Vercel-deployed-000000?logo=vercel&logoColor=white)](https://glycoswarm-ai.vercel.app/)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](backend)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js-000000?logo=nextdotjs&logoColor=white)](frontend)
[![Orchestration](https://img.shields.io/badge/Orchestration-LangGraph-1C3C3C)](backend/run_pipeline.py)
[![Compute](https://img.shields.io/badge/Compute-AMD%20MI300X-ED1C24?logo=amd&logoColor=white)](#amd-developer-cloud-compute-track-3)
[![Model](https://img.shields.io/badge/Model-Gemma%204%2026B-4285F4?logo=google&logoColor=white)](#llm-providers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## What it does

Diabetic Complication Swarm is a prototype clinical decision-support experience that combines a Next.js dashboard with a Python multi-agent backend. It helps a clinician quickly review a patient profile and see which diabetes-related complication risks may deserve closer attention — before they become symptomatic or irreversible.

The backend screens **already-diagnosed diabetic patients** — it does not diagnose diabetes itself — across four specialist lenses, run in parallel:

- **Renal** — eGFR, UACR, creatinine
-  **Neuropathy** — years with diabetes, A1c
-  **Retinal** — systolic BP, years with diabetes
-  **Cardiovascular** — LDL, HDL, triglycerides

Each specialist agent writes and executes its own Python scoring code against the patient's real lab values (not a static lookup table), producing a computed risk score, a flag, and reasoning that names the exact cutoffs used. A synthesis agent then combines all four outputs into one ranked referral recommendation, and an optional report agent turns that into a plain-language "Discovery Brief."

The frontend presents this as a live dashboard with:

- patient selection (sample dataset patients, or custom manually-entered labs)
- a live analysis trigger with streaming (SSE) agent-by-agent progress
- an organ-risk visualization
- a live reasoning terminal
- a provider switcher (pin the backend to a specific LLM provider)
- a benchmark tab (real per-run latency/call-count stats)
- a report export action

> ⚠️ This is a working prototype, not a production medical tool. See [What's real vs. prototype](#whats-real-vs-what-is-demoprototype) below.

## Architecture

```
Patient Selection (dataset or custom input)
       │
       ▼
┌────────────────────────────────────┐
│   Specialist Fan-Out (parallel,    │
│   via LangGraph StateGraph)        │
│                                     │
│   Renal · Neuropathy ·             │
│   Retinal · Cardiovascular         │
└────────────────────────────────────┘
       │
       ▼
   Synthesis Agent
   (ranks urgency, recommends next step)
       │
       ▼
   Dashboard Output
   (organ-risk map, live reasoning terminal,
    exportable Discovery Brief)
```

Orchestration is a directed graph (LangGraph `StateGraph`), not a flat script: all 4 specialists fan out from `START` in true parallel threads and fan back in to a single synthesis node.

## AMD Developer Cloud compute (Track 3)

The live backend's **main LLM provider is Gemma 4 26B, running genuinely on-GPU via Ollama on an AMD MI300X GPU droplet** (AMD Developer Cloud). This is the primary AMD compute path for the project — not a side notebook or an offline demo. It's what actually serves every specialist, synthesis, and report call during a real patient analysis, with **Fireworks GLM 5.2** (serverless) as the fallback if the droplet isn't reachable.

### How it's wired up

- **Model serving** — Gemma 4 26B (MoE) is pulled and served locally on the droplet via [Ollama](https://ollama.com), talking to the GPU through ROCm.
- **Backend connection** — the FastAPI backend (`backend/agent_core.py`) calls Ollama's **native** `/api/chat` endpoint directly (not the OpenAI-compatible `/v1/chat/completions` path — Gemma 4 has a known Ollama bug on that endpoint where its reasoning preamble can't be disabled, which was truncating generated code). No third-party API sits in between for this provider.
- **Fallback** — if the AMD provider isn't reachable, the backend automatically fails over to Fireworks GLM 5.2 (serverless). There is no rule-based/deterministic fallback for either path — if neither is reachable, the affected specialist/synthesis/report step honestly reports itself **"unavailable"** instead of faking output.

### How to verify it's genuinely on-GPU

- The dashboard's **provider switcher** shows which provider actually served the last request in real time — labeled "AMD MI300X: Gemma 4 26B" vs. "Fireworks: GLM 5.2" — not just a static tag.
- The **Benchmark tab** reports live per-run stats (`total_duration_ms`, `llm_calls_made`, active provider) pulled straight from the pipeline, not hardcoded.
- `GET /api/status` and `GET /api/providers` on the backend expose the same information programmatically, including which model string is actually in use.

## LLM providers

The live backend tries exactly two providers, in order:

1. **`amd_notebook_gemma4`** — Gemma 4 26B, genuine on-GPU inference via Ollama on an AMD MI300X droplet (main provider)
2. **`fireworks_serverless_fast`** — Fireworks GLM 5.2 (serverless) — fallback

If neither is reachable, specialists/synthesis/report all honestly report themselves **"unavailable"** rather than falling back to canned or rule-based output — this is true end-to-end, including the Discovery Brief generator (`report_agent.py`), not just the specialists. See `backend/agent_core.py` for the full provider-chain implementation.

## What's real vs. what is demo/prototype

This project is a working prototype, not a production medical tool.

**Real:**
- The backend pipeline is real and functional, powered live by LLM-generated, sandboxed-executed Python — not a rule-based decision tree
- The patient data path uses real NHANES 2017–2018 patient records (see `build_real_dataset.py`), not synthetic data
- Custom patient input is fully built — any hypothetical case can be analyzed, not just the fixed dataset
- The overall architecture is real: frontend, backend API, agent execution, and synthesis flow are all implemented end-to-end
- Multi-provider failover (AMD primary, Fireworks fallback) is real and user-triggerable via the provider switcher

**Prototype/demo:**
- The UI is a polished prototype experience, not a full clinical product
- Specialist reasoning is generated through a sandboxed agent workflow, LLM-only (AMD MI300X on-GPU Gemma 4 26B via Ollama, falling back to Fireworks GLM 5.2) — there is no rule-based fallback; if neither provider is reachable, the affected step honestly reports itself unavailable
- Intended for demo, exploration, and iteration — not direct clinical deployment

## Repository structure

```
.
├── backend/
│   ├── main.py                    # FastAPI app + all routes
│   ├── run_pipeline.py            # LangGraph graph def + CLI runner (--patient <id>)
│   ├── agent_core.py               # LLM provider chain (AMD Ollama + Fireworks), sandboxed code execution
│   ├── specialists.py              # 4 specialist system prompts + strict code-format rules
│   ├── synthesis_agent.py          # Synthesis agent
│   ├── report_agent.py             # Discovery Brief generator
│   ├── build_real_dataset.py       # Builds real_patients.csv from raw NHANES .xpt files
│   ├── real_patients.csv           # Generated dataset (not committed raw NHANES source)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                    # Next.js app router pages
│   │   ├── components/             # Shared UI components
│   │   ├── features/dashboard/components/   # Dashboard-specific components
│   │   ├── lib/                    # API client, helpers
│   │   └── types/                  # TypeScript types
│   ├── .env.local.example
│   ├── package.json
│   └── tailwind.config.ts
└── README.md
```

## API reference (backend)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` , `/api/info` | System description (what it does / doesn't do) |
| GET | `/api/patients` | List sample dataset patients |
| POST | `/api/analyze/{patient_id}` | Run full pipeline for a dataset patient (blocking) |
| GET | `/api/analyze/{patient_id}/stream` | Same, streamed as Server-Sent Events |
| POST | `/api/analyze/custom` | Run full pipeline for a manually-entered patient (blocking) |
| GET | `/api/analyze/custom/stream` | Same, streamed as SSE (query params, since `EventSource` can't send a body) |
| GET | `/api/analyze/custom/validate` | Validate custom input without running the pipeline |
| POST | `/api/report/{patient_id}` | Generate a Discovery Brief from an already-computed analysis |
| GET | `/api/status` | Current active provider + model string |
| GET | `/api/providers` | List selectable providers + configuration state |
| POST | `/api/providers/select` | Manually pin the backend to one provider (or `null` for auto) |

## Getting started

### Prerequisites
- Python 3.12
- Node.js 18+
- A Fireworks AI API key
- (For the primary on-GPU provider) An AMD Developer Cloud MI300X droplet running Ollama with `gemma4:26b` pulled
- Raw NHANES 2017–2018 `.xpt` files (`DEMO_J`, `BPX_J`, `GHB_J`, `BIOPRO_J`, `HDL_J`, `TCHOL_J`, `TRIGLY_J`, `ALB_CR_J`, `DIQ_J`) if you want to regenerate `real_patients.csv` yourself — otherwise the committed CSV is used as-is

### 1. Backend — verify the pipeline runs

```bash
cd backend

# Create a virtual environment with Python 3.12
python3.12 -m venv .venv          # macOS / Linux
py -3.12 -m venv .venv            # Windows (Python Launcher)

# Activate it
source .venv/bin/activate         # macOS / Linux
.venv\Scripts\Activate.ps1        # Windows PowerShell

pip install -r requirements.txt
cp .env.example .env              # fill in FIREWORKS_API_KEY / AMD_OLLAMA_URL

python run_pipeline.py --patient P93758
```

This runs the full pipeline for a sample patient end-to-end and confirms the workflow is operational before you start the API server.

### 2. Start the FastAPI backend

```bash
cd backend
python main.py
```

The API will be available at `http://localhost:8000` — see [API reference](#api-reference-backend) above, or interactive docs at `http://localhost:8000/docs`.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Dashboard: `http://localhost:3000`

### 4. Environment configuration

**Frontend** (`frontend/.env.local`):
- `BACKEND_BASE_URL` — defaults to `http://localhost:8000`

**Backend** (`backend/.env`) — at least one provider must be configured:
- `AMD_OLLAMA_URL` — points at the AMD GPU droplet's Ollama instance (as its `/v1/chat/completions` URL; the native `/api/chat` path is derived automatically); enables the primary on-GPU Gemma 4 26B provider
- `AMD_OLLAMA_MODEL` — defaults to `gemma4:26b`
- `FIREWORKS_API_KEY` — required for the Fireworks GLM 5.2 fallback provider
- `FIREWORKS_FAST_SERVERLESS_MODEL` — defaults to `accounts/fireworks/models/glm-5p2`

There is no rule-based fallback — without at least one of these configured, specialists/synthesis/report will all honestly report themselves unavailable rather than fabricate output.

## Current project status

The project is complete and demo-ready for submission:

| Component | Status |
|---|---|
| Core agent pipeline (4 specialists + synthesis) | ✅ Implemented and working |
| Custom patient input (dataset-free analysis) | ✅ Implemented, validated, streaming supported |
| Dashboard UI | ✅ Scaffolded and interactive |
| AMD GPU provider (live, primary) | ✅ Serving real requests via Ollama on MI300X |
| Provider switcher + benchmark tab | ✅ Live, reads real backend state |
| Discovery Brief generation | ✅ LLM-only, honest-unavailable on failure |
| Local startup path | ✅ Documented and verified |
| Live deployment (Railway + Vercel) | ✅ Live |

## Team

Built by **Snowfall** for AMD Developer Hackathon: ACT II, Track 3 (Unicorn Track).

## License

MIT
