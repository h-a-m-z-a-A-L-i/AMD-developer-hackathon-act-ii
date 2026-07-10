"use client";

import { useState } from "react";
import { SpecialistResult, SynthesisReport, BenchmarkSummary } from "@/types";
import { PipelineVisualizer } from "./PipelineVisualizer";
import { OrganRiskMap } from "./OrganRiskMap";
import { SynthesisCallout } from "./SynthesisCallout";
import { ClinicalWarningLegend } from "./ClinicalWarningLegend";
import { HoverScale } from "@/components/animations/HoverScale";

interface SwarmDiagnosticsTabsProps {
  specialists: SpecialistResult[];
  synthesis: SynthesisReport | null;
  isLoading: boolean;
  patientId: string | null;
  llmStatus: string;
  llmModel: string | null;
  benchmark?: BenchmarkSummary | null;
}

const specialistMeta: Record<string, { label: string; themeColor: string }> = {
  renal: { label: "Renal Specialist", themeColor: "indigo" },
  neuropathy: { label: "Neuropathy Specialist", themeColor: "violet" },
  retinal: { label: "Retinal Specialist", themeColor: "amber" },
  cardiovascular: { label: "Cardiovascular Specialist", themeColor: "rose" },
};

function SpecialistIcon({ type, className = "h-5 w-5" }: { type: string; className?: string }) {
  switch (type) {
    case "renal":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21.75v-6.774a2.25 2.25 0 00-.659-1.591L3.659 7.955A2.25 2.25 0 013 6.364V5.318c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
        </svg>
      );
    case "neuropathy":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "retinal":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "cardiovascular":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
      );
  }
}

const labLabels: Record<string, string> = {
  egfr: "eGFR (Kidney Function)",
  uacr_mg_g: "UACR (Albumin/Creatinine Ratio)",
  creatinine_mg_dl: "Serum Creatinine",
  ldl_mg_dl: "LDL Cholesterol",
  hdl_mg_dl: "HDL Cholesterol",
  triglycerides_mg_dl: "Triglycerides",
  systolic_bp: "Systolic Blood Pressure",
  a1c_percent: "HbA1c Percentage",
  years_with_diabetes: "Duration of Diabetes",
};

export function SwarmDiagnosticsTabs({
  specialists = [],
  synthesis,
  isLoading,
  patientId,
  llmStatus,
  llmModel,
  benchmark,
}: SwarmDiagnosticsTabsProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "analysis" | "logs" | "benchmark">("overview");
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const ALL_SPECIALIST_KEYS = Object.keys(specialistMeta);
  const arrivedKeys = new Set(specialists.map((s) => s.specialist));
  const pendingKeys = isLoading ? ALL_SPECIALIST_KEYS.filter((k) => !arrivedKeys.has(k)) : [];

  const toggleLog = (key: string) => {
    setExpandedLogs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyCode = (code: string, specName: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(specName);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Average duration across specialists that actually ran, used only for
  // the benchmark tab's derived fallback object below - not a clinical value.
  const activeBenchmark = benchmark || (synthesis ? {
    total_duration_ms: specialists.reduce((acc, s) => acc + s.duration_ms, 0) + (synthesis.duration_ms || 0),
    agents_run: 5,
    llm_calls_made: specialists.filter(s => s.used_llm).length + (synthesis.used_llm ? 1 : 0),
    provider: (synthesis.used_llm ? (llmStatus as any) : null),
    provider_detail: (synthesis.used_llm ? llmStatus : null),
  } : null);

  return (
    <div className="flex flex-col gap-3">

      {/* Horizontally scrollable tab row — no wrapping on any screen size */}
      <div className="-mx-px flex overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {(["overview", "analysis", "logs", "benchmark"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-3 xs:px-5 py-3 text-sm font-semibold border-b-2 capitalize transition-all duration-200 whitespace-nowrap ${activeTab === tab
                ? "border-emerald-600 text-emerald-700 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="min-h-[400px] min-w-0">
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in min-w-0">
            <PipelineVisualizer
              specialists={specialists}
              synthesis={synthesis}
              isLoading={isLoading}
              patientId={patientId}
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <HoverScale className={`min-h-[620px] rounded-[32px] border border-slate-200 bg-white p-3 sm:p-4 overflow-hidden transition-colors duration-200 hover:border-slate-300 hover:shadow-md ${isLoading ? "lg:col-span-7 xl:col-span-8" : "lg:col-span-12"}`}>
                <OrganRiskMap
                  specialists={specialists}
                  synthesis={synthesis}
                  isLoading={isLoading}
                />
              </HoverScale>
              {isLoading && (
                <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-center gap-3">
                  <SynthesisCallout
                    specialists={specialists}
                    synthesis={synthesis}
                    isLoading={isLoading}
                  />
                  <ClinicalWarningLegend />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="space-y-6 animate-fade-in">
            {specialists.length === 0 && !isLoading ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-[32px] border border-dashed border-slate-200 text-center p-8">
                <svg className="h-10 w-10 text-slate-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
                <p className="text-sm font-semibold text-slate-500">No threshold mapping yet</p>
                <p className="text-xs text-slate-400 max-w-[280px]">Run the swarm on a patient to see each specialist&apos;s reasoning, referenced labs, and applied cutoffs here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {specialists.map((spec) => {
                  const meta = specialistMeta[spec.specialist] ?? { label: spec.specialist.toUpperCase(), themeColor: "slate" };
                  const thresholdEntries = Object.entries(spec.thresholds_used || {});
                  const labEntries = Object.entries(spec.input_labs || {});

                  return (
                    <HoverScale
                      key={spec.specialist}
                      className="rounded-[32px] border border-slate-200 bg-white p-4 transition-colors duration-200 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <SpecialistIcon type={spec.specialist} className="h-5 w-5 text-slate-600" />
                          <h4 className="font-bold text-slate-800">{meta.label}</h4>
                        </div>
                        {!spec.available ? (
                          <span className="rounded-full px-3 py-1 text-xs font-semibold border bg-slate-100 text-slate-500 border-slate-200">
                            &mdash; Unavailable
                          </span>
                        ) : (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${spec.flag
                              ? "bg-rose-50 text-rose-700 border-rose-100/50"
                              : "bg-emerald-50 text-emerald-700 border-emerald-100/50"
                            }`}>
                            {spec.flag ? "⚠️ Anomalies Flagged" : "✓ Clear of Early Flags"}
                          </span>
                        )}
                      </div>

                      {!spec.available ? (
                        <div className="rounded-[32px] border border-dashed border-slate-300 bg-slate-50/60 p-5">
                          <p className="text-sm text-slate-500 leading-relaxed">
                            No analysis was performed for this specialist &mdash; there is no rule-based
                            fallback in this system. <span className="font-medium text-slate-600">{spec.reasoning}</span>
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                          <div className="lg:col-span-6 space-y-2">
                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Clinical Reasoning</h5>
                            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-[32px] border border-slate-100">
                              {spec.reasoning}
                            </p>
                            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400 font-mono">
                              <span>Score Risk Level:</span>
                              <span className={spec.flag ? "text-rose-600" : (spec.risk_score ?? 0) >= 0.4 ? "text-amber-600" : "text-emerald-600"}>
                                {spec.risk_score !== null ? `${(spec.risk_score * 100).toFixed(0)}%` : "N/A"}
                              </span>
                            </div>
                          </div>

                          <div className="lg:col-span-6 space-y-4">
                            <div className="space-y-2">
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Patient Values Referenced</h5>
                              <div className="rounded-[32px] border border-slate-200 bg-slate-50/20 divide-y divide-slate-200">
                                {labEntries.length === 0 ? (
                                  <p className="p-3 text-xs text-slate-400 italic">No lab values recorded for this specialist.</p>
                                ) : labEntries.map(([labKey, val]) => (
                                  <div key={labKey} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                    <span className="font-semibold text-slate-700">{labLabels[labKey] || labKey}</span>
                                    <span className="font-mono text-slate-600">{typeof val === "number" ? val.toFixed(val % 1 === 0 ? 0 : 2) : String(val)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Cutoffs The Model Applied This Run
                              </h5>
                              <div className="rounded-[32px] border border-slate-200 bg-slate-50/20 divide-y divide-slate-200">
                                {thresholdEntries.length === 0 ? (
                                  <p className="p-3 text-xs text-slate-400 italic">
                                    The model didn&apos;t report explicit numeric thresholds for this run &mdash; see the reasoning text above.
                                  </p>
                                ) : thresholdEntries.map(([label, val]) => (
                                  <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                    <span className="font-semibold text-slate-700">{label}</span>
                                    <span className="font-mono text-slate-600">{typeof val === "number" ? val.toFixed(val % 1 === 0 ? 0 : 2) : String(val)}</span>
                                  </div>
                                ))}
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed">
                                These are the exact cutoffs the model reported using this run &mdash; not a fixed reference table. They may vary patient to patient.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </HoverScale>
                  );
                })}

                {pendingKeys.map((key) => {
                  const meta = specialistMeta[key];
                  return (
                    <div key={key} className="rounded-[32px] border border-slate-200 bg-white p-4 animate-pulse">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <SpecialistIcon type={key} className="h-5 w-5 text-slate-300" />
                          <h4 className="font-bold text-slate-400">{meta.label}</h4>
                        </div>
                        <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border bg-sky-50 text-sky-600 border-sky-100">
                          <span className="h-3 w-3 animate-spin rounded-full border border-sky-500 border-t-transparent" />
                          Analyzing&hellip;
                        </span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                        <div className="lg:col-span-6 space-y-2">
                          <div className="h-3 w-32 rounded-full bg-slate-100" />
                          <div className="h-16 rounded-[32px] bg-slate-50 border border-slate-100" />
                        </div>
                        <div className="lg:col-span-6 space-y-2">
                          <div className="h-3 w-40 rounded-full bg-slate-100" />
                          <div className="h-16 rounded-[32px] bg-slate-50 border border-slate-100" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="space-y-6 animate-fade-in">
            {specialists.length === 0 && !isLoading ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-[32px] border border-dashed border-slate-200 text-center p-8">
                <svg className="h-10 w-10 text-slate-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <p className="text-sm font-semibold text-slate-500">No execution traces yet</p>
                <p className="text-xs text-slate-400 max-w-[280px]">Run the swarm to see each agent&apos;s step-by-step trace and the sandboxed Python it actually executed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {specialists.map((spec) => {
                  const meta = specialistMeta[spec.specialist] ?? { label: spec.specialist.toUpperCase(), themeColor: "slate" };
                  const isExpanded = !!expandedLogs[spec.specialist];
                  return (
                    <HoverScale
                      key={spec.specialist}
                      className="rounded-[32px] border border-slate-200 bg-white overflow-hidden transition-colors duration-200 hover:border-slate-300 hover:shadow-md"
                    >
                      <button
                        onClick={() => toggleLog(spec.specialist)}
                        className="w-full flex items-center justify-between p-5 bg-slate-50/40 hover:bg-slate-50 border-b border-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <SpecialistIcon type={spec.specialist} className="h-5 w-5 text-slate-600" />
                          <div className="text-left">
                            <h4 className="font-bold text-slate-800">{meta.label} Code Log</h4>
                            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                              <span>Duration: {spec.duration_ms} ms</span>
                              <span>&middot;</span>
                              <span>Mode: {spec.available ? "LLM Sandbox" : "Unavailable"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {spec.available ? (
                            <span className="rounded-full bg-emerald-50 border border-emerald-100/50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                              LLM
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              Unavailable
                            </span>
                          )}
                          <svg
                            className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${isExpanded ? "transform rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 space-y-6 bg-white animate-slide-down">
                          <div className="space-y-2">
                            <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Execution Steps Trace</h5>
                            <ol className="relative border-l border-slate-200 ml-2.5 space-y-4">
                              {spec.steps.map((step, idx) => (
                                <li key={idx} className="mb-4 ml-6">
                                  <span className="absolute flex items-center justify-center w-5 h-5 bg-sky-50 text-sky-600 rounded-full -left-2.5 border border-sky-100 font-mono text-[10px] font-bold">
                                    {idx + 1}
                                  </span>
                                  <p className="text-sm text-slate-600 font-medium leading-relaxed">{step}</p>
                                </li>
                              ))}
                            </ol>
                          </div>

                          {spec.code_used && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Executed Sandbox Python Code</h5>
                                <button
                                  onClick={() => handleCopyCode(spec.code_used!, spec.specialist)}
                                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 transition-colors flex items-center gap-1.5"
                                >
                                  {copiedCode === spec.specialist ? "✓ Copied" : "Copy Code"}
                                </button>
                              </div>
                              <pre className="rounded-[32px] border border-slate-900 bg-slate-950 p-4 overflow-x-auto text-xs text-emerald-400/90 font-mono leading-relaxed shadow-inner max-h-[300px] scrollbar-thin">
                                <code>{spec.code_used}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </HoverScale>
                  );
                })}

                {pendingKeys.map((key) => {
                  const meta = specialistMeta[key];
                  return (
                    <div key={key} className="rounded-[32px] border border-slate-200 bg-white overflow-hidden animate-pulse">
                      <div className="w-full flex items-center justify-between p-5 bg-slate-50/40 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <SpecialistIcon type={key} className="h-5 w-5 text-slate-300" />
                          <div className="text-left">
                            <h4 className="font-bold text-slate-400">{meta.label} Code Log</h4>
                            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 mt-0.5">
                              <span className="h-2.5 w-24 rounded-full bg-slate-100 inline-block" />
                            </div>
                          </div>
                        </div>
                        <span className="flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-100 px-2.5 py-0.5 text-[10px] font-bold text-sky-600 uppercase tracking-wide">
                          <span className="h-2.5 w-2.5 animate-spin rounded-full border border-sky-500 border-t-transparent" />
                          Running
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "benchmark" && (
          <div className="space-y-6 animate-fade-in">
            {activeBenchmark ? (
              <HoverScale className="rounded-[32px] border border-slate-200 bg-white p-4 transition-colors duration-200 hover:border-slate-300 hover:shadow-md">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-6">
                  <div>
                    <h4 className="font-bold text-slate-800">Swarm Performance Diagnostics</h4>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Latency & API Call Audits</p>
                  </div>
                  <span className="rounded-full bg-sky-50 border border-sky-100/50 px-3 py-1 text-xs font-semibold text-sky-700 font-mono">
                    Provider: {activeBenchmark.provider_detail || activeBenchmark.provider || "None (LLM Unreachable)"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                  <div className="rounded-[32px] border border-slate-100 bg-slate-50/50 p-4 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Duration</span>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-800">{activeBenchmark.total_duration_ms} ms</p>
                  </div>
                  <div className="rounded-[32px] border border-slate-100 bg-slate-50/50 p-4 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agents Executed</span>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-800">{activeBenchmark.agents_run}</p>
                  </div>
                  <div className="rounded-[32px] border border-slate-100 bg-slate-50/50 p-4 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LLM API Calls</span>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-800">{activeBenchmark.llm_calls_made}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Wall-Clock Latency breakdown</h5>
                  <div className="space-y-3">
                    {specialists.map((spec) => {
                      const meta = specialistMeta[spec.specialist] ?? { label: spec.specialist.toUpperCase() };
                      const pct = activeBenchmark.total_duration_ms > 0
                        ? Math.max(2, Math.min(100, (spec.duration_ms / activeBenchmark.total_duration_ms) * 100))
                        : 2;
                      return (
                        <div key={spec.specialist} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-slate-600">
                            <span>{meta.label}</span>
                            <span className="font-mono">{spec.duration_ms} ms</span>
                          </div>
                          <div className="h-3 rounded-full bg-slate-100 overflow-hidden relative">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {synthesis && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-600">
                          <span>Synthesis Consolidator</span>
                          <span className="font-mono">{synthesis.duration_ms || 0} ms</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-100 overflow-hidden relative">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                            style={{
                              width: `${activeBenchmark.total_duration_ms > 0
                                ? Math.max(2, Math.min(100, ((synthesis.duration_ms || 0) / activeBenchmark.total_duration_ms) * 100))
                                : 2}%`
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {llmModel && (
                  <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>Active LLM Model</span>
                    <span className="text-slate-600 font-semibold">{llmModel}</span>
                  </div>
                )}
              </HoverScale>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-[32px] border border-dashed border-slate-200 text-center p-8">
                {isLoading ? (
                  <>
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent mb-1" />
                    <p className="text-sm font-semibold text-slate-500">Timing the swarm run&hellip;</p>
                    <p className="text-xs text-slate-400 max-w-[280px]">Latency and API call diagnostics finalize once the pipeline completes.</p>
                  </>
                ) : (
                  <>
                    <svg className="h-10 w-10 text-slate-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V9m4 8V5m4 12v-6M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm font-semibold text-slate-500">No benchmark data yet</p>
                    <p className="text-xs text-slate-400 max-w-[280px]">Run the swarm to see latency, agent count, and LLM call diagnostics for that pass.</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
