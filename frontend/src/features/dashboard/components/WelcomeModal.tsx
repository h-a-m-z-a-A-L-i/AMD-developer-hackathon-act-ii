"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/theme/Logo";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Icon({ path, className = "h-5 w-5 text-slate-600" }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

const ICON_PATHS: Record<string, string> = {
  renal:
    "M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21.75v-6.774a2.25 2.25 0 00-.659-1.591L3.659 7.955A2.25 2.25 0 013 6.364V5.318c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z",
  neuropathy: "M13 10V3L4 14h7v7l9-11h-7z",
  retinalOuter: "M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  retinalInner: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  cardiovascular: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
  synthesis: "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z",
  warning: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  sandbox: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
  database: "M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3-3.582 3-8 3-8-1.343-8-3zm0 0v10c0 1.657 3.582 3 8 3s8-1.343 8-3V7m-16 5c0 1.657 3.582 3 8 3s8-1.343 8-3",
  chart: "M9 17V9m4 8V5m4 12v-6M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z",
  cpu: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 7h10v10H7V7z",
  users: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 3a4 4 0 00-3-3.87M4 9.13A4 4 0 017 5.26",
  plus: "M12 4v16m8-8H4",
  cursor: "M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59",
};

const architectureSteps = [
  { key: "renal", label: "Renal", detail: "eGFR + UACR → kidney stress", path: ICON_PATHS.renal },
  { key: "neuropathy", label: "Neuropathy", detail: "A1c + duration → nerve risk", path: ICON_PATHS.neuropathy },
  { key: "retinal", label: "Retinal", detail: "Systolic BP + duration → eye risk", path: ICON_PATHS.retinalOuter },
  { key: "cardiovascular", label: "Cardiovascular", detail: "Lipid panel → heart risk", path: ICON_PATHS.cardiovascular },
];

const TOTAL_SLIDES = 9;

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (isOpen) setActiveSlide(0);
  }, [isOpen]);

  const isFirst = activeSlide === 0;
  const isLast = activeSlide === TOTAL_SLIDES - 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative w-full sm:max-w-lg rounded-t-[32px] sm:rounded-[32px] border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden"
          >

        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <Icon path="M6 18L18 6M6 6l12 12" />
        </button>

        {/* Scrollable content area */}
        <div className="overflow-y-auto flex flex-col gap-5 px-5 pt-4 pb-3 sm:px-8 sm:pt-7 sm:pb-4">

          {/* Brand header */}
          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-[32px] bg-white p-2 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-700/60">
              <Logo className="h-full w-full object-contain" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">GlycoSwarm AI</h2>
              <p className="text-xs sm:text-sm font-medium text-slate-500 leading-snug max-w-[260px] sm:max-w-none">
                AI-powered multi-agent diabetic complication triage
              </p>
            </div>
          </div>

          {/* Slide content */}
          <div className="animate-fade-in min-h-[260px]">

            {/* Slide 0 — The Problem */}
            {activeSlide === 0 && (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">The problem</p>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                  Diabetic kidney, nerve, eye, and heart complications develop silently. Symptoms often don&apos;t appear until the damage is already advanced, and by the time a standard annual screening catches it, treatment options are more limited and more costly.
                </p>
                <div className="relative overflow-hidden rounded-[32px] bg-slate-50 p-4 pl-5">
                  <div className="absolute inset-y-0 left-0 w-[3px] bg-amber-400" />
                  <div className="flex items-center gap-1.5">
                    <Icon path={ICON_PATHS.warning} className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">The gap</p>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                    The early warning signs are already sitting in a patient&apos;s labs. Most workflows just aren&apos;t built to look for them between screenings.
                  </p>
                </div>
              </div>
            )}

            {/* Slide 1 — What it does */}
            {activeSlide === 1 && (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">What it does</p>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                  Four specialist agents screen a patient&apos;s real labs for early kidney, nerve, eye, and heart complications, years before they&apos;d surface in a standard screening.
                </p>
                <div className="rounded-[32px] border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-center gap-2">
                    <Icon path={ICON_PATHS.sandbox} className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-800">Real sandboxed execution</p>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-500">
                    Each agent writes and executes its own Python analysis code against real NHANES labs in a secure backend sandbox, not static rules dressed up as AI.
                  </p>
                </div>
              </div>
            )}

            {/* Slide 2 — Architecture / How it works */}
            {activeSlide === 2 && (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">How it works</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {architectureSteps.map((step) => (
                    <div
                      key={step.key}
                      className="flex items-center gap-3 rounded-[32px] border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                        {step.key === "retinal" ? (
                          <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICON_PATHS.retinalOuter} />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICON_PATHS.retinalInner} />
                          </svg>
                        ) : (
                          <Icon path={step.path} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{step.label}</p>
                        <p className="mt-0.5 text-xs leading-snug text-slate-500">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 rounded-[32px] border border-sky-100 bg-sky-50/50 p-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                    <Icon path={ICON_PATHS.synthesis} className="h-5 w-5 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Synthesis</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">Combines all 4 specialist outputs into one referral recommendation.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Slide 3 — Real sandboxed execution deep-dive */}
            {activeSlide === 3 && (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Under the hood</p>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                  Each specialist agent doesn&apos;t run a fixed formula. It writes its own Python analysis script, executes it in an isolated backend sandbox against that patient&apos;s real lab values, and returns a reasoned, auditable risk assessment.
                </p>
                <div className="rounded-[32px] border border-slate-800 bg-slate-900 p-4 font-mono text-[11px] sm:text-xs leading-relaxed text-emerald-400 overflow-x-auto">
                  <p className="text-slate-500">{"> [RENAL_SPECIALIST] writing analysis script..."}</p>
                  <p className="text-slate-500">{"> executing in sandbox: egfr=58.2, uacr=142.0"}</p>
                  <p>{"> risk_score=0.71  [⚠ FLAGGED]"}</p>
                </div>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-500">
                  <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-slate-400" />No static rule tables</li>
                  <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-slate-400" />Full execution trace kept for audit</li>
                  <li className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-slate-400" />Same rigor applied to every patient</li>
                </ul>
              </div>
            )}

            {/* Slide 4 — Data trust / NHANES grounding */}
            {activeSlide === 4 && (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Data you can trust</p>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                  Every risk score is grounded in NHANES, a real, nationally representative U.S. government health survey, not synthetic or toy data.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { title: "Real population data", desc: "Sourced from an actual national health survey" },
                    { title: "Nationally representative", desc: "Spans a broad range of ages & risk profiles" },
                    { title: "Familiar labs", desc: "The same panels your PCP already orders" },
                  ].map((c) => (
                    <div key={c.title} className="rounded-[32px] border border-slate-100 bg-slate-50/50 p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm mb-2">
                        <Icon path={ICON_PATHS.database} className="h-4 w-4 text-slate-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{c.title}</p>
                      <p className="mt-0.5 text-xs leading-snug text-slate-500">{c.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Slide 5 — Sample output preview */}
            {activeSlide === 5 && (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">What you get</p>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                  Every run ends with a single synthesized recommendation, not four disconnected scores.
                </p>
                <div className="rounded-[32px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                    <Icon path={ICON_PATHS.chart} className="h-4 w-4 text-slate-500" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Discovery Brief &middot; Patient #4471</p>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-slate-500">Renal</span>
                      <span className="font-semibold text-amber-600">⚠ Flagged &middot; 0.71</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-slate-500">Cardiovascular</span>
                      <span className="font-semibold text-amber-600">⚠ Flagged &middot; 0.64</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-slate-500">Neuropathy &middot; Retinal</span>
                      <span className="font-semibold text-emerald-600">Clear</span>
                    </div>
                    <div className="mt-2 rounded-xl bg-sky-50/70 border border-sky-100 p-2.5 text-xs sm:text-sm text-slate-600">
                      <span className="font-semibold text-slate-800">Recommendation: </span>
                      Refer to nephrology; recheck lipid panel in 3 months.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slide 6 — Try it yourself / Custom Patient input */}
            {activeSlide === 6 && (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Try it yourself</p>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                  Don&apos;t just browse the demo dataset. Plug in a real set of lab values and watch the swarm analyze them live.
                </p>
                <div className="relative overflow-hidden rounded-[32px] bg-slate-50 p-4 pl-5">
                  <div className="absolute inset-y-0 left-0 w-[3px] bg-emerald-400" />
                  <div className="flex items-center gap-1.5">
                    <Icon path={ICON_PATHS.cursor} className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Look for &ldquo;Custom Patient&rdquo;</p>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                    It&apos;s the highlighted button next to the patient selector at the top. Enter age, A1c, eGFR, UACR, lipid panel, and blood pressure, then run the swarm on your own numbers.
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-[32px] border border-slate-100 bg-slate-50/50 p-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                    <Icon path={ICON_PATHS.plus} className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Custom Patient</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">Same 4 specialists, same live sandbox, your own inputs.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Slide 7 — AMD compute (PLACEHOLDER, needs final details before submission) */}
            {activeSlide === 7 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Powered by</p>
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
                    Edit before submission
                  </span>
                </div>
                <div className="rounded-[32px] border-2 border-dashed border-red-300 bg-red-50/60 p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Icon path={ICON_PATHS.warning} className="h-4 w-4 flex-shrink-0 text-red-600" />
                    <p className="text-sm font-semibold text-red-700">TODO: swap in final AMD compute details</p>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed text-red-700/80">
                    We&apos;re testing on non-AMD hardware right now due to limited credits. Before submission, replace this slide with the actual AMD stack we run on (e.g. Instinct GPU / ROCm details, which agent workloads run where, any performance numbers).
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-[32px] border border-slate-100 bg-slate-50/50 p-3 opacity-60">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                    <Icon path={ICON_PATHS.cpu} className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">[Placeholder] AMD compute details go here</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">Replace before final submission</p>
                  </div>
                </div>
              </div>
            )}

            {/* Slide 8 — Impact / who this helps */}
            {activeSlide === 8 && (
              <div className="space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Who this helps</p>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                  Built for the people trying to catch complications before they become emergencies.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { title: "Primary care clinicians", desc: "Catch early signals between specialist referrals" },
                    { title: "Endocrinology & triage teams", desc: "Prioritize which patients need attention first" },
                    { title: "At-risk patients", desc: "Earlier intervention, better long-term outcomes" },
                    { title: "Population health teams", desc: "Screen at scale across large patient panels" },
                  ].map((c) => (
                    <div key={c.title} className="flex items-start gap-3 rounded-[32px] border border-slate-100 bg-slate-50/50 p-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                        <Icon path={ICON_PATHS.users} className="h-4 w-4 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{c.title}</p>
                        <p className="mt-0.5 text-xs leading-snug text-slate-500">{c.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer — always visible */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-100 bg-white px-5 py-4 sm:px-8">
          <div className="flex gap-1.5 flex-wrap max-w-[140px] sm:max-w-none">
            {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full transition-all duration-200 ${activeSlide === i ? "w-4 bg-emerald-600" : "bg-slate-200"}`}
              />
            ))}
          </div>
          <div className="flex gap-3">
            {isFirst ? (
              <>
                <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
                  Skip
                </button>
                <button onClick={() => setActiveSlide((s) => s + 1)} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800">
                  Next
                </button>
              </>
            ) : isLast ? (
              <>
                <button onClick={() => setActiveSlide((s) => s - 1)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
                  Back
                </button>
                <button onClick={onClose} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500">
                  Get started
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setActiveSlide((s) => s - 1)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
                  Back
                </button>
                <button onClick={() => setActiveSlide((s) => s + 1)} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800">
                  Next
                </button>
              </>
            )}
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
