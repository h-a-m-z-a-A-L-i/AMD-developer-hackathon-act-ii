"use client";

import { useEffect, useState, useRef } from "react";

interface SpecialistResult {
  specialist: string;
  risk_score: number;
  flag: boolean;
  reasoning: string;
}

interface LiveAgentTerminalProps {
  specialists: SpecialistResult[];
  synthesis: {
    top_concern: string;
    recommendation: string;
  } | null;
  isLoading?: boolean;
}

const specialistLabels: Record<string, string> = {
  retinal: "RETINAL_SPECIALIST",
  renal: "RENAL_SPECIALIST",
  neuropathy: "NEUROPATHY_SPECIALIST",
  cardiovascular: "CARDIOVASCULAR_SPECIALIST",
};

export function LiveAgentTerminal({ specialists = [], synthesis, isLoading = false }: LiveAgentTerminalProps) {
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [activeSpecialistIdx, setActiveSpecialistIdx] = useState<number>(-1);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs, activeSpecialistIdx, isLoading, specialists, synthesis]);

  useEffect(() => {
    if (isLoading) {
      setTerminalLogs([]);
      setActiveSpecialistIdx(-1);

      const logs = [
        "&gt; [SYSTEM] Initializing Diabetic Complication Swarm Engine...",
        "&gt; [SYSTEM] Loading NHANES 2017-2018 patient records structured matrix...",
        "&gt; [SYSTEM] Dispatching specialist analysis agents...",
        "&gt; [SYSTEM] Running live backend pipeline workflow...",
        "&gt; [SWARM] Broadcasting patient demographics through backend services...",
      ];

      let delay = 100;
      logs.forEach((log, idx) => {
        setTimeout(() => {
          setTerminalLogs((prev) => [...prev, log]);
        }, delay * (idx + 1));
      });
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading && specialists.length > 0) {
      setActiveSpecialistIdx(0);
    } else if (!isLoading && specialists.length === 0) {
      setTerminalLogs([]);
      setActiveSpecialistIdx(-1);
    }
  }, [isLoading, specialists]);

  useEffect(() => {
    if (activeSpecialistIdx >= 0 && activeSpecialistIdx < specialists.length) {
      const spec = specialists[activeSpecialistIdx];
      const name = specialistLabels[spec.specialist] || spec.specialist.toUpperCase();
      const flagMarker = spec.flag ? "⚠️  FLAGGED" : "   clear";
      const statusLog = `&gt; [${name}] risk=${spec.risk_score.toFixed(2)}  ${flagMarker}`;
      const reasoningLog = `&gt; [${name}] -> ${spec.reasoning}`;

      setTerminalLogs((prev) => [...prev, statusLog, reasoningLog]);

      const timer = setTimeout(() => {
        setActiveSpecialistIdx((prev) => prev + 1);
      }, 750);

      return () => clearTimeout(timer);
    } else if (activeSpecialistIdx === specialists.length && synthesis) {
      const timer = setTimeout(() => {
        setTerminalLogs((prev) => [
          ...prev,
          `&gt; >>> SYNTHESIS: ${synthesis.recommendation}`,
        ]);
        setActiveSpecialistIdx(-1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [activeSpecialistIdx, specialists, synthesis]);

  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium tracking-tight text-slate-900">
          Live Agent Reasoning Terminal
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-xs uppercase tracking-wide text-emerald-600 font-medium">
            Connected to Live Backend Pipeline
          </span>
        </div>
      </div>

      <div className="relative flex min-h-[380px] sm:min-h-[420px] max-h-[500px] flex-1 flex-col overflow-hidden rounded-xl border border-slate-900 bg-slate-950 shadow-inner font-mono">
        <div className="flex items-center justify-between border-b border-white/5 bg-zinc-900/80 px-4 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="select-none font-sans text-xs text-white/40">bash - live-backend</span>
          <span className="w-10" />
        </div>

        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-40" />

        <div className="scrollbar-thin scrollbar-thumb-white/10 flex-1 space-y-4 overflow-y-auto p-4 text-sm">

          {!isLoading && specialists.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center font-sans italic text-white/30">
              <span className="mb-2 font-mono text-xl">_</span>
              <p>&gt; Awaiting patient selection to boot swarm pipeline...</p>
            </div>
          )}

          <div className="space-y-1 text-emerald-400/80">
            {terminalLogs.map((log, index) => (
              <p key={index} dangerouslySetInnerHTML={{ __html: log }} />
            ))}
            {isLoading && (
              <span className="ml-1 inline-block h-4 w-2 animate-ping bg-emerald-400" />
            )}
          </div>

          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}