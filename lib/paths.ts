import type { MetricKey } from "@/types";

/**
 * THE PATH ENGINE.
 * Synapse Adaptive is one product with many lenses. The user's answer to
 * "What brings you here?" selects a Path, which only changes what the AI
 * emphasizes — the metrics it prioritizes, the language it uses, and the
 * profile framing. The underlying experience stays the same.
 *
 * Pure module (no React) so the server (summary generation) can use it too.
 */
export type PathId =
  | "recovery_injury"
  | "recovery_neuro"
  | "mental_performance"
  | "wellness"
  | "provider_monitoring"
  | "athlete"
  | "general";

export interface PathDef {
  id: PathId;
  label: string;          // the onboarding option
  focusNoun: string;      // "recovery", "cognitive performance", "training readiness"…
  scoreLabel: string;     // personalizes the Weekly score card
  goalMetrics: MetricKey[];
  isRecovery: boolean;
  asksCondition: boolean; // show condition questions
  asksSport: boolean;     // show sport/training questions
  /** Deterministic fallback narrative (used when the AI model isn't configured). */
  summaryLead: (p: { goals: string[]; conditionLabel?: string; conditionDetail?: string }) => string;
}

const focusLine = "We'll watch the trends that matter for you and explain what's changing, and why.";

export const PATHS: PathDef[] = [
  {
    id: "recovery_injury", label: "I'm recovering from an injury or surgery",
    focusNoun: "recovery", scoreLabel: "Weekly Recovery Score",
    goalMetrics: ["reaction_time", "fatigue", "sleep_quality", "mood", "symptoms"], isRecovery: true, asksCondition: true, asksSport: false,
    summaryLead: (p) => `Your primary goal is ${p.goals[0]?.toLowerCase() || "recovering well"}${p.conditionDetail ? `, after ${p.conditionDetail}` : p.conditionLabel ? `, recovering from ${p.conditionLabel.toLowerCase()}` : ""}. We'll focus on recovery trends — fatigue, sleep, and readiness — throughout your rehabilitation.`,
  },
  {
    id: "recovery_neuro", label: "I'm recovering from a concussion or neurological condition",
    focusNoun: "recovery", scoreLabel: "Weekly Recovery Score",
    goalMetrics: ["reaction_time", "attention", "working_memory", "processing_speed", "fatigue", "symptoms"], isRecovery: true, asksCondition: true, asksSport: false,
    summaryLead: (p) => `Your primary goal is ${p.goals[0]?.toLowerCase() || "recovering well"}${p.conditionDetail ? `, after ${p.conditionDetail}` : ""}. We'll keep a close eye on attention, reaction time, and fatigue as your brain recovers.`,
  },
  {
    id: "mental_performance", label: "I want to better understand my mental performance",
    focusNoun: "cognitive performance", scoreLabel: "Weekly Performance Score",
    goalMetrics: ["attention", "working_memory", "processing_speed", "stress", "sleep_quality"], isRecovery: false, asksCondition: false, asksSport: false,
    summaryLead: (p) => `Your goal is ${p.goals[0]?.toLowerCase() || "sharpening your focus"}. We'll monitor attention, working memory, sleep, and stress to understand what influences your cognitive performance.`,
  },
  {
    id: "wellness", label: "I want to improve my overall health and wellness",
    focusNoun: "wellness", scoreLabel: "Weekly Wellness Score",
    goalMetrics: ["sleep_quality", "stress", "mood", "fatigue"], isRecovery: false, asksCondition: false, asksSport: false,
    summaryLead: (p) => `Your goal is ${p.goals[0]?.toLowerCase() || "feeling your best"}. We'll build a long-term baseline and surface how your daily habits affect how you feel.`,
  },
  {
    id: "provider_monitoring", label: "My doctor or therapist recommended I monitor my progress",
    focusNoun: "progress", scoreLabel: "Weekly Progress Score",
    goalMetrics: ["fatigue", "sleep_quality", "mood", "stress", "symptoms"], isRecovery: true, asksCondition: true, asksSport: false,
    summaryLead: (p) => `You're tracking your progress${p.conditionLabel ? ` with ${p.conditionLabel.toLowerCase()}` : ""} so your appointments are more productive. We'll keep clear, shareable trends and questions worth raising.`,
  },
  {
    id: "athlete", label: "I'm an athlete tracking readiness and performance",
    focusNoun: "training readiness", scoreLabel: "Weekly Readiness Score",
    goalMetrics: ["reaction_time", "fatigue", "sleep_quality", "stress"], isRecovery: false, asksCondition: false, asksSport: true,
    summaryLead: (p) => `Your goal is ${p.goals[0]?.toLowerCase() || "performing at your best"}. We'll monitor readiness, fatigue, reaction time, and sleep across your training.`,
  },
  {
    id: "general", label: "I just want to understand my health over time",
    focusNoun: "health", scoreLabel: "Weekly Health Score",
    goalMetrics: ["sleep_quality", "fatigue", "mood", "stress"], isRecovery: false, asksCondition: false, asksSport: false,
    summaryLead: () => `Your goal is to understand your health over time. We'll build a baseline first and let what matters most to you emerge as you check in. ${focusLine}`,
  },
];

const BY_ID = new Map(PATHS.map((p) => [p.id, p]));
export function getPath(id?: string): PathDef {
  return (id && BY_ID.get(id as PathId)) || PATHS[PATHS.length - 1]; // default: general
}
export function goalMetricsForPath(id?: string): MetricKey[] {
  return getPath(id).goalMetrics;
}
