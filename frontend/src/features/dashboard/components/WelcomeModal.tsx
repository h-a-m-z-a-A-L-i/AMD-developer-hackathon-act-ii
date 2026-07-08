"use client";

import { useEffect, useState } from "react";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function StepIcon({ type }: { type: string }) {
  const common = "h-5 w-5 text-slate-600";
  switch (type) {
    case "renal":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21.75v-6.774a2.25 2.25 0 00-.659-1.591L3.659 7.955A2.25 2.25 0 013 6.364V5.318c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
        </svg>
      );
    case "neuropathy":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case "retinal":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "cardiovascular":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case "synthesis":
      return (
        <svg className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
      );
    default:
      return null;
  }
}

const steps = [
  { type: "renal", label: "Renal", detail: "eGFR + UACR → kidney stress" },
  { type: "neuropathy", label: "Neuropathy", detail: "A1c + duration → nerve risk" },
  { type: "retinal", label: "Retinal", detail: "Systolic BP + duration → eye risk" },
  { type: "cardiovascular", label: "Cardiovascular", detail: "Lipid panel → heart risk" },
];

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (isOpen) setActiveSlide(0);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    /* Overlay — bottom-sheet on mobile, centered dialog on sm+ */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">

        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable content area */}
        <div className="overflow-y-auto flex flex-col gap-5 px-5 pt-4 pb-3 sm:px-8 sm:pt-7 sm:pb-4">

          {/* Brand header */}
          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 items-center justify-center overflow-hidden">
              <img src="/glycoswarmlogo.png" alt="GlycoSwarm AI" className="h-full w-full object-contain" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">GlycoSwarm AI</h2>
              <p className="text-xs sm:text-sm font-medium text-slate-500 leading-snug max-w-[260px] sm:max-w-none">
                AI-powered multi-agent diabetic complication triage
              </p>
            </div>
          </div>

          {/* Slide content */}
          <div className="animate-fade-in">
            {activeSlide === 0 ? (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">What it does</p>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                  Four specialist agents screen a patient&apos;s real labs for early kidney, nerve, eye, and heart complications &mdash; years before they&apos;d surface in a standard screening.
                </p>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 flex-shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <p className="text-sm font-semibold text-slate-800">Real sandboxed execution</p>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-500">
                    Each agent writes and executes its own Python analysis code against real NHANES labs in a secure backend sandbox &mdash; not static rules dressed up as AI.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">How it works</p>

                {/* 1 col on mobile, 2 col on sm+ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {steps.map((step) => (
                    <div
                      key={step.type}
                      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                        <StepIcon type={step.type} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{step.label}</p>
                        <p className="mt-0.5 text-xs leading-snug text-slate-500">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                    <StepIcon type="synthesis" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Synthesis</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">Combines all 4 specialist outputs into one referral recommendation.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer — always visible */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-100 bg-white px-5 py-4 sm:px-8">
          <div className="flex gap-1.5">
            <span className={`h-2 w-2 rounded-full transition-all duration-200 ${activeSlide === 0 ? "w-4 bg-emerald-600" : "bg-slate-200"}`} />
            <span className={`h-2 w-2 rounded-full transition-all duration-200 ${activeSlide === 1 ? "w-4 bg-emerald-600" : "bg-slate-200"}`} />
          </div>
          <div className="flex gap-3">
            {activeSlide === 0 ? (
              <>
                <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
                  Skip
                </button>
                <button onClick={() => setActiveSlide(1)} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800">
                  Next
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setActiveSlide(0)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
                  Back
                </button>
                <button onClick={onClose} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500">
                  Get started
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}