"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ToastItem {
  id: string;
  specialist: string;
  label: string;
  riskScore: number | null;
}

const AUTO_DISMISS_MS = 3000;

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timeout = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timeout);
  }, [toast.id, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="pointer-events-auto flex items-start gap-3 rounded-[32px] border border-rose-200 bg-white p-4 shadow-lg w-[300px] sm:w-[340px]"
    >
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
    </motion.div>
  );
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[60] flex flex-col gap-2.5 sm:top-4 sm:right-6">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
