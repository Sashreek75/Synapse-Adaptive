import { z } from "zod";

/**
 * Zod schemas that enforce the insight contract at the boundary between the
 * model and the rest of the system. Model output is validated against these;
 * malformed output triggers a repair retry, then a graceful stats-only
 * fallback (see ai/agent.ts). The shape makes medical advice structurally
 * impossible to emit — there is simply no field for it.
 */

export const confidenceSchema = z.enum(["low", "moderate", "high"]);

export const insightSchema = z.object({
  category: z.enum(["observation", "education", "behavioral_focus"]),
  observation: z.string().min(1),
  reasoning: z.string().min(1),
  suggestedFocus: z.array(z.string()).default([]),
  questionsForProvider: z.array(z.string()).default([]),
  confidence: confidenceSchema,
  confidenceRationale: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
  uncertaintyFlags: z.array(z.string()).default([]),
  alternativeExplanation: z.string().optional(),
  wouldChange: z.string().optional(),
});

export const reportSchema = z.object({
  summary: z.string().min(1),
  overallConfidence: confidenceSchema,
  insights: z.array(insightSchema),
  /** 2-3 concrete, behavioral priorities for next week. */
  nextWeek: z.array(z.string()).optional(),
});

export const proactiveNoticeSchema = insightSchema.extend({
  patternType: z.enum([
    "sustained_trend",
    "divergence",
    "plateau",
    "new_correlation",
    "milestone",
  ]),
  tone: z.enum(["celebratory", "watchful", "informational"]),
});

/**
 * Synapse-composed DAILY check-in plan. The model authors the phrasing; code
 * owns the metric set (enum below), dedupe, and the sleep_quality + fatigue
 * requirement (enforced in the /api/daily-plan route).
 */
export const DAILY_SLIDER_METRICS = ["sleep_quality", "fatigue", "stress", "mood", "symptoms"] as const;

export const dailySliderSchema = z.object({
  metric: z.enum(DAILY_SLIDER_METRICS),
  question: z.string().min(1),
  lowLabel: z.string().min(1),
  highLabel: z.string().min(1),
});

export const dailyPlanSchema = z.object({
  greeting: z.string().min(1),
  sliders: z.array(dailySliderSchema).min(3).max(6),
  contextQuestion: z.object({
    prompt: z.string().min(1),
    chips: z.array(z.string().min(1)).min(3).max(6),
  }),
});

/**
 * CLINICAL REASONING output — Synapse thinks before it speaks. The model weighs
 * multiple hypotheses, commits to the strongest, chooses ONE priority, and shows
 * its working. Code owns the metric set + confidence ceilings; the model owns the
 * reasoning language.
 */
export const metricEnum = z.enum([
  "reaction_time", "attention", "working_memory", "processing_speed",
  "fatigue", "mood", "sleep_quality", "stress", "symptoms",
]);

export const hypothesisSchema = z.object({
  explanation: z.string().min(1),
  support: z.string().min(1),
  confidence: confidenceSchema,
});

export const reasoningSchema = z.object({
  reasoningSummary: z.string().min(1),
  hypotheses: z.array(hypothesisSchema).min(1),
  focus: z.object({
    metric: metricEnum,
    title: z.string().min(1),
    action: z.string().min(1),
    why: z.string().min(1),
    whyItMatters: z.string().min(1),
    measure: z.string().min(1),
    confidence: confidenceSchema,
  }),
  experiment: z.object({
    hypothesis: z.string().min(1),
    behavior: z.string().min(1),
    expectedOutcome: z.string().min(1),
    followUp: z.string().min(1),
  }),
  challenge: z.string().optional(),
  biggestWin: z.string().optional(),
  biggestConcern: z.string().optional(),
  watchFor: z.string().optional(),
  providerNote: z.string().optional(),
  mindShift: z.string().optional(),
  beliefs: z.array(z.object({ statement: z.string().min(1), strength: z.enum(["weak", "moderate", "strong"]) })).optional(),
  conclusions: z.array(z.string().min(1)).optional(),
  openQuestions: z.array(z.object({
    question: z.string().min(1),
    whyItMatters: z.string().optional(),
    status: z.enum(["open", "answered", "parked"]).default("open"),
    answer: z.string().optional(),
  })).optional(),
  playbook: z.array(z.object({
    statement: z.string().min(1),
    category: z.enum(["sleep", "focus", "stress", "energy", "mood", "recovery", "cognition", "pattern", "track_record"]),
    evidence: z.string().optional(),
  })).optional(),
});
export type ReasoningOutput = z.infer<typeof reasoningSchema>;

export type InsightOutput = z.infer<typeof insightSchema>;
export type ReportOutput = z.infer<typeof reportSchema>;
export type ProactiveNoticeOutput = z.infer<typeof proactiveNoticeSchema>;
export type DailySliderOutput = z.infer<typeof dailySliderSchema>;
export type DailyPlanOutput = z.infer<typeof dailyPlanSchema>;
