"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { SpecialistResult, SynthesisReport } from "@/types";
import { FadeInUp } from "@/components/animations/FadeInUp";
import { HoverScale } from "@/components/animations/HoverScale";
import { StaggerContainer, StaggerItem } from "@/components/animations/Stagger";

// three.js/WebGL can't run server-side, and the libs are sizeable, so this
// is code-split out of the initial dashboard bundle and only ever mounted
// once we're past the loading/empty-state branches below.
const OrganRiskMap3D = dynamic(() => import("./OrganRiskMap3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-500" />
    </div>
  ),
});

interface OrganRiskMapProps {
  specialists: SpecialistResult[];
  synthesis: SynthesisReport | null;
  isLoading?: boolean;
}

const specialistLabels: Record<string, string> = {
  retinal: "Retina (Retinopathy)",
  renal: "Kidneys (Nephropathy)",
  neuropathy: "Nerves (Neuropathy)",
  cardiovascular: "Heart & Vessels (Cardiology)",
};

// Splits "Kidneys (Nephropathy)" into a big primary word and a smaller
// parenthetical sub-label rendered on its own line, instead of letting the
// browser wrap the full string wherever it runs out of width (which was
// breaking mid-phrase, e.g. "Kidneys" / "(Nephropathy)" landing on two
// lines with mismatched sizes). Labels with no parenthetical ("Heart &
// Vessels") just render as a single line.
function splitSpecialistLabel(label: string): { main: string; sub: string | null } {
  const match = label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { main: match[1], sub: match[2] };
  return { main: label, sub: null };
}

export function OrganRiskMap({ specialists = [], synthesis, isLoading = false }: OrganRiskMapProps) {
  const [hoveredSpec, setHoveredSpec] = useState<string | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);

  // Hover always wins in the moment; a click "pins" the highlight so it
  // survives the mouse leaving (handy on touch devices, or to compare a
  // card against the body without needing to keep the cursor still).
  const activeSpec = hoveredSpec ?? selectedSpec;

  const toggleSelected = (key: string) => {
    setSelectedSpec((prev) => (prev === key ? null : key));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[480px] h-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-sm text-slate-400 animate-pulse font-sans">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-12 w-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <span className="text-xs font-mono text-emerald-600 mt-20 uppercase tracking-widest">Running Swarm Sandboxes...</span>
        </div>
      </div>
    );
  }

  if (!specialists.length) {
    return (
      <div className="flex min-h-[480px] h-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-sm text-slate-400 font-sans text-center">
        <svg className="w-12 h-12 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <span className="font-medium text-slate-700">No active patient data loaded.</span>
        <span className="text-xs text-slate-400">Select a patient record at the top to run the diagnostic swarm.</span>
      </div>
    );
  }

  // Find highest risk factor among AVAILABLE specialists only — an
  // unavailable specialist (null risk_score) never counts as "highest".
  const availableForRanking = specialists.filter((s) => s.available && s.risk_score !== null);
  const highestRisk = availableForRanking.reduce((current, item) => {
    return (item.risk_score as number) > (current.risk_score as number) ? item : current;
  }, availableForRanking[0] ?? null);

  // Color is driven purely by the numeric risk score, not the specialist's
  // boolean "flag" — a flag can trip on a clinical threshold even when the
  // underlying risk_score only lands in the moderate band, and forcing that
  // straight to red made the map read as only ever green/red.
  //
  // The status TEXT used to read the model's own "flag" boolean directly,
  // which caused it to visibly disagree with the score/color (e.g. a 0%
  // risk_score still showing "Anomaly Flagged"), since flag and risk_score
  // are two independently-authored values from the same LLM call and a
  // small model doesn't always keep them in sync. Fixed by deriving the
  // status text from the exact same numeric bands as the color, so the two
  // can never disagree - and that gives us the missing amber-tier label
  // ("Elevated - Monitor") for free instead of collapsing to a binary
  // Anomaly/Within Boundary choice.
  const getSeverityLabel = (available: boolean, score: number | null) => {
    if (!available || score === null) return "Unavailable";
    if (score >= 0.7) return "Anomaly Flagged";
    if (score >= 0.4) return "Elevated - Monitor";
    return "Within Boundary";
  };

  const getRiskColorClass = (score: number | null) => {
    if (score === null) return "text-slate-500 border-slate-200 bg-slate-50/60";
    if (score >= 0.7) return "text-red-700 border-red-200 bg-red-50/60 hover:bg-red-50 hover:border-red-300";
    if (score >= 0.4) return "text-amber-700 border-amber-200 bg-amber-50/60 hover:bg-amber-50 hover:border-amber-300";
    return "text-emerald-700 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 hover:border-emerald-300";
  };

  return (
    <div className="flex h-full flex-col gap-3 font-sans text-slate-800">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex flex-col">
          <h2 className="text-base font-semibold tracking-tight text-slate-700">
            Anatomical Risk Map
          </h2>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 min-w-0 items-stretch">
        
        {/* SVG Silhouette Panel (Left side) - Clean minimalist style.
            Uses its own dedicated bg/border (rather than the shared
            bg-slate-50/80 utility that globals.css re-themes for dark
            mode) because that shared dark override lands almost the
            exact same navy as the parent glass-card, so the panel was
            invisible against its own container in dark mode. */}
        <div className="flex-[1.3] min-w-0 flex items-center justify-center bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 rounded-[32px] p-5 min-h-[480px] relative overflow-hidden select-none">
          {/* Dotted Grid Pattern Background — separate light/dark layers
              since dark dots on a dark panel are invisible. */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.03] dark:hidden bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:14px_14px]" />
          <div className="pointer-events-none absolute inset-0 hidden dark:block opacity-[0.06] bg-[linear-gradient(to_right,#94a3b8_1px,transparent_1px),linear-gradient(to_bottom,#94a3b8_1px,transparent_1px)] bg-[size:14px_14px]" />
          
          {/* Interactive 3D humanoid — code-split via next/dynamic above
              since three.js can't run server-side. Preserves the exact
              same bidirectional highlight state (activeSpec) the old SVG
              hotspots used. */}
          <div className="w-full h-full max-w-[880px] max-h-[880px]">
            <OrganRiskMap3D
              specialists={specialists}
              activeSpec={activeSpec}
              onHotspotHover={setHoveredSpec}
              onHotspotClick={toggleSelected}
            />
          </div>
        </div>

        {/* Right side Detail List — scrolls internally rather than being
            silently clipped by the parent panel's overflow-hidden if the
            cards ever need more vertical space than the shrunk container
            has to offer. */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto">
          {/* Executive Summary Compiling */}
          {synthesis && synthesis.available && highestRisk && (
            <FadeInUp className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-5 pl-6 shadow-sm">
              <div className="absolute inset-y-0 left-0 w-[3px] bg-rose-400" />
              <p className="text-xs uppercase tracking-[0.24em] font-semibold text-slate-400">
                Highest Risk Trajectory
              </p>
              <div className="mt-1.5 flex items-center justify-between">
                <p className="font-bold text-slate-900 text-lg">
                  {specialistLabels[highestRisk.specialist] ?? highestRisk.specialist}
                </p>
                <span className="text-sm font-mono bg-slate-100 px-3 py-1 rounded text-slate-800 font-semibold border border-slate-200">
                  Score: {((highestRisk.risk_score as number) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-2.5">
                <span className="font-bold text-slate-800">Clinical Rec:</span> {synthesis.recommendation}
              </p>
            </FadeInUp>
          )}
          {synthesis && !synthesis.available && (
            <FadeInUp className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5">
              <p className="text-xs uppercase tracking-[0.24em] font-semibold text-slate-400">
                Synthesis Unavailable
              </p>
              <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{synthesis.synthesis_error}</p>
            </FadeInUp>
          )}

          {/* Specialist Grid */}
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 min-w-0">
            {specialists.map((finding) => {
              const isActive = activeSpec === finding.specialist;
              const isTopRisk = !!highestRisk && finding.specialist === highestRisk.specialist && (finding.risk_score ?? 0) >= 0.4;
              const scoreColor = !finding.available || finding.risk_score === null
                ? "text-slate-400"
                : finding.risk_score >= 0.7
                ? "text-rose-700"
                : finding.risk_score >= 0.4
                ? "text-amber-700"
                : "text-emerald-700";

              return (
                <StaggerItem key={finding.specialist} className="flex min-w-0">
                  <HoverScale
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    onMouseEnter={() => setHoveredSpec(finding.specialist)}
                    onMouseLeave={() => setHoveredSpec(null)}
                    onClick={() => toggleSelected(finding.specialist)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSelected(finding.specialist);
                      }
                    }}
                    className={`w-full relative rounded-xl border p-5 flex flex-col justify-between min-h-[150px] transition-colors duration-200 cursor-pointer outline-none ${getRiskColorClass(
                      finding.risk_score
                    )} ${isTopRisk ? "ring-2 ring-rose-300" : ""} ${isActive ? "ring-2 ring-sky-400 shadow-md" : "shadow-sm"}`}
                  >
                  {isTopRisk && (
                    <span className="absolute -top-2.5 left-3 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                      Top Concern
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      {(() => {
                        const { main, sub } = splitSpecialistLabel(specialistLabels[finding.specialist] ?? finding.specialist);
                        return (
                          <>
                            <span className="text-xl font-bold leading-tight text-slate-900 truncate">
                              {main}
                            </span>
                            {sub && (
                              <span className="text-sm font-semibold text-slate-500 tracking-wide truncate">
                                {sub}
                              </span>
                            )}
                          </>
                        );
                      })()}
                      <span className="text-xs uppercase tracking-wider text-slate-400 mt-1.5">
                        {getSeverityLabel(finding.available, finding.risk_score)}
                      </span>
                    </div>
                    {/* Ring indicator */}
                    <div className="relative flex items-center justify-center h-5 w-5 mt-0.5">
                      <span className={`h-3.5 w-3.5 rounded-full ${
                        !finding.available
                          ? "bg-slate-400"
                          : (finding.risk_score ?? 0) >= 0.7
                          ? "bg-red-500"
                          : (finding.risk_score ?? 0) >= 0.4
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`} />
                    </div>
                  </div>

                  <div className="mt-5 flex items-baseline justify-between">
                    <span className="text-sm font-mono text-slate-400">
                      RISK PROBABILITY
                    </span>
                    <span className={`text-3xl font-bold font-mono tracking-tight leading-none ${scoreColor}`}>
                      {finding.risk_score !== null ? `${(finding.risk_score * 100).toFixed(0)}%` : "N/A"}
                    </span>
                  </div>
                  </HoverScale>
                </StaggerItem>
              );
            })}
          </StaggerContainer>

        </div>

      </div>
    </div>
  );
}
