import { Demographics, Labs } from "@/types";

interface PatientOverviewHeaderProps {
  patientId: string | null;
  demographics: Demographics | null;
  labs: Labs | null;
}

export function PatientOverviewHeader({ patientId, demographics, labs }: PatientOverviewHeaderProps) {
  if (!patientId || !demographics) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[32px] px-4 py-4 sm:px-6 sm:py-5">
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
  );
}