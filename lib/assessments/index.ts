/**
 * ADAPTIVE ASSESSMENT ENGINE  (founding doc §8)
 * ---------------------------------------------
 * Declarative assessment library + a DETERMINISTIC battery selector. The AI
 * may phrase the rationale, but code owns which assessments run and the time
 * budget, so sessions stay short, relevant, and explainable.
 */

import { computeTrend } from "@/lib/stats";
import { metricLabel } from "@/lib/metrics";
import type { MetricKey, MetricSeries, UpcomingAssessment } from "@/types";

export type AssessmentFamily = "performance" | "self_report";

export interface AssessmentDefinition {
  key: string;
  label: string;
  family: AssessmentFamily;
  metrics: MetricKey[];
  estSeconds: number;
  /** Condition categories this is relevant to; "*" = always applicable. */
  appliesTo: string[];
}

/** v1 library. Adding a new assessment requires no selector changes. */
export const ASSESSMENTS: AssessmentDefinition[] = [
  { key: "reaction_time", label: "Reaction time", family: "performance", metrics: ["reaction_time"], estSeconds: 60, appliesTo: ["concussion", "neuro", "*"] },
  { key: "attention", label: "Attention", family: "performance", metrics: ["attention"], estSeconds: 120, appliesTo: ["concussion", "neuro", "*"] },
  { key: "working_memory", label: "Working memory", family: "performance", metrics: ["working_memory"], estSeconds: 120, appliesTo: ["concussion", "neuro"] },
  { key: "processing_speed", label: "Processing speed", family: "performance", metrics: ["processing_speed"], estSeconds: 90, appliesTo: ["concussion", "neuro", "*"] },
  { key: "fatigue", label: "Fatigue check-in", family: "self_report", metrics: ["fatigue"], estSeconds: 45, appliesTo: ["*"] },
  { key: "sleep_quality", label: "Sleep quality", family: "self_report", metrics: ["sleep_quality"], estSeconds: 45, appliesTo: ["*"] },
  { key: "mood", label: "Mood", family: "self_report", metrics: ["mood"], estSeconds: 30, appliesTo: ["*"] },
  { key: "stress", label: "Stress", family: "self_report", metrics: ["stress"], estSeconds: 30, appliesTo: ["*"] },
  { key: "symptoms", label: "Symptom check-in", family: "self_report", metrics: ["symptoms"], estSeconds: 30, appliesTo: ["concussion", "neuro", "injury", "condition"] },
];

interface SelectInput {
  conditionCategory: string;
  goalMetrics: MetricKey[];
  series: MetricSeries[];
  budgetSeconds?: number;
}

/**
 * score(a) = goalRelevance + recentMovement + coverageGap − lengthPenalty
 * top-k under a time budget. Mirrors §8.3.
 */
export function selectBattery({
  conditionCategory,
  goalMetrics,
  series,
  budgetSeconds = 300,
}: SelectInput): UpcomingAssessment {
  const seriesByMetric = new Map(series.map((s) => [s.metric, s]));

  const scored = ASSESSMENTS.filter(
    (a) => a.appliesTo.includes(conditionCategory) || a.appliesTo.includes("*"),
  ).map((a) => {
    const goalRelevance = a.metrics.some((m) => goalMetrics.includes(m)) ? 1 : 0.5;
    let movement = 0;
    let coverageGap = 0.3;
    let rationale = "Keeping a regular read on this.";
    for (const m of a.metrics) {
      const s = seriesByMetric.get(m);
      if (s && s.points.length >= 2) {
        const t = computeTrend(s);
        movement = Math.max(movement, Math.min(1, Math.abs(t.delta) / 12));
        if (Math.abs(t.delta) >= 5) {
          rationale =
            t.delta > 0
              ? `Following up on recent movement in your ${metricLabel(m).toLowerCase()}.`
              : `Checking whether the recent dip in your ${metricLabel(m).toLowerCase()} continues.`;
        }
      } else {
        coverageGap = 0.8; // we barely have data on this yet
        rationale = `Getting a clearer baseline on your ${metricLabel(m).toLowerCase()}.`;
      }
    }
    if (goalRelevance === 1 && movement < 0.4) {
      rationale = "Central to your recovery goals, so we keep it in the rotation.";
    }
    const lengthPenalty = a.estSeconds / 600;
    const score = goalRelevance * 0.4 + movement * 0.3 + coverageGap * 0.2 - lengthPenalty * 0.1;
    return { a, score, rationale };
  });

  scored.sort((x, y) => y.score - x.score);

  const battery: UpcomingAssessment["battery"] = [];
  let total = 0;
  for (const { a, rationale } of scored) {
    if (total + a.estSeconds > budgetSeconds) continue;
    battery.push({ key: a.key, label: a.label, estSeconds: a.estSeconds, rationale });
    total += a.estSeconds;
  }

  return { battery, totalEstSeconds: total };
}
