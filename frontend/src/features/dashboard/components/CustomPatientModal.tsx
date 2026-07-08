"use client";

import { useState } from "react";
import { CustomPatientInput } from "@/types";

interface CustomPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CustomPatientInput) => void;
  isSubmitting: boolean;
  backendFieldErrors: Record<string, string>;
  clearBackendErrors: () => void;
}

// Sane NHANES baseline defaults matching the guidelines
const defaultValues: CustomPatientInput = {
  name: "",
  age: 55,
  sex: "F",
  years_with_diabetes: 10,
  a1c_percent: 6.5,
  egfr: 75.0,
  uacr_mg_g: 10.0,
  creatinine_mg_dl: 0.90,
  ldl_mg_dl: 120,
  hdl_mg_dl: 50,
  triglycerides_mg_dl: 150,
  systolic_bp: 130,
};

const bounds: Record<Exclude<keyof CustomPatientInput, "sex" | "name">, { min: number; max: number; label: string }> = {
  age: { min: 1, max: 120, label: "Age" },
  years_with_diabetes: { min: 0, max: 90, label: "Years with Diabetes" },
  a1c_percent: { min: 3.0, max: 20.0, label: "HbA1c (%)" },
  egfr: { min: 1.0, max: 200.0, label: "eGFR" },
  uacr_mg_g: { min: 0.0, max: 10000.0, label: "UACR (mg/g)" },
  creatinine_mg_dl: { min: 0.1, max: 20.0, label: "Creatinine (mg/dL)" },
  ldl_mg_dl: { min: 0.0, max: 1000.0, label: "LDL (mg/dL)" },
  hdl_mg_dl: { min: 0.0, max: 200.0, label: "HDL (mg/dL)" },
  triglycerides_mg_dl: { min: 0.0, max: 10000.0, label: "Triglycerides (mg/dL)" },
  systolic_bp: { min: 50.0, max: 260.0, label: "Systolic BP (mmHg)" },
};

export function CustomPatientModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  backendFieldErrors,
  clearBackendErrors,
}: CustomPatientModalProps) {
  const [form, setForm] = useState<CustomPatientInput>(defaultValues);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleChange = (name: keyof CustomPatientInput, val: any) => {
    setForm((prev) => ({ ...prev, [name]: val }));
    if (localErrors[name]) {
      setLocalErrors((prev) => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
    clearBackendErrors();
  };

  const handleLoadDemo = (type: "normal" | "high-risk") => {
    clearBackendErrors();
    setLocalErrors({});
    if (type === "normal") {
      setForm(defaultValues);
    } else {
      setForm({
        name: "",
        age: 65,
        sex: "M",
        years_with_diabetes: 20,
        a1c_percent: 8.5,
        egfr: 45.0,
        uacr_mg_g: 250.0,
        creatinine_mg_dl: 1.6,
        ldl_mg_dl: 210,
        hdl_mg_dl: 32,
        triglycerides_mg_dl: 380,
        systolic_bp: 155,
      });
    }
  };

  const validateLocal = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;

    // Validate ranges
    (Object.keys(bounds) as Array<keyof typeof bounds>).forEach((key) => {
      const val = form[key];
      const bound = bounds[key];
      if (typeof val !== "number" || isNaN(val)) {
        errors[key] = "Value must be a valid number.";
        isValid = false;
      } else if (val < bound.min || val > bound.max) {
        errors[key] = `Must be between ${bound.min} and ${bound.max}.`;
        isValid = false;
      }
    });

    setLocalErrors(errors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateLocal()) {
      onSubmit(form);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 sm:px-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Custom Complication Screening</h2>
            <p className="text-xs text-slate-500 mt-0.5">Enter custom patient demographics and lab readings to run a swarm analysis.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          
          {/* Quick presets */}
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Presets:</span>
            <button
              type="button"
              onClick={() => handleLoadDemo("normal")}
              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Mild Risk Baseline
            </button>
            <button
              type="button"
              onClick={() => handleLoadDemo("high-risk")}
              className="rounded-lg bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
            >
              High Risk Baseline
            </button>
          </div>

          {/* Row 1: Section headers */}
          <div className="grid grid-cols-2 gap-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Demographics & Profile</h3>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Renal Function</h3>
          </div>

          {/* Row 2: Full Name (left) | eGFR (right) — same visual row */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Jane Doe"
                value={form.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              {backendFieldErrors.name && (
                <p className="text-[10px] text-rose-500 mt-1">{backendFieldErrors.name}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">eGFR (mL/min/1.73m²)</label>
              <input
                type="number"
                step="0.1"
                value={form.egfr}
                onChange={(e) => handleChange("egfr", parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none"
              />
              {(localErrors.egfr || backendFieldErrors.egfr) && (
                <p className="text-[10px] text-rose-500 mt-1">{localErrors.egfr || backendFieldErrors.egfr}</p>
              )}
            </div>
          </div>

          {/* Row 3: Age + Sex (left) | UACR + Creatinine (right) */}
          <div className="grid grid-cols-2 gap-6">
            {/* Age + Sex sub-grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Age</label>
                <input
                  type="number"
                  step="1"
                  value={form.age}
                  onChange={(e) => handleChange("age", parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                />
                {(localErrors.age || backendFieldErrors.age) && (
                  <p className="text-[10px] text-rose-500 mt-1">{localErrors.age || backendFieldErrors.age}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sex</label>
                <select
                  value={form.sex}
                  onChange={(e) => handleChange("sex", e.target.value as "M" | "F")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                </select>
                {backendFieldErrors.sex && (
                  <p className="text-[10px] text-rose-500 mt-1">{backendFieldErrors.sex}</p>
                )}
              </div>
            </div>
            {/* UACR + Creatinine sub-grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">UACR (mg/g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.uacr_mg_g}
                  onChange={(e) => handleChange("uacr_mg_g", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                />
                {(localErrors.uacr_mg_g || backendFieldErrors.uacr_mg_g) && (
                  <p className="text-[10px] text-rose-500 mt-1">{localErrors.uacr_mg_g || backendFieldErrors.uacr_mg_g}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Creatinine (mg/dL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.creatinine_mg_dl}
                  onChange={(e) => handleChange("creatinine_mg_dl", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                />
                {(localErrors.creatinine_mg_dl || backendFieldErrors.creatinine_mg_dl) && (
                  <p className="text-[10px] text-rose-500 mt-1">{localErrors.creatinine_mg_dl || backendFieldErrors.creatinine_mg_dl}</p>
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Diabetic Duration + HbA1c (left) | empty (right, balanced) */}
          <div className="grid grid-cols-2 gap-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Diabetes Duration(yrs)</label>
                <input
                  type="number"
                  step="1"
                  value={form.years_with_diabetes}
                  onChange={(e) => handleChange("years_with_diabetes", parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                />
                {(localErrors.years_with_diabetes || backendFieldErrors.years_with_diabetes) && (
                  <p className="text-[10px] text-rose-500 mt-1">{localErrors.years_with_diabetes || backendFieldErrors.years_with_diabetes}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">HbA1c (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.a1c_percent}
                  onChange={(e) => handleChange("a1c_percent", parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                />
                {(localErrors.a1c_percent || backendFieldErrors.a1c_percent) && (
                  <p className="text-[10px] text-rose-500 mt-1">{localErrors.a1c_percent || backendFieldErrors.a1c_percent}</p>
                )}
              </div>
            </div>
            {/* Right side intentionally empty to balance the grid */}
            <div />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            
            {/* Section 3: Lipid Panel */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Cardiovascular & Lipids</h3>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">LDL (mg/dL)</label>
                  <input
                    type="number"
                    step="1"
                    value={form.ldl_mg_dl}
                    onChange={(e) => handleChange("ldl_mg_dl", parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">HDL (mg/dL)</label>
                  <input
                    type="number"
                    step="1"
                    value={form.hdl_mg_dl}
                    onChange={(e) => handleChange("hdl_mg_dl", parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Triglycerides</label>
                  <input
                    type="number"
                    step="1"
                    value={form.triglycerides_mg_dl}
                    onChange={(e) => handleChange("triglycerides_mg_dl", parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-rose-500 text-[9px]">
                <div>
                  {(localErrors.ldl_mg_dl || backendFieldErrors.ldl_mg_dl) && (
                    <p>{localErrors.ldl_mg_dl || backendFieldErrors.ldl_mg_dl}</p>
                  )}
                </div>
                <div>
                  {(localErrors.hdl_mg_dl || backendFieldErrors.hdl_mg_dl) && (
                    <p>{localErrors.hdl_mg_dl || backendFieldErrors.hdl_mg_dl}</p>
                  )}
                </div>
                <div>
                  {(localErrors.triglycerides_mg_dl || backendFieldErrors.triglycerides_mg_dl) && (
                    <p>{localErrors.triglycerides_mg_dl || backendFieldErrors.triglycerides_mg_dl}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Blood Pressure */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Vascular Markers</h3>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Systolic Blood Pressure (mmHg)</label>
                <input
                  type="number"
                  step="1"
                  value={form.systolic_bp}
                  onChange={(e) => handleChange("systolic_bp", parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none"
                />
                {(localErrors.systolic_bp || backendFieldErrors.systolic_bp) && (
                  <p className="text-[10px] text-rose-500 mt-1">{localErrors.systolic_bp || backendFieldErrors.systolic_bp}</p>
                )}
              </div>
            </div>

          </div>

        </form>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 sm:px-8 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border border-white border-t-transparent" />
                <span>Running Swarm...</span>
              </>
            ) : (
              <span>Run Analysis Swarm</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
