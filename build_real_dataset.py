"""
build_real_dataset.py
------------------------
Merges real NHANES 2017-2018 lab files into one clean patient-level CSV,
using validated clinical formulas (not invented heuristics) wherever possible.

Input files expected in the `nhanes_data/` subfolder next to this script
(create it and drop the .xpt files in, or edit NHANES_DATA_DIR below):
  DEMO_J.xpt, BPX_J.xpt, GHB_J.xpt, BIOPRO_J.xpt, HDL_J.xpt, TCHOL_J.xpt,
  TRIGLY_J.xpt, ALB_CR_J.xpt, DIQ_J.xpt

Output: real_patients.csv (written next to this script)
"""

from pathlib import Path

import pandas as pd
import numpy as np

BACKEND_DIR = Path(__file__).resolve().parent
NHANES_DATA_DIR = BACKEND_DIR / "nhanes_data"

FILES = {
    "DEMO": NHANES_DATA_DIR / "DEMO_J.xpt",
    "BPX": NHANES_DATA_DIR / "BPX_J.xpt",
    "GHB": NHANES_DATA_DIR / "GHB_J.xpt",
    "BIOPRO": NHANES_DATA_DIR / "BIOPRO_J.xpt",
    "HDL": NHANES_DATA_DIR / "HDL_J.xpt",
    "TCHOL": NHANES_DATA_DIR / "TCHOL_J.xpt",
    "TRIGLY": NHANES_DATA_DIR / "TRIGLY_J.xpt",
    "ALB_CR": NHANES_DATA_DIR / "ALB_CR_J.xpt",
    "DIQ": NHANES_DATA_DIR / "DIQ_J.xpt",
}

missing = [str(path) for path in FILES.values() if not path.exists()]
if missing:
    raise FileNotFoundError(
        "Missing NHANES source file(s):\n  " + "\n  ".join(missing) +
        f"\n\nPlace the required .xpt files in {NHANES_DATA_DIR} before running this script."
    )

dfs = {name: pd.read_sas(path, format="xport") for name, path in FILES.items()}

# --- Select only the columns we need from each file ---
demo = dfs["DEMO"][["SEQN", "RIAGENDR", "RIDAGEYR"]].rename(
    columns={"RIAGENDR": "sex_code", "RIDAGEYR": "age"}
)
bpx = dfs["BPX"][["SEQN", "BPXSY1", "BPXSY2", "BPXSY3"]]
ghb = dfs["GHB"][["SEQN", "LBXGH"]].rename(columns={"LBXGH": "a1c_percent"})
bio = dfs["BIOPRO"][["SEQN", "LBXSCR"]].rename(columns={"LBXSCR": "creatinine_mg_dl"})
hdl = dfs["HDL"][["SEQN", "LBDHDD"]].rename(columns={"LBDHDD": "hdl_mg_dl"})
tchol = dfs["TCHOL"][["SEQN", "LBXTC"]].rename(columns={"LBXTC": "total_chol_mg_dl"})
trigly = dfs["TRIGLY"][["SEQN", "LBXTR", "LBDLDL"]].rename(
    columns={"LBXTR": "triglycerides_mg_dl", "LBDLDL": "ldl_mg_dl"}
)
albcr = dfs["ALB_CR"][["SEQN", "URDACT"]].rename(columns={"URDACT": "uacr_mg_g"})
diq = dfs["DIQ"][["SEQN", "DIQ010", "DID040"]].rename(
    columns={"DIQ010": "diabetes_diagnosed_code", "DID040": "age_at_diagnosis"}
)

# --- Average available systolic BP readings (some patients missing 2nd/3rd) ---
bpx["systolic_bp"] = bpx[["BPXSY1", "BPXSY2", "BPXSY3"]].mean(axis=1, skipna=True)
bpx = bpx[["SEQN", "systolic_bp"]]

# --- Merge everything on SEQN (respondent ID) ---
df = demo.merge(bpx, on="SEQN", how="inner")
df = df.merge(ghb, on="SEQN", how="inner")
df = df.merge(bio, on="SEQN", how="inner")
df = df.merge(hdl, on="SEQN", how="inner")
df = df.merge(tchol, on="SEQN", how="inner")
df = df.merge(trigly, on="SEQN", how="inner")  # smaller sample - fasting subsample only
df = df.merge(albcr, on="SEQN", how="inner")
df = df.merge(diq, on="SEQN", how="inner")

# --- Compute real diabetes duration from age at diagnosis (invalid codes 777/999 = don't know/refused) ---
df["age_at_diagnosis"] = df["age_at_diagnosis"].where(df["age_at_diagnosis"] < 200)
df["years_with_diabetes"] = df["age"] - df["age_at_diagnosis"]

# --- Filter to adults ---
df = df[df["age"] >= 18]

# --- Compute real eGFR using the 2021 CKD-EPI creatinine equation (race-free version) ---
def ckd_epi_2021(row):
    scr = row["creatinine_mg_dl"]
    age = row["age"]
    is_female = row["sex_code"] == 2  # NHANES: 1=Male, 2=Female
    if pd.isna(scr) or pd.isna(age):
        return np.nan
    if is_female:
        kappa, alpha, sex_factor = 0.7, -0.241, 1.012
    else:
        kappa, alpha, sex_factor = 0.9, -0.302, 1.0
    scr_ratio = scr / kappa
    min_term = min(scr_ratio, 1) ** alpha
    max_term = max(scr_ratio, 1) ** -1.200
    egfr = 142 * min_term * max_term * (0.9938 ** age) * sex_factor
    return round(egfr, 1)

df["egfr"] = df.apply(ckd_epi_2021, axis=1)
df["sex"] = df["sex_code"].map({1: "M", 2: "F"})

# --- Filter to the target population: CONFIRMED diagnosed diabetics (doctor-told, DIQ010==1) ---
# whose A1c looks "controlled" (6.5-7.2%), and who have valid duration data
target = df[
    (df["diabetes_diagnosed_code"] == 1) &
    (df["a1c_percent"] >= 6.5) & (df["a1c_percent"] <= 7.2)
].copy()
target = target.dropna(subset=[
    "egfr", "uacr_mg_g", "hdl_mg_dl", "ldl_mg_dl", "triglycerides_mg_dl",
    "systolic_bp", "years_with_diabetes"
])
target = target[target["years_with_diabetes"] >= 0]  # drop any bad-data edge cases

target = target.rename(columns={"SEQN": "patient_id"})
target["patient_id"] = "P" + target["patient_id"].astype(int).astype(str)

final_cols = [
    "patient_id", "age", "sex", "years_with_diabetes", "a1c_percent", "egfr", "uacr_mg_g",
    "creatinine_mg_dl", "ldl_mg_dl", "hdl_mg_dl", "triglycerides_mg_dl", "systolic_bp"
]
target = target[final_cols].reset_index(drop=True)

target.to_csv(BACKEND_DIR / "real_patients.csv", index=False)
print(f"Real NHANES patients matching target A1c range (6.5-7.2%): {len(target)}")
print(target.head(10).to_string(index=False))
