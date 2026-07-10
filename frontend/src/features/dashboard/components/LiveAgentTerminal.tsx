"use client";

import { useEffect, useRef, useState } from "react";
import { HoverScale } from "@/components/animations/HoverScale";

interface LiveAgentTerminalProps {
  terminalLogs: string[];
  isLoading?: boolean;
  llmStatus?: string;
  llmModel?: string | null;
}

// Typewriter speed for the most-recently-added terminal line, in ms/char.
const TYPE_SPEED_MS = 10;

export function LiveAgentTerminal({
  terminalLogs = [],
  isLoading = false,
  llmStatus = "checking...",
  llmModel = null,
}: LiveAgentTerminalProps) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  // Only the newest line animates in character-by-character; every earlier
  // line is already fully rendered (no point re-typing history). Tracks the
  // logs array length so it only restarts the animation when a genuinely new
  // line arrives, not on every re-render.
  const [typedCount, setTypedCount] = useState(0);
  const animatedLengthRef = useRef(0);

  useEffect(() => {
    if (terminalLogs.length === 0) {
      animatedLengthRef.current = 0;
      setTypedCount(0);
      return;
    }

    if (terminalLogs.length === animatedLengthRef.current) {
      // Same number of lines as last time — nothing new to type out.
      return;
    }

    animatedLengthRef.current = terminalLogs.length;
    const fullText = terminalLogs[terminalLogs.length - 1];
    setTypedCount(0);

    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setTypedCount(i);
      if (i >= fullText.length) {
        clearInterval(interval);
      }
    }, TYPE_SPEED_MS);

    return () => clearInterval(interval);
  }, [terminalLogs]);

  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTo({
        top: terminalContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [terminalLogs, isLoading, typedCount]);

  return (
    <HoverScale className="flex h-auto flex-col gap-3 rounded-[32px] border border-slate-200 bg-white p-3 sm:p-4 transition-colors duration-200 hover:border-slate-300 hover:shadow-md">
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-nowrap items-center justify-between gap-2">
          <h2 className="shrink-0 whitespace-nowrap text-sm font-semibold tracking-tight text-slate-800">
            Agent Terminal
          </h2>
          {llmStatus === "offline" ? (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-xs uppercase tracking-wide text-rose-600 font-semibold">
                LLM: Offline (No Fallback)
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
            (() => {
              // llmStatus can be a short provider id ("fireworks") or a longer
              // "model (extra detail)" string for the AMD notebook routes, e.g.
              // "qwen2.5-coder:7b (AMD notebook, local Ollama on-GPU)". Either
              // way, the TOP line is always the provider/source ("Fireworks",
              // "Featherless", "AMD Notebook") and the line below is always
              // "LLM: <actual model>" - so "Fireworks" never gets mislabeled as
              // if it were the model itself.
              const match = llmStatus.match(/^([^(]+?)\s*(?:\((.+)\))?$/);
              const shortLabel = (match?.[1] ?? llmStatus).trim();
              const detail = match?.[2]?.trim();
              const isAmd = /(amd|notebook)/i.test(llmStatus);
              const providerTitle = isAmd ? "AMD Notebook" : shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1);
              const modelDisplay = (llmModel ? llmModel.split("/").pop() : null) || shortLabel;
              const tooltip = detail || undefined;

              return (
                <div
                  className="flex min-w-0 flex-1 items-center justify-end gap-1.5"
                  title={tooltip}
                >
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                  <span className="min-w-0 truncate text-xs uppercase tracking-wide text-emerald-600 font-semibold">
                    {providerTitle}
                  </span>
                  {isAmd && (
                    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                      AMD
                    </span>
                  )}
                </div>
              );
            })()
          )}
        </div>
        {llmStatus !== "offline" && llmStatus !== "checking..." && (() => {
          const match = llmStatus.match(/^([^(]+?)\s*(?:\((.+)\))?$/);
          const shortLabel = (match?.[1] ?? llmStatus).trim();
          const modelDisplay = (llmModel ? llmModel.split("/").pop() : null) || shortLabel;
          return (
            <span className="truncate text-right text-[10px] font-mono text-slate-400" title={llmModel || undefined}>
              LLM: {modelDisplay}
            </span>
          );
        })()}
      </div>

      <div className="relative flex h-[350px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner font-mono dark:border-slate-900 dark:bg-slate-950">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/80 px-4 py-2 dark:border-white/5 dark:bg-zinc-900/80">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="select-none font-sans text-xs text-slate-400 dark:text-white/40">glycoswarm-terminal ~ stream</span>
          <span className="w-10" />
        </div>

        {/* Content area */}
        <div className="relative flex-1 overflow-hidden">
          {/* Scrollable logs */}
          <div
            ref={terminalContainerRef}
            className="scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-white/10 absolute inset-0 space-y-2 overflow-y-auto p-4 text-xs md:text-sm"
          >
            {terminalLogs.length === 0 && !isLoading && (
              <div className="flex h-full flex-col items-center justify-center text-center font-sans italic text-slate-400 dark:text-white/30">
                <span className="mb-2 font-mono text-xl">_</span>
                <p>&gt; Select a patient record and analyze to begin streaming...</p>
              </div>
            )}

            <div className="space-y-1.5 text-emerald-600 dark:text-emerald-400/90 font-mono">
              {terminalLogs.map((log, index) => {
                const isNewestLine = index === terminalLogs.length - 1;
                const displayedText = isNewestLine ? log.slice(0, typedCount) : log;
                const stillTyping = isNewestLine && typedCount < log.length;
                return (
                  <p key={index} className="leading-relaxed break-words">
                    {displayedText}
                    {stillTyping && (
                      <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-emerald-600 dark:bg-emerald-400 align-middle" />
                    )}
                  </p>
                );
              })}
              {isLoading && terminalLogs.length > 0 && typedCount >= terminalLogs[terminalLogs.length - 1].length && (
                <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-emerald-600 dark:bg-emerald-400" />
              )}
            </div>
          </div>
        </div>
      </div>
    </HoverScale>
  );
}