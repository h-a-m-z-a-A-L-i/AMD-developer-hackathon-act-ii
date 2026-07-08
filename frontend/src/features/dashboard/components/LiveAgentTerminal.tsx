"use client";

import { useEffect, useRef } from "react";

interface LiveAgentTerminalProps {
  terminalLogs: string[];
  isLoading?: boolean;
  llmStatus?: string;
  llmModel?: string | null;
}

export function LiveAgentTerminal({
  terminalLogs = [],
  isLoading = false,
  llmStatus = "checking...",
  llmModel = null,
}: LiveAgentTerminalProps) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTo({
        top: terminalContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [terminalLogs, isLoading]);

  return (
    <div className="flex h-auto flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight text-slate-800">
          Live Agent Terminal
        </h2>
        {llmStatus === "offline" ? (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-xs uppercase tracking-wide text-rose-600 font-semibold">
              LLM: Offline (Rule Fallback)
            </span>
          </div>
        ) : llmStatus === "checking..." ? (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
            <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
              LLM: Checking...
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">
                LLM: {llmStatus.charAt(0).toUpperCase() + llmStatus.slice(1)}
              </span>
            </div>
            {llmModel && (
              <span className="text-[9px] text-slate-400 font-mono mt-0.5 max-w-[150px] truncate">
                {llmModel.split("/").pop()}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative flex h-[350px] flex-col overflow-hidden rounded-2xl border border-slate-900 bg-slate-950 shadow-inner font-mono">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-white/5 bg-zinc-900/80 px-4 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="select-none font-sans text-xs text-white/40">glycoswarm-terminal ~ stream</span>
          <span className="w-10" />
        </div>

        {/* Scanlines Effect */}
        <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20" />

        {/* Scrollable logs */}
        <div
          ref={terminalContainerRef}
          className="scrollbar-thin scrollbar-thumb-white/10 flex-1 space-y-2 overflow-y-auto p-4 text-xs md:text-sm"
        >
          {terminalLogs.length === 0 && !isLoading && (
            <div className="flex h-full flex-col items-center justify-center text-center font-sans italic text-white/30">
              <span className="mb-2 font-mono text-xl">_</span>
              <p>&gt; Select a patient record and analyze to begin streaming...</p>
            </div>
          )}

          <div className="space-y-1.5 text-emerald-400/90 font-mono">
            {terminalLogs.map((log, index) => (
              <p key={index} className="leading-relaxed break-words">{log}</p>
            ))}
            {isLoading && (
              <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-emerald-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}