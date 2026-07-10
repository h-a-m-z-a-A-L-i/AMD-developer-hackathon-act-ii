# AMD Compute Workflow — Offline Patient-Similarity & Specialist-Reasoning Evaluation

This folder is the Track 3 deliverable: it runs on the AMD Developer Cloud Jupyter
environment and is a genuine, complementary part of the project's workflow — it is
**not** a duplicate of the live backend inference path.

## Why this exists (hybrid architecture)

The live product (`backend/agent_core.py`) calls the **Featherless API** for the
four specialist agents and the synthesis agent. That live path is unchanged.

The AMD notebook (`specialist_eval_and_embeddings.ipynb`) runs a **separate, offline
model** directly on the AMD GPU to do two things the live path doesn't do:

1. **Patient-similarity embeddings** — encodes every patient in
   `backend/real_patients.csv` into a vector (via a sentence-embedding model run
   locally on the AMD GPU) so the dashboard can eventually show "similar patients"
   context next to a risk result. Saved as `outputs/patient_embeddings.npy` +
   `outputs/patient_index.json`.
2. **Offline reasoning-quality evaluation** — takes a batch of specialist reasoning
   text produced by the live Featherless pipeline (exported ahead of time from
   `run_pipeline.py`) and scores it locally on AMD hardware against a fixed rubric
   (does it cite the actual lab values, does it stay within the stated risk domain,
   is it internally consistent with the numeric risk_score). This gives the team an
   automated, repeatable QA signal that doesn't depend on the live API at demo time.

   The judge model is switchable (`JUDGE_MODEL` in the notebook): set it to any
   locally-pullable Ollama model — `'llama3'` or `'gemma2'` (Gemma, run locally) —
   and it's pulled and run directly on the AMD instance's GPU via Ollama. No
   external/hosted API is involved either way, so every run is genuine Track 3
   compute. Each run writes its own `outputs/reasoning_eval_report_<model>.json`
   (e.g. `reasoning_eval_report_llama3.json`, `reasoning_eval_report_gemma2.json`)
   instead of overwriting a single file, so you can run the cell once per model and
   commit both — the dashboard's AMD Compute panel then lets you toggle between
   whichever ones actually exist.

Both tasks are genuinely useful, genuinely run on AMD hardware, and are genuinely
separate from the live agent — they're not a thin wrapper around Featherless.

## How judges can verify AMD usage

- The notebook itself (`specialist_eval_and_embeddings.ipynb`) contains a first
  cell that prints `rocm-smi` / `torch.cuda` (ROCm build) device info — run this
  cell first when demoing, and its output should be included in the committed
  notebook (do not clear outputs before committing).
- All artifacts the notebook produces are written to `amd_compute/outputs/` and
  committed to the repo:
  - `outputs/patient_embeddings.npy`, `outputs/patient_index.json`
  - `outputs/reasoning_eval_report_<model>.json` (one per judge model run, e.g.
    `reasoning_eval_report_llama3.json` / `reasoning_eval_report_gemma2.json` —
    per-sample scores + aggregate summary)
  - `outputs/run_log.txt` (stdout capture of the notebook run, including the
    device-info cell output and timing for each stage)
- The video demo should show the notebook actively running on the AMD Developer
  Cloud environment (not locally) for at least the device-info + embedding cells,
  then cut to the committed `outputs/` artifacts as proof the run completed.

## Folder contents

- `specialist_eval_and_embeddings.ipynb` — the notebook itself
- `outputs/` — committed artifacts from the last notebook run (logs + results)
- `requirements.txt` — Python deps for the AMD notebook environment (separate from
  `backend/requirements.txt` since this runs in a different environment)

## Dashboard integration

**Removed.** This used to have a dedicated **AMD Compute** panel in the dashboard
that read the notebook's outputs live off disk via two backend endpoints. That
panel added little value beyond the live specialist-screening pipeline and has
been removed from the frontend, backend (`backend/main.py`), and the notebook
relay (`amd_compute/amd_notebook_relay_server.ipynb`) to keep the codebase
lean. The corresponding Next.js proxy routes
(`frontend/src/app/api/amd-compute/`) have been renamed to `*.deprecated` so
they no longer register as live routes.

This notebook and its `outputs/` artifacts still exist purely as a standalone
Track 3 compute demonstration (see "How judges can verify AMD usage" above) -
run it and commit `outputs/` if your hackathon's judging criteria specifically
reward this kind of extra AMD GPU usage; otherwise it's optional and doesn't
affect the live product at all.

## Relationship to the live backend

| | Live backend (`backend/agent_core.py`) | AMD notebook (`amd_compute/`) |
|---|---|---|
| Where it runs | Wherever the FastAPI server is hosted | AMD Developer Cloud Jupyter |
| Model | Featherless API (hosted) | Local model loaded in-notebook |
| Purpose | Real-time specialist risk scoring for the demo | Offline similarity search + QA scoring |
| Required for the demo to function | Yes | No — it's a complementary offline artifact |
