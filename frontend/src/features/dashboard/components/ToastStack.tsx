"use client";

import { useEffect } from "react";

export interface ToastItem {
  id: string;
  specialist: string;
  label: string;
  riskScore: number | null;
}

const AUTO_DISMISS_MS = 5000;

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timeout = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [toast.id, onDismiss]);

  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-rose-200 bg-white p-4 shadow-lg animate-toast-in w-[300px] sm:w-[340px]">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 border border-rose-100">
        <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{toast.label} flagged</p>
        <p className="mt-0.5 text-xs text-slate-500 leading-snug">
          {toast.riskScore !== null
            ? `Risk score ${Math.round(toast.riskScore * 100)}% — anomaly detected in this pass.`
            : "Anomaly detected in this pass."}
        </p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 rounded-full p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2.5 sm:bottom-6 sm:right-6">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes toast-in {
          0% { opacity: 0; transform: translateY(12px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-toast-in {
          animation: toast-in 0.25s ease-out;
        }
      `}} />
    </div>
  );
}
