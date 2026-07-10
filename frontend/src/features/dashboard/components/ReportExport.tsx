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
  canGenerateBrief?: boolean; // true once a completed analysis exists to generate from
  onGenerateBrief?: () => void; // manual trigger — brief no longer auto-generates
}

export function ReportExport({
  patientId,
  clinicalBrief,
  isBriefLoading = false,
  canGenerateBrief = false,
  onGenerateBrief,
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

  const describeState = () => {
    if (isBriefLoading) return "Generating clinical discovery brief via LLM report agent...";
    if (clinicalBrief) return "Brief generated. Copy or download below.";
    if (canGenerateBrief) return "Analysis complete. Click Generate to create the clinical discovery brief.";
    return "Run an analysis, then generate the clinical discovery brief.";
  };

  return (
    <div className="rounded-[32px] border border-slate-200 bg-white p-3 sm:p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-md space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-slate-100 bg-slate-50/50 rounded-[32px] p-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-800">
            Clinical discovery brief &amp; document export
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{describeState()}</p>
          {statusMessage && (
            <p className="mt-1.5 text-xs text-emerald-600 font-mono font-medium">{statusMessage}</p>
          )}
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {/* Generate button — shown whenever there's no brief yet to show */}
          {!clinicalBrief && (
            <button
              onClick={onGenerateBrief}
              disabled={!canGenerateBrief || isBriefLoading}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors whitespace-nowrap w-full sm:w-auto text-center shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isBriefLoading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                  <span>Generating...</span>
                </>
              ) : (
                <span>Generate Discovery Brief</span>
              )}
            </button>
          )}

          {/* Action buttons — only shown once a brief is available */}
          {clinicalBrief && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Brief output */}
      {clinicalBrief && (
        <div className="space-y-3 animate-fade-in">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Discovery Brief Document
          </span>
          <div className="relative rounded-[32px] border border-slate-200 bg-slate-950 p-5 shadow-inner">
            <pre className="scrollbar-thin scrollbar-thumb-white/10 max-h-[400px] overflow-y-auto font-mono text-xs md:text-sm text-sky-400/90 whitespace-pre-wrap leading-relaxed">
              {clinicalBrief}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
