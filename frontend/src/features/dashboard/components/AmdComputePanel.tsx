"use client";

import { useEffect, useState } from "react";
import { HoverScale } from "@/components/animations/HoverScale";
import type { AmdComputeStatus, SimilarPatient } from "@/types";

interface AmdComputePanelProps {
  patientId: string | null;
}

// Small reusable AMD-branded chip. Kept in this file since it's currently
// only used here — split out if another component ends up needing it too.
function AmdChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
      AMD Instinct MI300X
    </span>
  );
}

export function AmdComputePanel({ patientId }: AmdComputePanelProps) {
  const [status, setStatus] = useState<AmdComputeStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const [similar, setSimilar] = useState<SimilarPatient[] | null>(null);
  const [similarState, setSimilarState] = useState<"idle" | "loading" | "unavailable" | "not_embedded" | "ready">("idle");

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        setStatusLoading(true);
        const res = await fetch("/api/amd-compute/status", { cache: "no-store" });
        if (!res.ok) throw new Error("status fetch failed");
        const data = await res.json();
        if (!cancelled) {
          setStatus(data);
          const models: string[] = (data.eval_summaries || []).map((e: any) => e.judge_model).filter(Boolean);
          if (models.length > 0) setSelectedModel((prev) => (prev && models.includes(prev) ? prev : models[0]));
        }
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!patientId || !status?.embeddings_available) {
      setSimilar(null);
      setSimilarState("idle");
      return;
    }
    let cancelled = false;
    async function loadSimilar() {
      try {
        setSimilarState("loading");
        const res = await fetch(`/api/amd-compute/similar/${encodeURIComponent(patientId!)}`, { cache: "no-store" });
        if (res.status === 503) {
          if (!cancelled) setSimilarState("unavailable");
          return;
        }
        if (res.status === 404) {
          if (!cancelled) setSimilarState("not_embedded");
          return;
        }
        if (!res.ok) throw new Error("similarity fetch failed");
        const data = await res.json();
        if (!cancelled) {
          setSimilar(data.similar_patients || []);
          setSimilarState("ready");
        }
      } catch {
        if (!cancelled) setSimilarState("unavailable");
      }
    }
    loadSimilar();
    return () => {
      cancelled = true;
    };
  }, [patientId, status?.embeddings_available]);

  return (
    <HoverScale className="flex flex-col gap-3 rounded-[32px] border border-slate-200 bg-white p-3 sm:p-4 transition-colors duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">AMD Compute</h3>
        {status?.has_run && <AmdChip />}
      </div>

      {statusLoading ? (
        <div className="flex items-center gap-2 py-4">
          <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300" />
          <span className="text-xs text-slate-400">Checking notebook outputs…</span>
        </div>
      ) : !status?.has_run ? (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            Not yet run on AMD Developer Cloud
          </span>
          <p>
            Offline patient-similarity + reasoning-QA outputs aren&apos;t committed yet. Run{" "}
            <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-700">
              {status?.notebook_path || "amd_compute/specialist_eval_and_embeddings.ipynb"}
            </code>{" "}
            on the MI300X instance to populate this panel.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {status.device && (
              <span>
                Device: <span className="font-mono text-slate-700 dark:text-slate-200">{status.device}</span>
              </span>
            )}
            {status.n_patients_embedded != null && (
              <span>
                Patients embedded: <span className="font-mono text-slate-700 dark:text-slate-200">{status.n_patients_embedded}</span>
              </span>
            )}
            {status.embedding_time && (
              <span>
                Embedding time: <span className="font-mono text-slate-700 dark:text-slate-200">{status.embedding_time}</span>
              </span>
            )}
          </div>

          {status.eval_summaries && status.eval_summaries.length > 0 && (() => {
            const current = status.eval_summaries.find((e) => e.judge_model === selectedModel) || status.eval_summaries[0];
            return (
              <div className="flex flex-col gap-2">
                {status.eval_summaries.length > 1 && (
                  <div className="flex gap-1.5">
                    {status.eval_summaries.map((e) => (
                      <button
                        key={e.judge_model}
                        type="button"
                        onClick={() => setSelectedModel(e.judge_model)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                          selectedModel === e.judge_model
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                        }`}
                      >
                        {e.judge_model}
                      </button>
                    ))}
                  </div>
                )}
                {current && current.n_samples != null && (
                  <div className="rounded-2xl bg-slate-50 p-2.5 text-xs dark:bg-slate-800/50">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Reasoning QA (local judge, on-GPU): </span>
                    <span className="font-mono text-slate-700 dark:text-slate-200">
                      {current.n_passed}/{current.n_samples} passed
                    </span>
                    {current.judge_model && (
                      <span className="text-slate-400"> — judge: {current.judge_model}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Similar patients{patientId ? "" : " — select a patient"}
            </p>
            {similarState === "loading" && <p className="text-xs text-slate-400">Looking up nearest neighbors…</p>}
            {similarState === "unavailable" && (
              <p className="text-xs text-slate-400">Embeddings not available yet.</p>
            )}
            {similarState === "not_embedded" && (
              <p className="text-xs text-slate-400">This patient wasn&apos;t part of the embedded batch.</p>
            )}
            {similarState === "ready" && similar && similar.length > 0 && (
              <ul className="space-y-1">
                {similar.slice(0, 5).map((s) => (
                  <li key={s.patient_id} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-600 dark:text-slate-300">{s.patient_id}</span>
                    <span className="font-mono text-slate-400">{(s.similarity * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </HoverScale>
  );
}
