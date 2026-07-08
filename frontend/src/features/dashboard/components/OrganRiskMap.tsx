"use client";

import { useState } from "react";
import { SpecialistResult, SynthesisReport } from "@/types";

interface OrganRiskMapProps {
  specialists: SpecialistResult[];
  synthesis: SynthesisReport | null;
  isLoading?: boolean;
}

const specialistLabels: Record<string, string> = {
  retinal: "Retina (Retinopathy)",
  renal: "Kidneys (Nephropathy)",
  neuropathy: "Nerves (Neuropathy)",
  cardiovascular: "Heart & Vessels",
};

export function OrganRiskMap({ specialists = [], synthesis, isLoading = false }: OrganRiskMapProps) {
  const [hoveredSpec, setHoveredSpec] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] h-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-sm text-slate-400 animate-pulse font-sans">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-12 w-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <span className="text-xs font-mono text-emerald-600 mt-20 uppercase tracking-widest">Running Swarm Sandboxes...</span>
        </div>
      </div>
    );
  }

  if (!specialists.length) {
    return (
      <div className="flex min-h-[400px] h-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-sm text-slate-400 font-sans text-center">
        <svg className="w-12 h-12 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <span className="font-medium text-slate-700">No active patient data loaded.</span>
        <span className="text-xs text-slate-400">Select a patient record at the top to run the diagnostic swarm.</span>
      </div>
    );
  }

  // Find highest risk factor
  const highestRisk = specialists.reduce((current, item) => {
    return item.risk_score > current.risk_score ? item : current;
  }, specialists[0] ?? { specialist: "System", risk_score: 0, flag: false, reasoning: "" });

  const getRiskColorClass = (score: number, flag: boolean) => {
    if (flag || score >= 0.7) return "text-red-700 border-red-200 bg-red-50/60 hover:bg-red-50 hover:border-red-300";
    if (score >= 0.4) return "text-amber-700 border-amber-200 bg-amber-50/60 hover:bg-amber-50 hover:border-amber-300";
    return "text-emerald-700 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 hover:border-emerald-300";
  };

  const getHotspotColor = (score: number, flag: boolean) => {
    if (flag || score >= 0.7) return "#ef4444"; // Red
    if (score >= 0.4) return "#f59e0b"; // Amber
    return "#10b981"; // Emerald
  };

  const specMap = specialists.reduce((acc, item) => {
    acc[item.specialist] = item;
    return acc;
  }, {} as Record<string, SpecialistResult>);

  return (
    <div className="flex h-full flex-col gap-4 font-sans text-slate-800">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold tracking-tight text-slate-700">
            Anatomical Risk Map
          </h2>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-5 flex-1 items-stretch">
        
        {/* SVG Silhouette Panel (Left side) - Clean minimalist style */}
        <div className="flex-1 flex items-center justify-center bg-slate-50/80 border border-slate-200/60 rounded-3xl p-4 min-h-[340px] relative overflow-hidden select-none">
          {/* Dotted Grid Pattern Background */}
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:14px_14px]" />
          
          {/* Static SVG container */}
          <div 
            className="w-full h-full max-w-[240px] max-h-[310px] flex items-center justify-center transition-transform duration-700 ease-out"
          >
            <svg className="w-full h-full" viewBox="0 0 200 280" fill="none">
              <defs>
                {/* Premium gradient fill for the body */}
                <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15" />
                  <stop offset="50%" stopColor="#6366f1" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.15" />
                </linearGradient>
              </defs>

              {/* Minimal base scanning ring at the feet */}
              <ellipse 
                cx="100" 
                cy="260" 
                rx="58" 
                ry="9" 
                fill="none" 
                stroke="#cbd5e1" 
                strokeWidth="1" 
                strokeDasharray="4,4" 
              />

              {/* Symmetric high-fidelity human outline */}
              <path 
                d="
                  M 100,22 
                  C 107,22 112,26 112,33 
                  C 112,39 108,44 104,47 
                  L 104,52 
                  C 111,53 121,52 127,56 
                  C 134,60 139,67 143,74 
                  C 147,83 151,98 153,110 
                  C 155,117 156,124 153,128 
                  C 150,132 144,131 141,126 
                  L 138,116 
                  L 135,102 
                  L 133,160 
                  C 133,168 129,176 123,180 
                  L 121,245 
                  C 120,249 116,252 112,252 
                  C 107,252 103,245 103,232 
                  L 101,202 
                  L 99,202 
                  L 97,232 
                  C 97,245 93,252 88,252 
                  C 84,252 80,249 79,245 
                  L 77,180 
                  C 71,176 67,168 67,160 
                  L 65,102 
                  L 62,116 
                  L 59,126 
                  C 56,131 50,132 47,128 
                  C 44,124 45,117 47,110 
                  C 49,98 53,83 57,74 
                  C 61,67 66,60 73,56 
                  C 79,52 89,53 96,52 
                  L 96,47 
                  C 92,44 88,39 88,33 
                  C 88,26 93,22 100,22 
                  Z" 
                fill="url(#bodyGradient)" 
                stroke="#64748b" 
                strokeWidth="1.2" 
                strokeOpacity="0.4"
                className="transition-all duration-300"
              />

              {/* Diagnostic Hotspots */}
              
              {/* Eyes (Retinal) */}
              {specMap["retinal"] && (
                <g 
                  className="cursor-pointer transition-opacity duration-300"
                  onMouseEnter={() => setHoveredSpec("retinal")}
                  onMouseLeave={() => setHoveredSpec(null)}
                >
                  <circle cx="95" cy="43" r="3.5" fill={getHotspotColor(specMap["retinal"].risk_score, specMap["retinal"].flag)} stroke="#ffffff" strokeWidth="0.5" />
                  <circle cx="105" cy="43" r="3.5" fill={getHotspotColor(specMap["retinal"].risk_score, specMap["retinal"].flag)} stroke="#ffffff" strokeWidth="0.5" />
                </g>
              )}

              {/* Heart (Cardiovascular) */}
              {specMap["cardiovascular"] && (
                <g 
                  className="cursor-pointer transition-opacity duration-300"
                  onMouseEnter={() => setHoveredSpec("cardiovascular")}
                  onMouseLeave={() => setHoveredSpec(null)}
                >
                  <circle cx="94" cy="106" r="5" fill={getHotspotColor(specMap["cardiovascular"].risk_score, specMap["cardiovascular"].flag)} stroke="#ffffff" strokeWidth="0.5" />
                </g>
              )}

              {/* Kidneys (Renal) */}
              {specMap["renal"] && (
                <g 
                  className="cursor-pointer transition-opacity duration-300"
                  onMouseEnter={() => setHoveredSpec("renal")}
                  onMouseLeave={() => setHoveredSpec(null)}
                >
                  <circle cx="92" cy="138" r="4.5" fill={getHotspotColor(specMap["renal"].risk_score, specMap["renal"].flag)} stroke="#ffffff" strokeWidth="0.5" />
                  <circle cx="108" cy="138" r="4.5" fill={getHotspotColor(specMap["renal"].risk_score, specMap["renal"].flag)} stroke="#ffffff" strokeWidth="0.5" />
                </g>
              )}

              {/* Nerves (Neuropathy) - Hands & Feet */}
              {specMap["neuropathy"] && (
                <g 
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredSpec("neuropathy")}
                  onMouseLeave={() => setHoveredSpec(null)}
                >
                  {/* Feet */}
                  <circle cx="88" cy="245" r="4.5" fill={getHotspotColor(specMap["neuropathy"].risk_score, specMap["neuropathy"].flag)} stroke="#ffffff" strokeWidth="0.5" />
                  <circle cx="112" cy="245" r="4.5" fill={getHotspotColor(specMap["neuropathy"].risk_score, specMap["neuropathy"].flag)} stroke="#ffffff" strokeWidth="0.5" />
                  
                  {/* Hands */}
                  <circle cx="48" cy="124" r="4.5" fill={getHotspotColor(specMap["neuropathy"].risk_score, specMap["neuropathy"].flag)} stroke="#ffffff" strokeWidth="0.5" />
                  <circle cx="152" cy="124" r="4.5" fill={getHotspotColor(specMap["neuropathy"].risk_score, specMap["neuropathy"].flag)} stroke="#ffffff" strokeWidth="0.5" />
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Right side Detail List */}
        <div className="flex-[1.5] flex flex-col gap-3">
          {/* Executive Summary Compiling */}
          {synthesis && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.24em] font-semibold text-slate-400">
                Highest Risk Trajectory
              </p>
              <div className="mt-1 flex items-center justify-between">
                <p className="font-bold text-slate-900 text-base">
                  {specialistLabels[highestRisk.specialist] ?? highestRisk.specialist}
                </p>
                <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded text-slate-800 font-semibold border border-slate-200">
                  Score: {(highestRisk.risk_score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="mt-2.5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2">
                <span className="font-bold text-slate-800">Clinical Rec:</span> {synthesis.recommendation}
              </p>
            </div>
          )}

          {/* Specialist Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            {specialists.map((finding) => {
              const isHovered = hoveredSpec === finding.specialist;

              return (
                <div
                  key={finding.specialist}
                  onMouseEnter={() => setHoveredSpec(finding.specialist)}
                  onMouseLeave={() => setHoveredSpec(null)}
                  className={`rounded-xl border p-4 flex flex-col justify-between min-h-[110px] transition-all duration-200 cursor-pointer ${getRiskColorClass(
                    finding.risk_score,
                    finding.flag
                  )} ${isHovered ? "ring-1 ring-slate-300 scale-[1.02]" : "shadow-sm"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">
                        {specialistLabels[finding.specialist] ?? finding.specialist}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 mt-0.5">
                        {finding.flag ? "Anomaly Flagged" : "Within Boundary"}
                      </span>
                    </div>
                    {/* Ring indicator */}
                    <div className="relative flex items-center justify-center h-3.5 w-3.5 mt-0.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        finding.flag ? "bg-red-500" : finding.risk_score >= 0.4 ? "bg-amber-500" : "bg-emerald-500"
                      }`} />
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-[10px] font-mono text-slate-400">
                      RISK PROBABILITY
                    </span>
                    <span className="text-lg font-bold font-mono tracking-tight text-slate-950 leading-none">
                      {(finding.risk_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
}