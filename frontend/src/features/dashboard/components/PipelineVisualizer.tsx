"use client";

import { useState, useEffect } from "react";
import { SpecialistResult, SynthesisReport } from "@/types";
import { HoverScale } from "@/components/animations/HoverScale";

function TypingText({ text = "", speed = 120, delay = 1200 }: { text: string; speed?: number; delay?: number }) {
  const [displayedText, setDisplayedText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text.charAt(index));
        setIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setDisplayedText("");
        setIndex(0);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [index, text, speed, delay]);

  return (
    <span className="font-mono inline-block w-[170px] text-left">
      {displayedText}
      <span className="animate-cursor-blink text-sky-500 font-bold ml-[1px]">|</span>
    </span>
  );
}

interface PipelineVisualizerProps {
  specialists: SpecialistResult[];
  synthesis: SynthesisReport | null;
  isLoading: boolean;
  patientId: string | null;
}

const specialistKeys = ["renal", "neuropathy", "retinal", "cardiovascular"];
const specialistNames: Record<string, string> = {
  renal: "Renal",
  neuropathy: "Nerves",
  retinal: "Retinal",
  cardiovascular: "Heart",
};

export function PipelineVisualizer({
  specialists,
  synthesis,
  isLoading,
  patientId,
}: PipelineVisualizerProps) {
  // Check completion states
  const hasLabs = !!patientId;
  const completedSpecialists = specialists.reduce((acc, spec) => {
    acc[spec.specialist] = spec;
    return acc;
  }, {} as Record<string, SpecialistResult>);

  const renalDone = !!completedSpecialists["renal"];
  const neuropathyDone = !!completedSpecialists["neuropathy"];
  const retinalDone = !!completedSpecialists["retinal"];
  const cardiovascularDone = !!completedSpecialists["cardiovascular"];
  const allSpecialistsDone = renalDone && neuropathyDone && retinalDone && cardiovascularDone;
  
  const synthesisDone = !!synthesis;
  const pipelineFinished = allSpecialistsDone && synthesisDone && !isLoading;

  const getRiskColor = (spec: SpecialistResult | undefined) => {
    if (!spec || !spec.available || spec.risk_score === null) return "bg-slate-100 border-slate-200 text-slate-400";
    if (spec.flag || spec.risk_score >= 0.7) return "bg-rose-50 border-rose-300 text-rose-600 shadow-[0_0_12px_rgba(244,63,94,0.15)]";
    if (spec.risk_score >= 0.4) return "bg-amber-50 border-amber-300 text-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.15)]";
    return "bg-emerald-50 border-emerald-300 text-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.15)]";
  };

  // Same severity bands as getRiskColor/OrganRiskMap, isolated to just the
  // icon's stroke color so the flagged-warning triangle matches the same
  // red/amber/emerald tier as the risk cards below it, instead of every
  // flagged specialist rendering the same hardcoded rose triangle even when
  // its actual score only lands in the amber "Elevated - Monitor" band.
  const getFlagIconColor = (score: number | null) => {
    if (score === null) return "text-slate-400";
    if (score >= 0.7) return "text-rose-500";
    if (score >= 0.4) return "text-amber-500";
    return "text-emerald-500";
  };

  return (
    <HoverScale className="rounded-[32px] border border-slate-200 bg-white p-5 md:p-4 transition-colors duration-200 hover:border-slate-300 hover:shadow-md">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-slate-700">Swarm Execution Workflow</h3>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Real-Time Parallel Pipeline Flow</p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-500">
          Status:{" "}
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-sky-600">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
              <TypingText text="Streaming Node Data..." />
            </span>
          ) : pipelineFinished ? (
            <span className="text-emerald-600">Pipeline Complete</span>
          ) : hasLabs ? (
            <span className="text-slate-500">Awaiting Trigger</span>
          ) : (
            <span className="text-slate-400">Idle</span>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-2 relative w-full mt-4 pb-2">
        
        {/* Node 1: Patient Labs */}
        <div className="flex flex-col items-center z-10 w-full md:w-auto">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-300 ${
            pipelineFinished
              ? "bg-emerald-50 border-emerald-400 text-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              : hasLabs
              ? "bg-sky-50 border-sky-400 text-sky-600 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
              : "bg-slate-50 border-slate-200 text-slate-400"
          }`}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className={`mt-2.5 text-xs font-semibold ${hasLabs ? "text-slate-800" : "text-slate-400"}`}>Patient Labs</span>
          <span className="text-[10px] text-slate-400 font-mono">{patientId || "No patient Selected"}</span>
        </div>

        {/* Connector 1 */}
        <div className="hidden md:block flex-1 h-[2px] bg-slate-100 min-w-[20px] relative overflow-hidden">
          {isLoading && !allSpecialistsDone && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-shimmer-connector" />
          )}
          {pipelineFinished && (
            <div className="absolute inset-0 bg-emerald-400" />
          )}
        </div>

        {/* Node 2: 4 Specialist Agents (Parallel Panel) */}
        <div className="flex flex-col items-center z-10 w-full md:w-auto">
          {/* grid-cols-2 on narrow mobile → flex row on md+ */}
          <div className="rounded-[32px] border border-slate-200 bg-slate-50/50 p-3 grid grid-cols-2 md:flex md:flex-nowrap gap-3 items-center justify-center shadow-inner w-full md:w-auto">
            {specialistKeys.map((key) => {
              const spec = completedSpecialists[key];
              const isDone = !!spec;
              const name = specialistNames[key];
              
              // Color selection
              const colorClass = getRiskColor(spec);
              const isActive = isLoading && !isDone;
              const isFlagged = isDone && spec.available && spec.flag;

              return (
                <div key={key} className={`flex flex-col items-center gap-1 p-2 rounded-xl border bg-white w-full min-w-[64px] transition-all duration-300 ${
                  isDone ? "border-slate-200" : isActive ? "border-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.15)]" : "border-slate-100 opacity-60"
                }`}>
                  <div className={isFlagged
                    ? "flex h-8 w-8 items-center justify-center transition-all duration-300"
                    : `flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300 text-xs font-bold ${colorClass}`
                  }>
                    {isDone ? (
                      !spec.available || spec.risk_score === null ? (
                        <span className="text-[9px] font-bold text-slate-400">N/A</span>
                      ) : spec.flag ? (
                        <svg className={`h-6 w-6 ${getFlagIconColor(spec.risk_score)}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : (
                        `${Math.round(spec.risk_score * 100)}%`
                      )
                    ) : isActive ? (
                      <span className="h-4 w-4 animate-spin rounded-full border border-sky-600 border-t-transparent" />
                    ) : (
                      "..."
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-700">{name}</span>
                </div>
              );
            })}
          </div>
          <span className="mt-2.5 text-xs font-semibold text-slate-800">4 Specialist Agents</span>
          <span className="text-[10px] text-slate-400 font-mono">Parallel Sandbox Execution</span>
        </div>

        {/* Connector 2 */}
        <div className="hidden md:block flex-1 h-[2px] bg-slate-100 min-w-[20px] relative overflow-hidden">
          {isLoading && allSpecialistsDone && !synthesisDone && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-shimmer-connector" />
          )}
          {pipelineFinished && (
            <div className="absolute inset-0 bg-emerald-400" />
          )}
        </div>

        {/* Node 3: Synthesis Agent */}
        <div className="flex flex-col items-center z-10 w-full md:w-auto">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-300 ${
            pipelineFinished
              ? "bg-emerald-50 border-emerald-400 text-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
              : synthesisDone
              ? "bg-sky-50 border-sky-400 text-sky-600 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
              : isLoading && allSpecialistsDone
              ? "bg-slate-50 border-sky-400 text-sky-400"
              : "bg-slate-50 border-slate-200 text-slate-400"
          }`}>
            {synthesisDone ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ) : isLoading && allSpecialistsDone ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            )}
          </div>
          <span className={`mt-2.5 text-xs font-semibold ${synthesisDone ? "text-slate-800" : "text-slate-400"}`}>Synthesis Agent</span>
          <span className="text-[10px] text-slate-400 font-mono">Consensus Builder</span>
        </div>

        {/* Connector 3 */}
        <div className="hidden md:block flex-1 h-[2px] bg-slate-100 min-w-[20px] relative overflow-hidden">
          {isLoading && synthesisDone && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-shimmer-connector" />
          )}
          {pipelineFinished && (
            <div className="absolute inset-0 bg-emerald-400" />
          )}
        </div>

        {/* Node 4: Referral Recommendation */}
        <div className="flex flex-col items-center z-10 w-full md:w-auto">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-300 ${
            pipelineFinished
              ? "bg-emerald-50 border-emerald-400 text-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
              : "bg-slate-50 border-slate-200 text-slate-400"
          }`}>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className={`mt-2.5 text-xs font-semibold ${pipelineFinished ? "text-slate-800" : "text-slate-400"}`}>Referral Issued</span>
          <span className="text-[10px] text-slate-400 font-mono">{synthesis?.top_concern || "Triage Action Item"}</span>
        </div>

      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer-connector {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer-connector {
          animation: shimmer-connector 1.5s infinite linear;
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-cursor-blink {
          animation: cursor-blink 0.8s infinite step-start;
        }
      `}} />
    </HoverScale>
  );
}
