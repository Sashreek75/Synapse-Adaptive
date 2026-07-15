/**
 * Core domain types for Synapse Adaptive.
 * (Single source of truth for metrics, insights, reports, and profiles.)
 */

export type Confidence = "low" | "moderate" | "high";
export type InsightCategory = "observation" | "education" | "behavioral_focus";
export type MetricKey =
  | "reaction_time" | "attention" | "working_memory" | "processing_speed"
  | "fatigue" | "mood" | "sleep_quality" | "stress" | "symptoms";
export type MetricDirection = "higher_is_better" | "lower_is_better";

export interface MetricMeta { key: MetricKey; label: string; direction: MetricDirection; description: string; }
export interface MetricPoint { metric: MetricKey; valueNorm: number; recordedAt: string; }
export interface MetricSeries { metric: MetricKey; points: MetricPoint[]; }

/* ── Clinical reasoning: how Synapse thinks, not just what it stores ────────── */

/** One candidate explanation Synapse weighed this week. */
export interface Hypothesis { explanation: string; support: string; confidence: Confidence; }

/** The result of Synapse's weekly reasoning — an opinion, with its working shown. */
export interface WeeklyFocusReasoning {
  weekKey: string;
  metric: MetricKey;
  title: string;
  action: string;              // the ONE behavior
  why: string;
  whyItMatters: string;
  measure: string;
  confidence: Confidence;
  /** The signature: 3-5 sentences on how Synapse reached this conclusion. */
  reasoningSummary: string;
  /** The explanations it considered and weighed (not just the winner). */
  hypotheses: Hypothesis[];
  experiment: { hypothesis: string; behavior: string; expectedOutcome: string; followUp: string };
  /** A polite, evidence-based challenge to something the user assumed (optional). */
  challenge?: string;
  /** Coaching report fields — the flagship weekly experience. */
  biggestWin?: string;
  biggestConcern?: string;
  watchFor?: string;        // what to pay attention to before next week
  providerNote?: string;    // what to raise with a provider if the trend continues
  /** A visible learning moment: "I've changed my mind…" (only when it really shifted). */
  mindShift?: string;
  /** True when this is a first-session read from onboarding alone (label it as early). */
  early?: boolean;
  /** True when Synapse is stepping back from coaching to urge provider discussion. */
  escalate?: boolean;
  source: "model" | "fallback";
}

/** A durable belief Synapse holds about this person — evolves with evidence. */
export interface Belief { statement: string; strength: "weak" | "moderate" | "strong"; updatedAt: string; }

/** A learned "how you work" statement — the Personal Playbook. Built over months
 * from experiments, assessments, and conversations. This is the thing a data
 * store can't replicate: not what happened, but how THIS person works. */
export interface PlaybookEntry {
  id: string;
  statement: string;
  category: "sleep" | "focus" | "stress" | "energy" | "mood" | "recovery" | "cognition" | "pattern" | "track_record";
  evidence?: string;
  experiments?: number;     // how many experiments back this
  updatedAt: string;
}

/** A question Synapse hasn't answered yet about this person — it actively tries
 * to close these through conversation, observation, and low-risk experiments. */
export interface OpenQuestion {
  id: string;
  question: string;              // "Does nutrition affect your afternoon fatigue?"
  whyItMatters?: string;         // what a good answer would unlock
  status: "open" | "answered" | "parked";
  answer?: string;               // filled in when Synapse reaches a conclusion
  openedAt: string;
  updatedAt: string;
}

/** Synapse's evolving world-model of the user: beliefs, distilled conclusions,
 * open questions it's still working on, the weekly reasoning, and the Personal
 * Playbook of learned patterns. */
export interface Mind {
  beliefs: Belief[];
  conclusions: string[];
  openQuestions: OpenQuestion[];
  weekly: Record<string, WeeklyFocusReasoning>;
  playbook: PlaybookEntry[];
}

export interface Insight {
  id: string;
  category: InsightCategory;
  observation: string;
  reasoning: string;
  suggestedFocus: string[];
  questionsForProvider: string[];
  confidence: Confidence;
  confidenceRationale: string;
  evidenceRefs: string[];
  uncertaintyFlags: string[];
  /** Another plausible explanation for the same pattern (honesty over neatness). */
  alternativeExplanation?: string;
  /** What new information would change this read. */
  wouldChange?: string;
  createdAt: string;
}

export type ProactivePatternType =
  | "sustained_trend" | "divergence" | "plateau" | "new_correlation" | "milestone";

export interface ProactiveNotice extends Insight {
  patternType: ProactivePatternType;
  salience: number;
  surfacedAt: string;
  dedupeKey: string;
  tone: "celebratory" | "watchful" | "informational";
}

export interface RecentChange { metric: MetricKey; label: string; deltaNorm: number; framing: string; improving: boolean; }
export interface ProviderQuestion { id: string; text: string; source: "insight" | "proactive" | "chat" | "manual"; status: "open" | "asked" | "dismissed"; }

export interface HealthReport {
  id: string;
  cycleLabel: string;
  summary: string;
  overallConfidence: Confidence;
  insights: Insight[];
  /** 2-3 concrete priorities for next week (model-authored when available). */
  nextWeek?: string[];
  createdAt: string;
  generationMeta?: { promptId: string; source: "model" | "fallback" };
}

export interface UpcomingAssessment {
  battery: { key: string; label: string; estSeconds: number; rationale: string }[];
  totalEstSeconds: number;
}

export interface HealthProfile {
  displayName: string;
  conditionCategory: string;
  conditionLabel: string;
  recoveryStage: "acute" | "subacute" | "maintenance";
  goals: string[];
  weeksTracked: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sections?: { kind: "observation" | "education" | "ask_provider"; text: string }[];
  evidenceUsed?: string[];
}
