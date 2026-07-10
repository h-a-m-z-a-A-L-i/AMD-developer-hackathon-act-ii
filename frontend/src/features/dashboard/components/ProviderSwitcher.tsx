"use client";

import { useEffect, useRef, useState } from "react";
import type { ProviderOption } from "@/types";

interface ProviderSwitcherProps {
  disabled?: boolean;
  onProviderChanged?: () => void;
}

export function ProviderSwitcher({ disabled, onProviderChanged }: ProviderSwitcherProps) {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [forcedProvider, setForcedProvider] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadProviders() {
    try {
      const res = await fetch("/api/providers", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setProviders(data.providers || []);
      setForcedProvider(data.forced_provider ?? null);
    } catch {
      // Silently ignore — the switcher just won't populate options.
    }
  }

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function selectProvider(providerId: string | null) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/providers/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setForcedProvider(data.forced_provider ?? null);
        onProviderChanged?.();
      }
    } catch {
      // Leave state as-is; the dropdown stays open so the user can retry.
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  }

  const activeLabel = forcedProvider
    ? providers.find((p) => p.id === forcedProvider)?.label || forcedProvider
    : "Auto";

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        title="Switch LLM provider"
        className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
        </svg>
        <span className="max-w-[8rem] truncate">{activeLabel}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => selectProvider(null)}
            disabled={isLoading}
            className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-800 ${
              forcedProvider === null ? "bg-emerald-50 dark:bg-emerald-900/30" : ""
            }`}
          >
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Auto</span>
            <span className="text-xs text-slate-400">Normal failover chain (Fireworks → Featherless)</span>
          </button>

          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectProvider(p.id)}
              disabled={isLoading || !p.configured}
              title={!p.configured ? "Not configured — missing environment variables" : undefined}
              className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-800 ${
                forcedProvider === p.id ? "bg-emerald-50 dark:bg-emerald-900/30" : ""
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{p.label}</span>
                <span className="flex flex-shrink-0 items-center gap-1.5">
                  {p.amd_compute && (
                    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-orange-400/40 bg-orange-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                      AMD
                    </span>
                  )}
                  {!p.configured && (
                    <span className="whitespace-nowrap rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:bg-slate-800">
                      Not configured
                    </span>
                  )}
                </span>
              </span>
              <span className="text-xs text-slate-400">{p.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
