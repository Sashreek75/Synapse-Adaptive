/**
 * BILLING PLANS & ENTITLEMENTS — Free / Pro / Max.
 * One source of truth for what each tier can access. Gating everywhere reads
 * from planAllows(), so moving a feature between tiers is a one-line change.
 */

export type PlanId = "free" | "pro" | "max";

export type FeatureKey =
  | "weekly_checkin"
  | "daily_checkin"
  | "dashboard_summary"
  | "recent_changes"
  | "proactive_insights"
  | "ai_chat"
  | "appointment_prep"
  | "timeline_history"
  | "monthly_deep_dive"   // Max: a deeper monthly review
  | "unlimited_history";  // Max: full export + unlimited retention

export interface Plan {
  id: PlanId;
  name: string;
  priceLabel: string;
  priceSubLabel: string;
  cadence: "free" | "monthly";
  tagline: string;
  /** How deeply Synapse understands you at this tier — the real product axis. */
  understanding: string;
  /** Depth meter, 1–3, for the "how well Synapse knows you" visual. */
  depthLevel: 1 | 2 | 3;
  features: FeatureKey[];
  highlights: string[];
  popular?: boolean;
}

export const FREE_FEATURES: FeatureKey[] = ["weekly_checkin", "daily_checkin", "dashboard_summary", "recent_changes"];
export const PRO_FEATURES: FeatureKey[] = [...FREE_FEATURES, "proactive_insights", "ai_chat", "appointment_prep", "timeline_history"];
export const MAX_FEATURES: FeatureKey[] = [...PRO_FEATURES, "monthly_deep_dive", "unlimited_history"];

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free", name: "Free", priceLabel: "$0", priceSubLabel: "to start, no card",
    cadence: "free", tagline: "Synapse gets to know you.",
    understanding: "Synapse learns your baseline and tells you, in plain language, what's changing week to week.",
    depthLevel: 1,
    features: FREE_FEATURES,
    highlights: [
      "Synapse learns your baseline",
      "Adaptive assessments + daily check-ins",
      "Full weekly report — insights + next-week plan, free",
      "Plain-language read on what changed",
      "Recent changes at a glance",
    ],
  },
  pro: {
    id: "pro", name: "Pro", priceLabel: "$10", priceSubLabel: "per month · about $60 over 6 months",
    cadence: "monthly", tagline: "Synapse understands your patterns.", popular: true,
    understanding: "Synapse connects the dots across your weeks — surfacing patterns before you ask, and talking any of it through with you, anytime.",
    depthLevel: 2,
    features: PRO_FEATURES,
    highlights: [
      "Everything in Free",
      "Daily proactive insights — not just your weekly report",
      "“Here's what I noticed, here's what I'd do” every day",
      "Talk with Synapse anytime — unlimited, deeper",
      "Appointment-prep one-pager + full timeline",
      "Cancel anytime",
    ],
  },
  max: {
    id: "max", name: "Max", priceLabel: "$25", priceSubLabel: "per month · for the deeply invested",
    cadence: "monthly", tagline: "Synapse understands your whole story.",
    understanding: "Synapse reasons over your entire history every month, remembers everything you've shared, and goes deepest on what's actually driving your trends.",
    depthLevel: 3,
    features: MAX_FEATURES,
    highlights: [
      "Everything in Pro",
      "Monthly deep-dive over your full history",
      "Synapse's deepest long-term memory",
      "Unlimited history & full data export",
      "Earliest access to new assessments + priority processing",
    ],
  },
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  weekly_checkin: "Adaptive assessments",
  daily_checkin: "Daily check-ins",
  dashboard_summary: "Health summary",
  recent_changes: "Recent changes",
  proactive_insights: "Proactive insights",
  ai_chat: "AI companion chat",
  appointment_prep: "Appointment prep",
  timeline_history: "Full timeline",
  monthly_deep_dive: "Monthly deep-dive",
  unlimited_history: "Unlimited history & export",
};

export function planAllows(plan: PlanId, feature: FeatureKey): boolean {
  return PLANS[plan].features.includes(feature);
}

/** Plans shown on the marketing pricing section, in order. */
export const PLAN_ORDER: PlanId[] = ["free", "pro", "max"];
