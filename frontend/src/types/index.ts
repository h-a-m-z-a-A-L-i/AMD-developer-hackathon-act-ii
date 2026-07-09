// frontend/src/types/index.ts

export interface PatientDropdownItem {
  patient_id: string;
  age: number;
  sex: string;
  a1c_percent: number;
}

export interface Demographics {
  name?: string;
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
  available: boolean;         // false when no LLM was reachable / code failed twice — NO fallback data exists in this case
  risk_score: number | null;  // float 0-1, null when unavailable (never a fabricated 0)
  flag: boolean | null;       // null when unavailable
  reasoning: string;          // human-readable explanation, always LLM-generated (or an honest unavailable message)
  used_llm: boolean;          // true if a real LLM call produced this result
  duration_ms: number;        // wall-clock time for this specialist's run, including any failed retries
  input_labs: Record<string, number>;      // subset of patient labs this specialist actually read
  thresholds_used: Record<string, number>; // the exact numeric cutoffs the LLM says it applied this run — freeform labels, not a fixed reference table
  steps: string[];             // ordered human-readable trace for the Agent Logs tab
  code_used: string | null;    // the exact Python the LLM wrote and that executed
}

export interface SynthesisReport {
  top_concern: string | null;       // null when unavailable
  recommendation: string | null;    // null when unavailable
  available: boolean;               // false when no LLM was reachable or the call failed — no fallback compiled
  duration_ms: number;
  used_llm: boolean;
  synthesis_error: string | null;   // non-null if synthesis is unavailable, explaining why
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
  name?: string;
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