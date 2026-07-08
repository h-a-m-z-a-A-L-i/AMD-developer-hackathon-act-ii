"use client";

import { useEffect, useState } from "react";
import { PatientOverviewHeader } from "@/features/dashboard/components/PatientOverviewHeader";
import { LabsPanel } from "@/features/dashboard/components/LabsPanel";
import { LiveAgentTerminal } from "@/features/dashboard/components/LiveAgentTerminal";
import { ReportExport } from "@/features/dashboard/components/ReportExport";
import { WelcomeModal } from "@/features/dashboard/components/WelcomeModal";
import { SwarmDiagnosticsTabs } from "@/features/dashboard/components/SwarmDiagnosticsTabs";
import type {
  PatientDropdownItem,
  Demographics,
  Labs,
  SpecialistResult,
  SynthesisReport,
  BenchmarkSummary,
} from "@/types";

const specialistLabels: Record<string, string> = {
  retinal: "RETINAL_SPECIALIST",
  renal: "RENAL_SPECIALIST",
  neuropathy: "NEUROPATHY_SPECIALIST",
  cardiovascular: "CARDIOVASCULAR_SPECIALIST",
};

export default function DashboardPage() {
  const [patients, setPatients] = useState<PatientDropdownItem[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");

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

  // Real-time terminal logs state
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

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
        const res = await fetch("/api/status");
        if (res.ok) {
          const data = await res.json();
          setLlmStatus(data.llm_status);
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

    // Check if user has seen welcome modal
    const onboarded = localStorage.getItem("glycoswarm_onboarded");
    if (onboarded !== "true") {
      setIsWelcomeOpen(true);
    }
    setMounted(true);

    loadPatients();
    loadStatus();
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
      }
    }
  }, [selectedPatientId, patients]);

  function triggerPipelineAnalysis(patientId: string) {
    if (!patientId) return;

    // Reset pipeline state
    setSpecialists([]);
    setSynthesis(null);
    setBenchmark(null);
    setLabs(null);
    setErrorMessage("");
    setIsPipelineRunning(true);

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

    // backend SSE event (pipeline_start, per-specialist, synthesis, pipeline_complete)
    setTerminalLogs([]);

    // Initialize Server-Sent Events stream connection
    const es = new EventSource(`/api/analyze/${patientId}/stream`);

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);

      if (event.stage === "pipeline_start") {
        const providerLabel = event.provider
          ? `LLM sandbox (${event.provider})`
          : "deterministic rule-based fallback - LLM offline";
        setTerminalLogs((prev) => [
          ...prev,
          `> [SYSTEM] Loading patient ${event.patient_id} from NHANES 2017-2018 dataset...`,
          `> [SYSTEM] Dispatching ${event.agents.length} specialist agents: ${event.agents.join(", ")}`,
          `> [SYSTEM] Execution mode: ${providerLabel}`,
        ]);
        return;
      }

      if (event.stage === "pipeline_complete") {
        setBenchmark({
          total_duration_ms: event.total_duration_ms,
          agents_run: event.agents_run,
          llm_calls_made: event.llm_calls_made,
          provider: event.provider,
        });

        setTerminalLogs((prev) => [
          ...prev,
          `> [SYSTEM] Swarm pipeline execution finished in ${event.total_duration_ms} ms.`,
          `> [SYSTEM] Provider mode: ${event.provider || "Rule-based Fallback (offline)"}.`
        ]);

        es.close();
        setIsPipelineRunning(false);
        return;
      }

      if (event.stage === "synthesis") {
        const synthesisResult = event.data["synthesis"];
        setSynthesis(synthesisResult);
        setTerminalLogs((prev) => [
          ...prev,
          `> >>> SYNTHESIS: ${synthesisResult.recommendation}`
        ]);
      } else {
        const result = event.data[`${event.stage}_result`];

        // Append specialist results safely
        setSpecialists((prev) => {
          const filtered = prev.filter((s) => s.specialist !== result.specialist);
          return [...filtered, result];
        });

        // Accumulate lab readings in-place
        if (result.input_labs) {
          setLabs((prev) => ({
            ...(prev || {}),
            ...result.input_labs,
          }));
        }

        // Extract years_with_diabetes to demographics if retrieved
        if (result.specialist === "neuropathy" && result.input_labs?.years_with_diabetes) {
          setDemographics((prev) => prev ? {
            ...prev,
            years_with_diabetes: result.input_labs.years_with_diabetes,
          } : null);
        }

        const name = specialistLabels[result.specialist] || result.specialist.toUpperCase();
        const flagMarker = result.flag ? "⚠️ FLAGGED" : "clear";
        setTerminalLogs((prev) => [
          ...prev,
          `> [${name}] risk=${result.risk_score.toFixed(2)} [${flagMarker}]`,
          `> [${name}] -> ${result.reasoning}`
        ]);
      }
    };

    es.onerror = () => {
      es.close();
      setErrorMessage("Streaming execution connection interrupted.");
      setIsPipelineRunning(false);
    };
  }

  const handleCloseWelcome = () => {
    setIsWelcomeOpen(false);
    localStorage.setItem("glycoswarm_onboarded", "true");
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 bg-slate-50 p-4 font-sans antialiased sm:p-6 lg:p-12">

      {/* Onboarding Welcome Modal */}
      <WelcomeModal isOpen={isWelcomeOpen} onClose={handleCloseWelcome} />

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 -mx-4 border-b border-slate-200 mt-0 bg-slate-50/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 sm:py-2.5 lg:-mx-12 lg:px-12">
        {/* Single flex row on lg+; stacked on mobile/tablet */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">

          {/* Brand */}
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center overflow-hidden">
                <img src="/glycoswarmlogo.png" alt="GlycoSwarm AI" className="h-full w-full object-contain" />
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

          {/* Controls row: selector pill + desktop info button */}
          <div className="flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
            {/* Patient selector + Analyze button pill */}
            <div className="flex flex-1 lg:flex-none flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 sm:px-4 sm:py-2.5 transition-all duration-200 hover:border-slate-300 hover:shadow-sm">
              <label htmlFor="patient-select" className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-400 px-1 sm:px-0">
                Select Record:
              </label>
              {isPatientsLoading ? (
                <span className="animate-pulse text-sm text-slate-400 font-medium flex-1 px-1">Index mapping...</span>
              ) : (
                <select
                  id="patient-select"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  disabled={isPipelineRunning}
                  className="cursor-pointer bg-transparent text-sm font-mono font-semibold text-slate-900 focus:outline-none disabled:opacity-40 flex-1 min-w-0 px-1"
                >
                  {patients.map((p) => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.patient_id} (Age: {p.age}, A1c: {p.a1c_percent}%)
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => triggerPipelineAnalysis(selectedPatientId)}
                disabled={isPipelineRunning || !selectedPatientId}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-30 shadow-sm w-full sm:w-auto flex-shrink-0"
              >
                {isPipelineRunning ? "Running Swarm..." : "Analyze Dataset"}
              </button>
            </div>

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
          </div>

        </div>
      </header>


      {errorMessage && errorMessage.trim() && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-mono text-sm text-rose-600 shadow-sm flex items-start gap-2">
          <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>[PIPELINE EXCEPTION]: {errorMessage}</span>
        </div>
      )}

      {/* Patient Overview Summary Card */}
      <PatientOverviewHeader
        patientId={selectedPatientId || null}
        demographics={demographics}
        labs={labs}
      />

      {/* Primary Dashboard Workspace Grid */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        {/* Left Column: Diagnostics Tabs Panels */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <SwarmDiagnosticsTabs
            specialists={specialists}
            synthesis={synthesis}
            isLoading={isPipelineRunning}
            patientId={selectedPatientId || null}
            llmStatus={llmStatus}
            llmModel={llmModel}
            benchmark={benchmark}
          />
        </div>

        {/* Right Column: Console Output & Lab Panels */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <LiveAgentTerminal
            terminalLogs={terminalLogs}
            isLoading={isPipelineRunning}
            llmStatus={llmStatus}
            llmModel={llmModel}
          />
          <LabsPanel labs={labs} isLoading={isPipelineRunning} />
        </div>

        {/* Full-Width Footer Actions: Clinical Brief & Print Actions */}
        <div className="lg:col-span-12">
          <ReportExport
            patientId={selectedPatientId || null}
            demographics={demographics}
            labs={labs}
            specialists={specialists}
            synthesis={synthesis}
          />
        </div>
      </section>
    </main>
  );
}