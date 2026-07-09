// frontend/src/lib/generateBrief.ts
//
// Fetches the Discovery Brief from the real backend report agent
// (report_agent.py -> generate_brief), which is LLM-only with an honest
// "unavailable" message when no LLM is reachable or the call fails.
//
// This intentionally does NOT contain any client-side template/formatting
// logic of its own — a hardcoded JS template mirroring the old deterministic
// fallback would defeat the point of removing hardcoded fallbacks from the
// backend, since the frontend would just be re-implementing the same
// fabricated-report problem locally. All brief text comes from the LLM via
// POST /api/report/{patient_id}.

import type { Demographics, SpecialistResult, SynthesisReport } from "@/types";

export async function fetchBrief(
  patientId: string,
  demographics: Demographics,
  labs: Record<string, number>,
  specialists: SpecialistResult[],
  synthesis: SynthesisReport
): Promise<string> {
  const res = await fetch(`/api/report/${patientId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_id: patientId,
      demographics,
      labs,
      specialists,
      synthesis,
    }),
  });

  if (!res.ok) {
    throw new Error(`Report agent request failed (${res.status})`);
  }

  const data = await res.json();
  return data.brief as string;
}
