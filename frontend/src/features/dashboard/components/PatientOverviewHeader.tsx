import { Demographics, Labs } from "@/types";

interface PatientOverviewHeaderProps {
  patientId: string | null;
  demographics: Demographics | null;
  labs: Labs | null;
}

export function PatientOverviewHeader({ patientId, demographics, labs }: PatientOverviewHeaderProps) {
  if (!patientId || !demographics) return null;

  const eGfrNormal = labs && typeof labs.egfr === "number" ? labs.egfr >= 84.8 : true;
  const uacrElevated = labs && typeof labs.uacr_mg_g === "number" ? labs.uacr_mg_g > 15.5 : false;
  const bpElevated = labs && typeof labs.systolic_bp === "number" ? labs.systolic_bp > 130 : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-4 sm:px-6 sm:py-5">
        <div>
          {demographics.name ? (
            <>
              <p className="text-base font-semibold text-slate-900">
                Name: {demographics.name.charAt(0).toUpperCase() + demographics.name.slice(1)}
              </p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Patient ID: {patientId}
              </p>
            </>
          ) : (
            <p className="text-base font-semibold text-slate-900">
              Patient {patientId}
            </p>
          )}
          <p className="mt-1 text-sm text-slate-500">
            {demographics.sex} &middot; age {demographics.age} &middot; HbA1c {demographics.a1c_percent}%
          </p>
        </div>
        <span className="whitespace-nowrap text-xs sm:text-sm font-medium text-slate-400">
          {patientId?.startsWith("CUSTOM") ? "Custom Screening Input" : "NHANES 2017–2018 · de-identified"}
        </span>
      </div>

      {labs && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
            <p className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">HbA1c</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{demographics.a1c_percent}%</p>
            <p className="mt-2 text-xs sm:text-sm text-slate-400 font-medium">Controlled range</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
            <p className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">eGFR</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-slate-900">
              {typeof labs.egfr === "number" ? labs.egfr.toFixed(1) : "--"}
            </p>
            <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs sm:text-sm sm:px-3 sm:py-1 font-medium border ${
              typeof labs.egfr === "number"
                ? eGfrNormal
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100/50"
                  : "bg-rose-50 text-rose-700 border-rose-100/50"
                : "bg-slate-50 text-slate-400 border-slate-100"
            }`}>
              {typeof labs.egfr === "number" ? (eGfrNormal ? "Normal" : "Low") : "Pending"}
            </span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
            <p className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">UACR</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {typeof labs.uacr_mg_g === "number" ? labs.uacr_mg_g.toFixed(1) : "--"}
            </p>
            <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs sm:text-sm sm:px-3 sm:py-1 font-medium border ${
              typeof labs.uacr_mg_g === "number"
                ? uacrElevated
                  ? "bg-rose-50 text-rose-700 border-rose-100/50"
                  : "bg-emerald-50 text-emerald-700 border-emerald-100/50"
                : "bg-slate-50 text-slate-400 border-slate-100"
            }`}>
              {typeof labs.uacr_mg_g === "number" ? (uacrElevated ? "Elevated" : "Normal") : "Pending"}
            </span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
            <p className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">Systolic BP</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {typeof labs.systolic_bp === "number" ? Math.round(labs.systolic_bp) : "--"}
            </p>
            <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs sm:text-sm sm:px-3 sm:py-1 font-medium border ${
              typeof labs.systolic_bp === "number"
                ? bpElevated
                  ? "bg-rose-50 text-rose-700 border-rose-100/50"
                  : "bg-emerald-50 text-emerald-700 border-emerald-100/50"
                : "bg-slate-50 text-slate-400 border-slate-100"
            }`}>
              {typeof labs.systolic_bp === "number" ? (bpElevated ? "Elevated" : "Normal") : "Pending"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}