"use client";

import { useState } from "react";
import { Demographics, Labs, SpecialistResult, SynthesisReport } from "@/types";

interface ReportExportProps {
  patientId: string | null;
  demographics: Demographics | null;
  labs: Labs | null;
  specialists: SpecialistResult[];
  synthesis: SynthesisReport | null;
  clinicalBrief: string;
  isBriefLoading?: boolean; // true while the LLM report agent is generating the brief
}

export function ReportExport({
  patientId,
  clinicalBrief,
  isBriefLoading = false,
}: ReportExportProps) {
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  function handleCopyBrief() {
    if (!clinicalBrief) return;
    navigator.clipboard.writeText(clinicalBrief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadBrief() {
    if (!clinicalBrief || !patientId) return;
    try {
      const blob = new Blob([clinicalBrief], { type: "text/plain;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `clinical_brief_${patientId}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
      setStatusMessage("Clinical report downloaded successfully.");
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (err) {
      console.error("Export failed:", err);
      setStatusMessage("Failed to download local brief document.");
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 transition-all duration-200 hover:border-slate-300 hover:shadow-md space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border border-slate-100 bg-slate-50/50 rounded-2xl p-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-800">
            Clinical discovery brief &amp; document export
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBriefLoading
              ? "Generating clinical discovery brief via LLM report agent..."
              : clinicalBrief
              ? "Brief auto-generated. Copy or download below."
              : "Run an analysis to auto-generate the clinical discovery brief."}
          </p>
          {statusMessage && (
            <p className="mt-1.5 text-xs text-emerald-600 font-mono font-medium">{statusMessage}</p>
          )}
        </div>

        {/* Action buttons — only shown when a brief is available */}
        {clinicalBrief && (
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyBrief}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors whitespace-nowrap w-full sm:w-auto text-center flex items-center gap-1.5"
            >
              {copied ? "✓ Copied" : "Copy to Clipboard"}
            </button>
            <button
              onClick={handleDownloadBrief}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition-colors whitespace-nowrap w-full sm:w-auto text-center shadow-sm"
            >
              Download (.TXT)
            </button>
          </div>
        )}
      </div>

      {/* Brief output */}
      {clinicalBrief && (
        <div className="space-y-3 animate-fade-in">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Discovery Brief Document
          </span>
          <div className="relative rounded-2xl border border-slate-200 bg-slate-950 p-5 shadow-inner">
            <pre className="scrollbar-thin scrollbar-thumb-white/10 max-h-[400px] overflow-y-auto font-mono text-xs md:text-sm text-sky-400/90 whitespace-pre-wrap leading-relaxed">
              {clinicalBrief}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}