"use client";

import { useState } from "react";
import { SpecialistResult, SynthesisReport, BenchmarkSummary } from "@/types";
import { PipelineVisualizer } from "./PipelineVisualizer";
import { OrganRiskMap } from "./OrganRiskMap";
import { SynthesisCallout } from "./SynthesisCallout";
import { ClinicalWarningLegend } from "./ClinicalWarningLegend";

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

  const toggleLog = (key: string) => {
    setExpandedLogs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopyCode = (code: string, specName: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(specName);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const isCutoffBreached = (key: string, val: number, threshold: number) => {
    if (key.toLowerCase().includes("egfr")) {
      return val < threshold;
    }
    return val > threshold;
  };

  const getStatusBadge = (key: string, val: number, threshold: number) => {
    const breached = isCutoffBreached(key, val, threshold);
    if (breached) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-100/50 px-2.5 py-0.5 text-xs font-semibold text-rose-600">
          <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Early Flag
        </span>
      );
    }
    return (
      <span className="rounded-full bg-emerald-50 border border-emerald-100/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
        Normal
      </span>
    );
  };

  const getThresholdValue = (labKey: string, thresholds: Record<string, number>) => {
    if (labKey === "egfr") return thresholds["egfr_cutoff"] ?? 84.8;
    if (labKey === "uacr_mg_g") return thresholds["uacr_cutoff"] ?? 15.5;
    if (labKey === "creatinine_mg_dl") return thresholds["creatinine_cutoff"] ?? 1.1;
    if (labKey === "a1c_percent") return thresholds["a1c_cutoff"] ?? 6.8;
    if (labKey === "years_with_diabetes") return thresholds["years_cutoff"] ?? 10;

    const prefix = labKey.split("_")[0];
    const match = Object.keys(thresholds).find((k) => k.startsWith(prefix));
    if (match) return thresholds[match];

    if (labKey.includes("ldl")) return 100;
    if (labKey.includes("hdl")) return 40;
    if (labKey.includes("triglycerides")) return 150;
    if (labKey.includes("systolic")) return 130;
    return 0;
  };

  const activeBenchmark = benchmark || (synthesis ? {
    total_duration_ms: specialists.reduce((acc, s) => acc + s.duration_ms, 0) + (synthesis.duration_ms || 0),
    agents_run: 5,
    llm_calls_made: specialists.filter(s => s.used_llm).length + (synthesis.used_llm ? 1 : 0),
    provider: (synthesis.used_llm ? (llmStatus as any) : null),
  } : null);

  return (
    <div className="flex flex-col gap-6">

      {/* Horizontally scrollable tab row — no wrapping on any screen size */}
      <div className="-mx-px flex overflow-x-auto border-b border-slate-200 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
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

      <div className="min-h-[400px]">
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            <PipelineVisualizer
              specialists={specialists}
              synthesis={synthesis}
              isLoading={isLoading}
              patientId={patientId}
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 xl:col-span-8 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md">
                <OrganRiskMap
                  specialists={specialists}
                  synthesis={synthesis}
                  isLoading={isLoading}
                />
              </div>
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
                <SynthesisCallout
                  specialists={specialists}
                  synthesis={synthesis}
                  isLoading={isLoading}
                />
                <ClinicalWarningLegend />
              </div>
            </div>
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="space-y-6 animate-fade-in">
            {specialists.length === 0 ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-slate-400 font-sans italic">
                Awaiting swarm analysis data to construct threshold mapping...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {specialists.map((spec) => {
                  const meta = specialistMeta[spec.specialist] ?? { label: spec.specialist.toUpperCase(), themeColor: "slate" };
                  return (
                    <div
                      key={spec.specialist}
                      className="rounded-3xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <SpecialistIcon type={spec.specialist} className="h-5 w-5 text-slate-600" />
                          <h4 className="font-bold text-slate-800">{meta.label}</h4>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${spec.flag
                            ? "bg-rose-50 text-rose-700 border-rose-100/50"
                            : "bg-emerald-50 text-emerald-700 border-emerald-100/50"
                          }`}>
                          {spec.flag ? "⚠️ Anomalies Flagged" : "✓ Clear of Early Flags"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-6 space-y-2">
                          <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Clinical Reasoning</h5>
                          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                            {spec.reasoning}
                          </p>
                          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400 font-mono">
                            <span>Score Risk Level:</span>
                            <span className={spec.flag ? "text-rose-600" : spec.risk_score >= 0.4 ? "text-amber-600" : "text-emerald-600"}>
                              {(spec.risk_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        <div className="lg:col-span-6 space-y-2">
                          <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Early-Warning Threshold Comparison</h5>
                          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/20">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Biomarker</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Patient Value</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Early Cutoff</th>
                                  <th scope="col" className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 bg-white">
                                {Object.entries(spec.input_labs).map(([labKey, val]) => {
                                  const threshold = getThresholdValue(labKey, spec.thresholds_used);
                                  return (
                                    <tr key={labKey} className="hover:bg-slate-50/30">
                                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                                        {labLabels[labKey] || labKey}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-600">
                                        {val.toFixed(val % 1 === 0 ? 0 : 2)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-400">
                                        {threshold.toFixed(threshold % 1 === 0 ? 0 : 2)}
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3">
                                        {getStatusBadge(labKey, val, threshold)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
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
            {specialists.length === 0 ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-slate-400 font-sans italic">
                Awaiting sandbox outputs to populate agent execution traces...
              </div>
            ) : (
              <div className="space-y-4">
                {specialists.map((spec) => {
                  const meta = specialistMeta[spec.specialist] ?? { label: spec.specialist.toUpperCase(), themeColor: "slate" };
                  const isExpanded = !!expandedLogs[spec.specialist];
                  return (
                    <div
                      key={spec.specialist}
                      className="rounded-3xl border border-slate-200 bg-white overflow-hidden transition-all duration-200 hover:border-slate-300 hover:shadow-md"
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
                              <span>Mode: {spec.used_llm ? "LLM Sandbox" : "Deterministic Fallback"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {spec.used_llm ? (
                            <span className="rounded-full bg-emerald-50 border border-emerald-100/50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                              LLM
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                              Deterministic
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
                        <div className="p-6 space-y-6 bg-white animate-slide-down">
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
                              <pre className="rounded-2xl border border-slate-900 bg-slate-950 p-4 overflow-x-auto text-xs text-emerald-400/90 font-mono leading-relaxed shadow-inner max-h-[300px] scrollbar-thin">
                                <code>{spec.code_used}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
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
              <div className="rounded-3xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-6">
                  <div>
                    <h4 className="font-bold text-slate-800">Swarm Performance Diagnostics</h4>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Latency & API Call Audits</p>
                  </div>
                  <span className="rounded-full bg-sky-50 border border-sky-100/50 px-3 py-1 text-xs font-semibold text-sky-700 font-mono">
                    Provider: {activeBenchmark.provider || "None (Rule-based Fallback)"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Duration</span>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-800">{activeBenchmark.total_duration_ms} ms</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agents Executed</span>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-800">{activeBenchmark.agents_run}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-center">
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
                  <div className="mt-6 border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between text-xs text-slate-400 font-mono gap-1">
                    <span>Active LLM Model: {llmModel}</span>
                    <span>Provider Mode: {llmStatus}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-slate-400 font-sans italic">
                Awaiting pipeline analysis to generate benchmark diagrams...
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}