"use client";

import { useEffect, useRef, useState } from "react";
import { PatientOverviewHeader } from "@/features/dashboard/components/PatientOverviewHeader";
import { LabsPanel } from "@/features/dashboard/components/LabsPanel";
import { LiveAgentTerminal } from "@/features/dashboard/components/LiveAgentTerminal";
import { ReportExport } from "@/features/dashboard/components/ReportExport";
import { WelcomeModal } from "@/features/dashboard/components/WelcomeModal";
import { SwarmDiagnosticsTabs } from "@/features/dashboard/components/SwarmDiagnosticsTabs";
import { CustomPatientModal } from "@/features/dashboard/components/CustomPatientModal";
import { ToastStack, ToastItem } from "@/features/dashboard/components/ToastStack";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Logo } from "@/components/theme/Logo";
import { RecordSelect } from "@/features/dashboard/components/RecordSelect";
import { ProviderSwitcher } from "@/features/dashboard/components/ProviderSwitcher";
import { fetchBrief } from "@/lib/generateBrief";
import { HoverScale } from "@/components/animations/HoverScale";
import type {
  PatientDropdownItem,
  Demographics,
  Labs,
  SpecialistResult,
  SynthesisReport,
  BenchmarkSummary,
  CustomPatientInput,
} from "@/types";

const specialistLabels: Record<string, string> = {
  retinal: "RETINAL_SPECIALIST",
  renal: "RENAL_SPECIALIST",
  neuropathy: "NEUROPATHY_SPECIALIST",
  cardiovascular: "CARDIOVASCULAR_SPECIALIST",
};

const specialistFriendlyNames: Record<string, string> = {
  retinal: "Retinal",
  renal: "Renal",
  neuropathy: "Neuropathy",
  cardiovascular: "Cardiovascular",
};

export default function DashboardPage() {
  const [patients, setPatients] = useState<PatientDropdownItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

  const refreshStatusRef = useRef<() => void>(() => {});

  // Invalidates any in-flight manual "Generate Discovery Brief" request when
  // a new analysis starts or the patient changes. Without this, a slow brief
  // request could resolve AFTER the user switched patients/reran, silently
  // overwriting the (correctly cleared) brief state with stale text from the
  // previous patient.
  const briefRequestIdRef = useRef(0);

  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [labs, setLabs] = useState<Labs | null>(null);
  const [specialists, setSpecialists] = useState<SpecialistResult[]>([]);
  const [synthesis, setSynthesis] = useState<SynthesisReport | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkSummary | null>(null);

  const [isPatientsLoading, setIsPatientsLoading] = useState<boolean>(true);
  const [isPipelineRunning, setIsPipelineRunning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [llmStatus, setLlmStatus] = useState<string>("checking...");
  const [llmModel, setLlmModel] = useState<string | null>(null);

  // Onboarding welcome modal state
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // Custom patient modal states
  const [isCustomModalOpen, setIsCustomModalOpen] = useState<boolean>(false);
  const [backendFieldErrors, setBackendFieldErrors] = useState<Record<string, string>>({});

  // Real-time terminal logs state
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  // Toast notifications for flagged specialist results
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Auto-generated clinical brief state
  const [clinicalBrief, setClinicalBrief] = useState<string>("");
  const [isBriefLoading, setIsBriefLoading] = useState<boolean>(false);

  // Tracks the active custom patient ID separately so a custom run never
  // overwrites the dataset dropdown’s selectedPatientId. Cleared when the
  // user switches back to a dataset patient.
  const [customPatientId, setCustomPatientId] = useState<string | null>(null);

  // The ID to show in the header, brief, and other display components.
  // Prefers the custom patient when one is active.
  const displayPatientId = customPatientId || selectedPatientId;

  useEffect(() => {
    async function loadPatients() {
      try {
        setIsPatientsLoading(true);
        const res = await fetch("/api/patients");
        if (!res.ok) throw new Error("Could not acquire patient index repository.");
        const data = await res.json();
        setPatients(data);

        if (data.length > 0) {
          setSelectedPatientId(data[0].patient_id);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed initializing patient records list.");
      } finally {
        setIsPatientsLoading(false);
      }
    }

    async function loadStatus() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setLlmStatus(data.provider_detail || data.llm_status);
          setLlmModel(data.model);
        } else {
          setLlmStatus("offline");
          setLlmModel(null);
        }
      } catch {
        setLlmStatus("offline");
        setLlmModel(null);
      }
    }

    // Always show the welcome/onboarding modal on load
    setIsWelcomeOpen(true);
    setMounted(true);

    loadPatients();
    loadStatus();
    refreshStatusRef.current = loadStatus;
  }, []);

  // Update demographics preview when patient selection changes
  useEffect(() => {
    if (selectedPatientId && patients.length > 0) {
      const match = patients.find((p) => p.patient_id === selectedPatientId);
      if (match) {
        setDemographics({
          age: match.age,
          sex: match.sex,
          a1c_percent: match.a1c_percent,
          years_with_diabetes: 0, // Filled in real-time when neuropathy specialist streams
        });
        setLabs(null);
        setSpecialists([]);
        setSynthesis(null);
        setBenchmark(null);
        setTerminalLogs([]);
        setClinicalBrief("");
        setIsBriefLoading(false);
        briefRequestIdRef.current += 1; // invalidate any in-flight brief request
        setCustomPatientId(null); // switching to dataset — clear any active custom session
      }
    }
  }, [selectedPatientId, patients]);

  function triggerPipelineAnalysis(patientId: string | null, customData?: CustomPatientInput) {
    if (!patientId && !customData) return;

    // Reset pipeline state
    setSpecialists([]);
    setSynthesis(null);
    setBenchmark(null);
    setLabs(null);
    setErrorMessage("");
    setIsPipelineRunning(true);
    setTerminalLogs([]);
    setClinicalBrief("");
    setIsBriefLoading(false);
    briefRequestIdRef.current += 1; // invalidate any in-flight brief request
    setToasts([]);
    if (!customData) {
      // Switching to a dataset patient — clear any lingering custom session
      setCustomPatientId(null);
    }

    // Local accumulators — kept for demographics/labs bookkeeping during the
    // stream (still needed elsewhere in this handler). No longer used to
    // auto-fire a brief request; brief generation is now manual (see
    // handleGenerateBrief), triggered from the ReportExport button using
    // React state directly once the pipeline has actually finished.
    let localSpecialists: any[] = [];
    let localSynthesis: any = null;
    let localLabs: Record<string, number> = {};
    let localDemographics: any = null;
    let localPatientId = patientId ?? "";

    let url = "";

    if (customData) {
      // Set initial demographics preview
      setDemographics({
        name: customData.name,
        age: customData.age,
        sex: customData.sex,
        a1c_percent: customData.a1c_percent,
        years_with_diabetes: customData.years_with_diabetes,
      });

      // Construct search params matching CustomPatientInput
      const params = new URLSearchParams({
        name: customData.name || "",
        age: String(customData.age),
        sex: customData.sex,
        years_with_diabetes: String(customData.years_with_diabetes),
        a1c_percent: String(customData.a1c_percent),
        egfr: String(customData.egfr),
        uacr_mg_g: String(customData.uacr_mg_g),
        creatinine_mg_dl: String(customData.creatinine_mg_dl),
        ldl_mg_dl: String(customData.ldl_mg_dl),
        hdl_mg_dl: String(customData.hdl_mg_dl),
        triglycerides_mg_dl: String(customData.triglycerides_mg_dl),
        systolic_bp: String(customData.systolic_bp),
      });
      url = `/api/analyze/custom/stream?${params.toString()}`;
    } else if (patientId) {
      // Reset Demographics preview with baseline data from selector
      const selected = patients.find((p) => p.patient_id === patientId);
      if (selected) {
        setDemographics({
          age: selected.age,
          sex: selected.sex,
          a1c_percent: selected.a1c_percent,
          years_with_diabetes: 0,
        });
      }
      url = `/api/analyze/${patientId}/stream`;
    }

    // Initialize Server-Sent Events stream connection
    const es = new EventSource(url);

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.stage === "pipeline_start") {
        const providerLabel = event.provider
          ? `LLM sandbox (${event.provider_detail || event.provider})`
          : "LLM offline - no fallback, analysis will be reported unavailable";
        setTerminalLogs((prev) => [
          ...prev,
          `> [SYSTEM] Loading patient ${event.patient_id} ${customData ? '(Custom Input)' : 'from NHANES 2017-2018 dataset'}...`,
          `> [SYSTEM] Dispatching ${event.agents.length} specialist agents: ${event.agents.join(", ")}`,
          `> [SYSTEM] Execution mode: ${providerLabel}`,
        ]);
        
        // Save the custom patient ID for display (header, brief etc.) WITHOUT
        // overwriting the dataset dropdown’s selectedPatientId, so switching back
        // to a dataset patient after this run works immediately.
        if (customData) {
          localPatientId = event.patient_id;
          setCustomPatientId(event.patient_id);
        }
        // Capture initial demographics into local snapshot
        localDemographics = customData
          ? { name: customData.name, age: customData.age, sex: customData.sex, a1c_percent: customData.a1c_percent, years_with_diabetes: customData.years_with_diabetes }
          : null;
        return;
      }

      if (event.stage === "pipeline_complete") {
        setBenchmark({
          total_duration_ms: event.total_duration_ms,
          agents_run: event.agents_run,
          llm_calls_made: event.llm_calls_made,
          provider: event.provider,
          provider_detail: event.provider_detail,
        });

        setTerminalLogs((prev) => [
          ...prev,
          `> [SYSTEM] Swarm pipeline execution finished in ${event.total_duration_ms} ms.`,
          `> [SYSTEM] Provider mode: ${event.provider_detail || event.provider || "LLM offline (no fallback)"}.`,
        ]);

        es.close();
        setIsPipelineRunning(false);
        // Discovery Brief generation is manual now — see handleGenerateBrief,
        // wired to the "Generate Discovery Brief" button in ReportExport.
        return;
      }

      if (event.stage === "synthesis") {
        const synthesisResult = event.data["synthesis"];
        localSynthesis = synthesisResult;  // capture for brief generation
        setSynthesis(synthesisResult);
        setTerminalLogs((prev) => [
          ...prev,
          `> >>> SYNTHESIS: ${synthesisResult.recommendation}`
        ]);
      } else {
        const result = event.data[`${event.stage}_result`];

        // Accumulate locally for brief generation
        localSpecialists = localSpecialists.filter((s) => s.specialist !== result.specialist);
        localSpecialists = [...localSpecialists, result];

        // Append specialist results to React state safely
        setSpecialists((prev) => {
          const filtered = prev.filter((s) => s.specialist !== result.specialist);
          return [...filtered, result];
        });

        // Accumulate lab readings in-place (local + React state)
        if (result.input_labs) {
          localLabs = { ...localLabs, ...result.input_labs };
          setLabs((prev) => ({
            ...(prev || {}),
            ...result.input_labs,
          }));
        }

        // Extract years_with_diabetes to demographics if retrieved
        if (result.specialist === "neuropathy" && result.input_labs?.years_with_diabetes) {
          if (localDemographics) {
            localDemographics = { ...localDemographics, years_with_diabetes: result.input_labs.years_with_diabetes };
          }
          setDemographics((prev) => prev ? {
            ...prev,
            years_with_diabetes: result.input_labs.years_with_diabetes,
          } : null);
        }

        // For dataset patients, capture demographics from first specialist's input_labs context
        if (!customData && !localDemographics && result.input_labs) {
          const sel = patients.find((p) => p.patient_id === patientId);
          if (sel) {
            localDemographics = { age: sel.age, sex: sel.sex, a1c_percent: sel.a1c_percent, years_with_diabetes: result.input_labs.years_with_diabetes ?? 0 };
          }
        }

        const label = specialistLabels[result.specialist] || result.specialist.toUpperCase();
        const isUnavailable = result.available === false || result.risk_score === null;
        const flagMarker = isUnavailable ? "N/A" : result.flag ? "⚠️ FLAGGED" : "clear";
        const riskDisplay = isUnavailable ? "N/A" : result.risk_score.toFixed(2);
        setTerminalLogs((prev) => [
          ...prev,
          `> [${label}] risk=${riskDisplay} [${flagMarker}]`,
          `> [${label}] -> ${result.reasoning}`
        ]);

        // Surface a toast the moment a specialist comes back flagged
        if (!isUnavailable && result.flag) {
          setToasts((prev) => [
            ...prev,
            {
              id: `${result.specialist}-${Date.now()}`,
              specialist: result.specialist,
              label: specialistFriendlyNames[result.specialist] || result.specialist,
              riskScore: result.risk_score,
            },
          ]);
        }
      }
    };

    es.onerror = () => {
      es.close();
      setErrorMessage("Streaming execution connection interrupted.");
      setIsPipelineRunning(false);
    };
  }

  // Manually triggered from the "Generate Discovery Brief" button in
  // ReportExport. Uses current React state (not stream-local accumulators)
  // since by the time this can be clicked, the pipeline has already finished
  // and specialists/synthesis/demographics/labs are stable. Guards against
  // the stale-overwrite bug via briefRequestIdRef: if the patient changes or
  // a new run starts while this request is in flight, the request's id no
  // longer matches the current one and its result is discarded instead of
  // being written into state.
  async function handleGenerateBrief() {
    if (!displayPatientId || !demographics || !synthesis || specialists.length === 0) return;

    const requestId = ++briefRequestIdRef.current;
    setIsBriefLoading(true);

    try {
      const brief = await fetchBrief(displayPatientId, demographics, labs || {}, specialists, synthesis);
      if (briefRequestIdRef.current === requestId) {
        setClinicalBrief(brief);
      }
    } catch (err: any) {
      if (briefRequestIdRef.current === requestId) {
        setClinicalBrief(
          `Discovery Brief unavailable for patient ${displayPatientId}: ${err.message}. No report was generated - this is not a placeholder or partial brief.`
        );
      }
    } finally {
      if (briefRequestIdRef.current === requestId) {
        setIsBriefLoading(false);
      }
    }
  }

  const handleCustomPatientSubmit = async (data: CustomPatientInput) => {
    setIsCustomModalOpen(false);
    setBackendFieldErrors({});
    
    // Convert to query params
    const params = new URLSearchParams({
      name: data.name || "",
      age: String(data.age),
      sex: data.sex,
      years_with_diabetes: String(data.years_with_diabetes),
      a1c_percent: String(data.a1c_percent),
      egfr: String(data.egfr),
      uacr_mg_g: String(data.uacr_mg_g),
      creatinine_mg_dl: String(data.creatinine_mg_dl),
      ldl_mg_dl: String(data.ldl_mg_dl),
      hdl_mg_dl: String(data.hdl_mg_dl),
      triglycerides_mg_dl: String(data.triglycerides_mg_dl),
      systolic_bp: String(data.systolic_bp),
    });

    // 1. Dry run validation check to capture any 422 validations
    try {
      setIsPipelineRunning(true);
      setErrorMessage("");
      const checkRes = await fetch(`/api/analyze/custom/validate?${params.toString()}`);
      if (!checkRes.ok) {
        const errData = await checkRes.json();
        if (errData.fields) {
          const mapped: Record<string, string> = {};
          for (const f of errData.fields) mapped[f.field] = f.message;
          setBackendFieldErrors(mapped);
          setIsCustomModalOpen(true); // Re-open form modal to show errors
        } else {
          setErrorMessage(errData.message || "Custom input validation failed.");
        }
        setIsPipelineRunning(false);
        return;
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to contact validation endpoint.");
      setIsPipelineRunning(false);
      return;
    }

    // 2. Trigger the actual SSE streaming flow
    triggerPipelineAnalysis(null, data);
  };

  const handleCloseWelcome = () => {
    setIsWelcomeOpen(false);
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#0b1120]">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] font-sans antialiased">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 w-full border-b border-white/40 dark:border-slate-700/40 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-2 sm:px-4 sm:py-2.5 lg:px-12 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          {/* Brand */}
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-[32px] bg-white p-1.5 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-800 dark:ring-slate-700/60">
                <Logo className="h-full w-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-none">GlycoSwarm AI</h1>
                <p className="hidden sm:block text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
                  AI-powered multi-agent diabetic complication early-warning triage
                </p>
              </div>
            </div>
            
            {/* Mobile/Tablet Info button */}
            <button
              onClick={() => setIsWelcomeOpen(true)}
              className="lg:hidden rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors shadow-sm flex-shrink-0"
              title="System Guide Overview"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>

          {/* Controls row: selector pill + custom button + desktop info button */}
          <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
            {/* Patient selector + Analyze button pill */}
            <div className="flex flex-1 lg:flex-none flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 rounded-full border border-slate-200 bg-white p-1.5 sm:pl-5 sm:pr-1.5 sm:py-1.5 transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
              <label className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-400 px-1 sm:px-0">
                Select Record:
              </label>
              {isPatientsLoading ? (
                <span className="animate-pulse text-sm text-slate-400 font-medium flex-1 px-1">Index mapping...</span>
              ) : (
                <RecordSelect
                  patients={patients}
                  value={selectedPatientId}
                  onChange={setSelectedPatientId}
                  disabled={isPipelineRunning}
                />
              )}
              <HoverScale hoverScale={1.05} tapScale={0.95} className={`w-full sm:w-auto ${isPipelineRunning || !selectedPatientId ? 'pointer-events-none' : ''}`}>
                <button
                  onClick={() => triggerPipelineAnalysis(selectedPatientId)}
                  disabled={isPipelineRunning || !selectedPatientId}
                  className="flex h-11 w-full flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-30 shadow-sm"
                >
                  {isPipelineRunning ? "Running Swarm..." : "Analyze Dataset"}
                </button>
              </HoverScale>
            </div>

            {/* Custom Patient Trigger Button */}
            <HoverScale hoverScale={1.05} tapScale={0.95} className={isPipelineRunning ? 'pointer-events-none' : ''}>
              <button
                onClick={() => setIsCustomModalOpen(true)}
                disabled={isPipelineRunning}
                className="group flex h-11 flex-shrink-0 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/60 pl-2 pr-5 text-emerald-700 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-40"
                title="Add Custom Patient Labs"
              >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors group-hover:bg-emerald-500">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </span>
              <span className="text-sm font-semibold">Custom Patient</span>
              </button>
            </HoverScale>

            {/* Desktop Info button */}
            <button
              onClick={() => setIsWelcomeOpen(true)}
              className="hidden lg:block rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors shadow-sm flex-shrink-0"
              title="System Guide Overview"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Provider switcher */}
            <ProviderSwitcher
              disabled={isPipelineRunning}
              onProviderChanged={() => refreshStatusRef.current()}
            />

            {/* Dark mode toggle */}
            <ThemeToggle />
          </div>

        </div>
      </header>

      <main className="mx-auto flex max-w-[1600px] flex-col gap-3 p-4 sm:p-4 lg:p-12 pt-4 sm:pt-4 lg:pt-6">
        {/* Onboarding Welcome Modal */}
        <WelcomeModal isOpen={isWelcomeOpen} onClose={handleCloseWelcome} />

        {/* Flagged-result toast notifications */}
        <ToastStack toasts={toasts} onDismiss={dismissToast} />

        {/* Custom Patient Input Form Modal */}
        <CustomPatientModal
          isOpen={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
          onSubmit={handleCustomPatientSubmit}
          isSubmitting={isPipelineRunning}
          backendFieldErrors={backendFieldErrors}
          clearBackendErrors={() => setBackendFieldErrors({})}
        />
      {errorMessage && errorMessage.trim() && (
        <div className="rounded-[32px] border border-rose-200 bg-rose-50 p-4 font-mono text-sm text-rose-600 shadow-sm flex items-start gap-2">
          <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>[PIPELINE EXCEPTION]: {errorMessage}</span>
        </div>
      )}

      {/* Patient Overview Summary Card */}
      <PatientOverviewHeader
        patientId={displayPatientId || null}
        demographics={demographics}
        labs={labs}
      />

      {/* Primary Dashboard Workspace Grid */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">

        {/* Left Column: Diagnostics Tabs Panels */}
        <div className="lg:col-span-9 flex min-w-0 flex-col gap-3">
          <SwarmDiagnosticsTabs
            specialists={specialists}
            synthesis={synthesis}
            isLoading={isPipelineRunning}
            patientId={displayPatientId || null}
            llmStatus={llmStatus}
            llmModel={llmModel}
            benchmark={benchmark}
          />
        </div>

        {/* Right Column: Console Output & Lab Panels */}
        <div className="lg:col-span-3 flex flex-col gap-3 lg:pt-[58px]">
          <LabsPanel labs={labs} isLoading={isPipelineRunning} a1cPercent={demographics?.a1c_percent ?? null} />
          <LiveAgentTerminal
            terminalLogs={terminalLogs}
            isLoading={isPipelineRunning}
            llmStatus={llmStatus}
            llmModel={llmModel}
          />
        </div>

        {/* Full-Width Footer Actions: Clinical Brief & Print Actions */}
        <div className="lg:col-span-12">
          <ReportExport
            patientId={displayPatientId || null}
            demographics={demographics}
            labs={labs}
            specialists={specialists}
            synthesis={synthesis}
            clinicalBrief={clinicalBrief}
            isBriefLoading={isBriefLoading}
            canGenerateBrief={!isPipelineRunning && !!synthesis && specialists.length > 0}
            onGenerateBrief={handleGenerateBrief}
          />
        </div>

        {/* Disclaimer */}
        <div className="lg:col-span-12">
          <div className="flex items-start gap-2.5 rounded-[32px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            <svg className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex flex-col gap-0.5">
              <span className="font-bold uppercase tracking-wider text-[10px] text-amber-900">Disclaimer</span>
              <p>
                <span className="font-semibold">This tool assumes an existing diabetes diagnosis.</span> It screens for early kidney, nerve, eye, and heart <em>complications</em> in patients who already have diabetes. It does not diagnose diabetes itself, and it is a demo prototype, not a clinical device.
              </p>
            </div>
          </div>
        </div>
      </section>
      </main>
    </div>
  );
}