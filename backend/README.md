# Diabetic Complication Early-Warning System

## What this is
A working, tested pipeline using REAL patient data (CDC NHANES 2017-2018 survey):
reads real diabetic patient labs -> 4 specialist AI agents each assess a different
complication risk using validated clinical formulas -> a synthesis agent gives the
doctor a plain-English referral recommendation. Built for the AMD Unicorn Track hackathon.

## Files
- `build_real_dataset.py` — merges the raw NHANES .xpt files into `real_patients.csv`.
  Already run once; rerun if you download additional NHANES files or want to widen
  the A1c filter range.
- `real_patients.csv` — 159 REAL (de-identified) NHANES respondents whose A1c falls
  in the 6.5-7.2% "diagnosed but looks controlled" range. This is not synthetic data.
- `agent_core.py` — handles calling the real Fireworks LLM API + executing agent code safely
- `specialists.py` — the 4 specialist agents (renal, neuropathy, retinal, cardiovascular),
  using real validated clinical cutoffs (2021 CKD-EPI eGFR equation, published UACR/lipid thresholds)
- `synthesis_agent.py` — combines specialist outputs into one referral recommendation
- `run_pipeline.py` — the main script that runs everything end-to-end

## Where the real data comes from
CDC NHANES (National Health and Nutrition Examination Survey), 2017-2018 cycle.
Files used: DEMO_J (demographics), BPX_J (blood pressure), GHB_J (A1c),
BIOPRO_J (creatinine), HDL_J, TCHOL_J, TRIGLY_J (lipid panel), ALB_CR_J (urine
albumin/creatinine ratio for kidney marker). All public, de-identified, government
data — no privacy/IRB issues.

## Important honest limitation (mention this if asked)
NHANES is a single-visit survey, not longitudinal — so there's no real day-to-day
glucose variability or diabetes-duration-since-diagnosis data available. The
neuropathy and retinal specialists were adjusted to use age + A1c level as
real-but-simplified proxy markers instead, and their code explicitly says so in
its reasoning output. This is a normal, disclosed research limitation, not a fake result.

## How to run it RIGHT NOW (no API key needed)
```
pip install pandas numpy requests
python3 run_pipeline.py
```
This runs on all 159 real patients using rule-based fallback logic (real clinical
cutoffs, already tested end-to-end with no crashes) and prints a full report + summary.

To demo just one patient live (good for the pitch) — P93758 is a strong example,
flagged for 3 of 4 risk domains simultaneously with a real LDL of 354 mg/dL:
```
python3 run_pipeline.py --patient P93758
```

## How to switch to REAL Fireworks LLM agents (do this once you have hackathon API access)
```
export FIREWORKS_API_KEY="your-actual-key"
python3 run_pipeline.py
```
That's it — nothing else changes. The specialists will now have the LLM write and
execute its own analysis code live, instead of using the fallback template. If the
API call fails for any reason (bad key, rate limit, etc), it automatically falls
back to the rule-based version so the demo never just crashes.

You may need to change `FIREWORKS_MODEL` in `agent_core.py` to whatever model
name the hackathon actually gives you access to.

## What's left to build (the actual remaining work)
1. **Frontend/demo display** — right now this is a command-line tool. For the actual
   stage demo, you want something visual: a simple web page or Jupyter notebook
   view that shows each specialist "thinking" and the CSV data, live. This is the
   biggest remaining piece.
2. **AMD infra hookup** — confirm with organizers whether Fireworks credits route
   through AMD GPUs directly, or whether you need to also run something locally via
   ROCm to satisfy the "use of AMD platforms" judging criterion.
3. **Rehearse the demo narrative** — practice explaining WHY this matters (busy
   generalist doctor needs specialist-level synthesis) before diving into the tech.
4. **Optional: tune the LLM prompts** — once you have real API access, the specialist
   system prompts in `specialists.py` are a good starting point but may need
   iteration to get the LLM writing clean, working pandas code consistently.

## Known limitations (be upfront about these if judges ask)
- Data is fully synthetic, not real patient data (intentional — avoids
  privacy/access issues, and lets the demo be reliable).
- The rule-based fallback logic uses real clinical reference ranges (eGFR/UACR
  early cutoffs, lipid panel thresholds, etc.) but is NOT a validated medical
  tool — frame it as a hackathon prototype/proof-of-concept, not clinical software.
