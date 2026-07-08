// frontend/src/lib/generateBrief.ts
// Mirrors report_agent.py _generate_brief_fallback() exactly.
// Called synchronously on the frontend so no network round-trip is needed.

import type { Demographics, Labs, SpecialistResult, SynthesisReport } from "@/types";

function fmtNum(value: number | null | undefined, decimals = 1): string {
  if (value == null || isNaN(value as number)) return "N/A";
  return Number(value).toFixed(decimals);
}

function overallMode(specialists: SpecialistResult[], synthesis: SynthesisReport): string {
  const flags = specialists.map((s) => s.used_llm);
  flags.push(synthesis.used_llm);
  if (flags.every(Boolean)) return "Live LLM Agents";
  if (flags.every((f) => !f)) return "Rule-based fallback (LLM offline)";
  return "Mixed (partial LLM availability)";
}

function totalDurationMs(specialists: SpecialistResult[], synthesis: SynthesisReport): number {
  return (
    specialists.reduce((acc, s) => acc + (s.duration_ms || 0), 0) +
    (synthesis.duration_ms || 0)
  );
}

export function generateBrief(
  patientId: string,
  demographics: Demographics,
  labs: Labs,
  specialists: SpecialistResult[],
  synthesis: SynthesisReport
): string {
  const { name, age, sex, a1c_percent, years_with_diabetes } = demographics;

  const flagged = specialists.filter((s) => s.flag);
  const mode = overallMode(specialists, synthesis);
  const totalMs = totalDurationMs(specialists, synthesis);

  // --- Clinical Context ---
  const context = flagged.length > 0
    ? `After ${fmtNum(years_with_diabetes, 0)} years with diabetes and an HbA1c of ${fmtNum(a1c_percent)}%, ` +
      `this panel screened for early organ-level stress across four systems. ` +
      `${flagged.length} of ${specialists.length} specialist agents flagged early-warning ` +
      `markers, meaning risk is emerging before values would cross standard diagnostic thresholds.`
    : `After ${fmtNum(years_with_diabetes, 0)} years with diabetes and an HbA1c of ${fmtNum(a1c_percent)}%, ` +
      `this panel screened for early organ-level stress across four systems. ` +
      `No specialist agent flagged early-warning markers in this screening pass, ` +
      `consistent with values currently inside expected ranges.`;

  // --- Risk Panel Summary ---
  const panelBlock = specialists.length > 0
    ? specialists
        .map((s) => {
          const specName = s.specialist.charAt(0).toUpperCase() + s.specialist.slice(1);
          const flagLabel = s.flag ? "FLAGGED" : "clear";
          return `- ${specName}: risk=${fmtNum(s.risk_score, 2)} (${flagLabel}) - ${s.reasoning}`;
        })
        .join("\n")
    : "- No specialist results available.";

  // --- Threshold block ---
  const thresholdLines = specialists
    .filter((s) => s.thresholds_used && Object.keys(s.thresholds_used).length > 0)
    .map((s) => {
      const specName = s.specialist.charAt(0).toUpperCase() + s.specialist.slice(1);
      const pairs = Object.entries(s.thresholds_used)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      return `- ${specName}: ${pairs}`;
    });
  const thresholdBlock = thresholdLines.length > 0
    ? thresholdLines.join("\n")
    : "- No threshold data available.";

  // --- Patient header ---
  let patientHeader = `Patient ID: ${patientId}`;
  if (name) patientHeader += `  |  Name: ${name}`;

  return `DISCOVERY BRIEF - Diabetic Complication Early-Warning Swarm
==================================================================

${patientHeader}
Age: ${age}  |  Sex: ${sex}  |  A1c: ${fmtNum(a1c_percent)}%  |  Years with diabetes: ${fmtNum(years_with_diabetes, 0)}
Mode: ${mode}  |  Total analysis time: ${totalMs} ms

CLINICAL CONTEXT
-----------------
${context}

RISK PANEL SUMMARY
-------------------
${panelBlock}

TOP CONCERN
-----------
${synthesis.top_concern}
${synthesis.recommendation}

METHODOLOGY
-----------
Data source: NHANES 2017-2018 cycle patient records.
Specialist agents compare patient labs against early-warning thresholds set
below standard diagnostic cutoffs, to surface risk before it reaches clinical
disease thresholds. Thresholds used per specialist:
${thresholdBlock}
Mode disclosure: ${mode}. Rule-based results use deterministic clinical-formula
thresholds; LLM results use provider-generated scoring code executed in a
sandboxed namespace, both under the same 0-1 risk_score contract.
`;
}
