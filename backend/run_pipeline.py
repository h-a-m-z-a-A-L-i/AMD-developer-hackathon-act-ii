"""
run_pipeline.py
------------------
The full end-to-end demo pipeline, running on REAL NHANES 2017-2018 patient data:
  1. Load real_patients.csv (built by build_real_dataset.py from real NHANES XPT files)
  2. For each patient, run all 4 specialist agents
  3. Run the synthesis agent to get a referral recommendation

Usage:
    python3 run_pipeline.py                  # runs on all patients, full report
    python3 run_pipeline.py --patient P93758  # runs on just one patient (good for live demo)

To use REAL Fireworks LLM agents instead of the rule-based fallback:
    export FIREWORKS_API_KEY="your-key-here"
    python3 run_pipeline.py
(Without the key set, this runs the deterministic fallback logic, using real published
clinical cutoffs (CKD-EPI eGFR, UACR, lipid thresholds) - fully functional for
testing/rehearsing the demo before your API key is ready.)

NOTE: since this is real de-identified survey data, there's no "answer key" telling you
which patient truly has which complication (unlike an earlier synthetic-data version
would have) - that's expected. Your pitch is about the reasoning/architecture using
real validated clinical formulas, not about proving accuracy against ground truth
you don't have access to for real people.
"""

import argparse
import pandas as pd

from specialists import SPECIALISTS, run_specialist
from synthesis_agent import synthesize
from agent_core import has_llm


def run_patient(patient_row: dict, verbose=True):
    if verbose:
        mode = "LIVE FIREWORKS LLM AGENTS" if has_llm() else "RULE-BASED FALLBACK (no API key set)"
        print(f"\n{'='*70}")
        print(f"Patient {patient_row['patient_id']}  |  Mode: {mode}")
        print(f"A1c: {patient_row['a1c_percent']}%  |  Age: {patient_row['age']}  |  "
              f"Sex: {patient_row['sex']}")
        print(f"{'='*70}")

    specialist_results = []
    for name in SPECIALISTS:
        result = run_specialist(name, patient_row)
        specialist_results.append(result)
        if verbose:
            flag_marker = "⚠️  FLAGGED" if result["flag"] else "   clear"
            print(f"[{name.upper():15s}] risk={result['risk_score']:.2f}  {flag_marker}")
            print(f"                  -> {result['reasoning']}")

    synthesis = synthesize(patient_row, specialist_results)
    if verbose:
        print(f"\n>>> SYNTHESIS: {synthesis['recommendation']}\n")

    return specialist_results, synthesis


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--patient", type=str, default=None, help="Run on just one patient ID, e.g. P009")
    parser.add_argument("--check-accuracy", action="store_true", help="Compare results against answer_key.csv")
    args = parser.parse_args()

    df = pd.read_csv("real_patients.csv")

    if args.patient:
        df = df[df["patient_id"] == args.patient]
        if df.empty:
            print(f"No patient with ID {args.patient} found.")
            return

    all_synthesis = []
    for _, row in df.iterrows():
        patient_row = row.to_dict()
        _, synthesis = run_patient(patient_row)
        all_synthesis.append({"patient_id": patient_row["patient_id"], "top_concern": synthesis["top_concern"]})

    results_df = pd.DataFrame(all_synthesis)
    print(f"\n{'#'*70}")
    print("SUMMARY - top concern flagged per patient")
    print(f"{'#'*70}")
    print(results_df["top_concern"].value_counts().to_string())


if __name__ == "__main__":
    main()
