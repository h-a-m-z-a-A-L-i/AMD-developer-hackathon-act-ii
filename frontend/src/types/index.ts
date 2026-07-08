// frontend/src/types/index.ts

export interface PatientDropdownItem {
  patient_id: string;
  age: number;
  sex: string;
  a1c_percent: number;
}

export interface Demographics {
  age: number;
  sex: string;
  a1c_percent: number;
  years_with_diabetes: number; // was already returned by backend, just wasn't typed
}

export interface Labs {
  egfr: number;
  uacr_mg_g: number;
  creatinine_mg_dl: number;
  ldl_mg_dl: number;
  hdl_mg_dl: number;
  triglycerides_mg_dl: number;
  systolic_bp: number;
}

export interface SpecialistResult {
  specialist: "retinal" | "renal" | "neuropathy" | "cardiovascular" | string;
  risk_score: number;        // float 0-1, now always clamped server-side
  flag: boolean;              // true if clinical cutoff bounds are breached
  reasoning: string;          // human-readable explanation (LLM- or rule-generated)
  used_llm: boolean;          // NEW — true if a real LLM call produced this, false if rule-based fallback
  duration_ms: number;        // NEW — wall-clock time for this specialist's run, including any failed retries
  input_labs: Record<string, number>;      // NEW — subset of patient labs this specialist actually read
  thresholds_used: Record<string, number>; // NEW — the numeric cutoffs it compared against
  steps: string[];            // NEW — ordered human-readable trace for the Agent Logs tab
  code_used: string | null;   // NEW — the exact Python that executed (fallback template or LLM-written)
}

export interface SynthesisReport {
  top_concern: string;
  recommendation: string;
  duration_ms: number;              // NEW
  used_llm: boolean;                // NEW
  synthesis_error: string | null;   // NEW — non-null if LLM synthesis was attempted and failed (bad JSON, network error, etc.)
}

export interface BenchmarkSummary {
  total_duration_ms: number;
  agents_run: number;              // always 5 (4 specialists + synthesis)
  llm_calls_made: number;          // includes retries
  provider: "fireworks" | "featherless" | null;
}

export interface PatientAnalysisResponse {
  patient_id: string;
  demographics: Demographics;
  labs: Labs;
  specialists: SpecialistResult[];
  synthesis: SynthesisReport;
  benchmark?: BenchmarkSummary;     // NEW — present on the blocking POST /api/analyze response
}

// NEW — one SSE event on the streaming endpoint
export interface StreamEvent {
  stage: "renal" | "neuropathy" | "retinal" | "cardiovascular" | "synthesis" | "pipeline_complete";
  data?: { [resultKey: string]: SpecialistResult | SynthesisReport }; // absent on pipeline_complete
  timestamp?: number; // unix float, absent on pipeline_complete
  // pipeline_complete event also carries the BenchmarkSummary fields directly:
  total_duration_ms?: number;
  agents_run?: number;
  llm_calls_made?: number;
  provider?: "fireworks" | "featherless" | null;
}

export interface CustomPatientInput {
  age: number;
  sex: "M" | "F";
  years_with_diabetes: number;
  a1c_percent: number;
  egfr: number;
  uacr_mg_g: number;
  creatinine_mg_dl: number;
  ldl_mg_dl: number;
  hdl_mg_dl: number;
  triglycerides_mg_dl: number;
  systolic_bp: number;
}