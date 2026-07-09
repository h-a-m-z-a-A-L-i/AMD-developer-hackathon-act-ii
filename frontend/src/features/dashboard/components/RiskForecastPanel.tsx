import { SpecialistResult } from "@/types";

const SPECIALIST_META: Record<string, { label: string; subtitle: string }> = {
  renal: { label: "Renal", subtitle: "Kidney stress" },
  neuropathy: { label: "Neuropathy", subtitle: "Nerve risk" },
  retinal: { label: "Retinal", subtitle: "Microvascular" },
  cardiovascular: { label: "Cardiovascular", subtitle: "" },
};

function riskTier(score: number | null, flag: boolean | null) {
  if (score === null) return { level: "Unavailable", ring: "stroke-slate-300", text: "text-slate-400" };
  if (flag || score >= 0.7) return { level: "Elevated", ring: "stroke-rose-500", text: "text-rose-600" };
  if (score >= 0.4) return { level: "Moderate", ring: "stroke-amber-500", text: "text-amber-600" };
  return { level: "Low", ring: "stroke-emerald-500", text: "text-emerald-600" };
}

function Gauge({ score, ringClass }: { score: number | null; ringClass: string }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const dash = score === null ? 0 : Math.max(0, Math.min(1, score)) * circumference;
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" className="flex-shrink-0">
      <circle cx={32} cy={32} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle cx={32} cy={32} r={r} fill="none" strokeWidth={6} strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`} transform="rotate(-90 32 32)" className={ringClass} />
      <text x={32} y={32} dy="0.35em" textAnchor="middle" fontSize={score === null ? 11 : 16} fontWeight={600} fill="#0f172a">
        {score === null ? "N/A" : `${Math.round(score * 100)}%`}
      </text>
    </svg>
  );
}

interface RiskForecastPanelProps {
  specialists: SpecialistResult[];
  isLoading: boolean;
}

export function RiskForecastPanel({ specialists, isLoading }: RiskForecastPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:shadow-md flex items-center justify-center min-h-[140px]">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          <p className="text-sm font-semibold tracking-wide uppercase text-[10px]">Running swarm...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md">
      <h3 className="mb-4 text-base font-semibold text-slate-800 uppercase tracking-wider text-xs">Risk forecast</h3>
      <div className="divide-y divide-slate-100">
        {specialists.map((s) => {
          const meta = SPECIALIST_META[s.specialist] ?? { label: s.specialist, subtitle: "" };
          const tier = riskTier(s.risk_score, s.flag);
          return (
            <div key={s.specialist} className="flex items-start gap-4 rounded-xl px-2 py-4 transition-colors duration-150 first:pt-0 last:pb-0 hover:bg-slate-50/50">
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-900">
                  {meta.label}{meta.subtitle && <span className="text-sm font-normal text-slate-400"> &middot; {meta.subtitle}</span>}
                </p>
                <p className={`mt-0.5 text-sm font-semibold ${tier.text}`}>{tier.level}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500 leading-relaxed">{s.reasoning}</p>
              </div>
              <Gauge score={s.risk_score} ringClass={tier.ring} />
            </div>
          );
        })}
      </div>
    </div>
  );
}