import { SpecialistResult, SynthesisReport } from "@/types";
import { HoverScale } from "@/components/animations/HoverScale";

interface SynthesisCalloutProps {
  specialists: SpecialistResult[];
  synthesis: SynthesisReport | null;
  isLoading: boolean;
}

export function SynthesisCallout({ specialists, synthesis, isLoading }: SynthesisCalloutProps) {
  // Bridge state — specialists have started reporting but synthesis hasn't landed yet.
  if (isLoading && !synthesis && specialists.length > 0) {
    return (
      <HoverScale className="rounded-[32px] border border-sky-100 bg-sky-50/60 p-4 sm:p-5 lg:p-4">
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          <p className="text-sm font-semibold text-sky-700">Synthesizing recommendation&hellip;</p>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {specialists.length} of 4 specialists reported &middot; combining findings into one referral recommendation.
        </p>
        <div className="mt-3 space-y-1.5">
          <div className="h-2.5 w-full rounded-full bg-sky-100/80 animate-pulse" />
          <div className="h-2.5 w-2/3 rounded-full bg-sky-100/80 animate-pulse" />
        </div>
      </HoverScale>
    );
  }

  if (isLoading || !synthesis) return null;
  const flaggedCount = specialists.filter((s) => s.flag).length;

  return (
    <HoverScale className="rounded-[32px] border border-slate-200 bg-white p-4 sm:p-5 lg:p-4 transition-colors duration-200 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3">
        <p className="text-base font-semibold text-slate-800">Synthesis recommendation</p>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">{flaggedCount} of {specialists.length} specialists flagged</p>
      </div>
      <p className="mt-2 text-sm sm:text-base leading-relaxed text-slate-600">{synthesis.recommendation}</p>
    </HoverScale>
  );
}
