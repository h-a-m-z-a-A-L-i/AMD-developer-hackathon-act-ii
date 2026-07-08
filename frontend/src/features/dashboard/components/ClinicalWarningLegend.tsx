import React from "react";

export function ClinicalWarningLegend() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md">
      <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">Clinical Severity Guide</h4>
      <p className="mt-1 text-xs text-slate-500 font-medium mb-4">
        Interpretation of early-warning screening color states:
      </p>

      <div className="space-y-4">
        {/* Clear */}
        <div className="flex gap-3">
          <div className="mt-1.5 flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <div>
            <span className="text-xs sm:text-sm font-bold text-slate-700">Clear / Normal</span>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
              Biomarkers fall within standard reference intervals. Swarm recommends routine annual checkups.
            </p>
          </div>
        </div>

        {/* Warning / Caution */}
        <div className="flex gap-3">
          <div className="mt-1.5 flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
          <div>
            <span className="text-xs sm:text-sm font-bold text-slate-700">Within Boundary</span>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
              Biomarkers are elevated or borderline. Demographics or risk criteria indicate warning signs; routine monitoring suggested.
            </p>
          </div>
        </div>

        {/* Flagged */}
        <div className="flex gap-3">
          <div className="mt-1.5 flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
          <div>
            <span className="text-xs sm:text-sm font-bold text-slate-700">Anomaly Flagged</span>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
              One or more early-warning thresholds (e.g. eGFR &lt; 60 or UACR &gt; 30) breached. Swarm recommends direct specialist referral.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
