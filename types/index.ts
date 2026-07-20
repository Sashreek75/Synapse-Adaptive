/**
 * Core domain types for Synapse Adaptive.
 * (Single source of truth for metrics, insights, reports, and profiles.)
 *
 * ARCHITECTURAL LAW: no abstraction may exist merely because it was inherited from
 * the health application. Every type must justify itself against today's product —
 * "would we invent this if Synapse started today?". Health is ONE source of evidence.
 */

export type Confidence = "low" | "moderate" | "high";
export type InsightCategory = "observation" | "education" | "behavioral_focus";
export type MetricKey =
  | "reaction_time" | "attention" | "working_memory" | "processing_speed"
  | "fatigue" | "mood" | "sleep_quality" | "stress" | "symptoms";
export type MetricDirection = "higher_is_better" | "lower_is_better";

export interface MetricMeta { key: MetricKey; label: string; direction: MetricDirection; description: string; }
export interface MetricPoint { metric: SignalId; valueNorm: number; recordedAt: string; }
export interface MetricSeries { metric: SignalId; points: MetricPoint[]; }

/* ── Clinical reasoning: how Synapse thinks, not just what it stores ────────── */

/** One candidate explanation Synapse weighed this week. */
export interface Hypothesis { explanation: string; support: string; confidence: Confidence; }

/** The result of Synapse's weekly reasoning — an opinion, with its working shown. */
export interface WeeklyFocusReasoning {
  weekKey: string;
  metric: SignalId;
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
  /** The small test to run — ONLY when an experiment is genuinely the right move
   * this week. Most weeks this is absent: the right response is reassurance,
   * explanation, encouragement, or a single small suggestion, not homework. */
  experiment?: { hypothesis: string; behavior: string; expectedOutcome: string; followUp: string };
  /** What KIND of help this week calls for — the engine picks the right intervention,
   * it does not default to an experiment. */
  interventionType?: InterventionType;
  /** A polite, evidence-based challenge to something the user assumed (optional). */
  challenge?: string;
  /** Coaching report fields — the flagship weekly experience. */
  biggestWin?: string;
  biggestConcern?: string;
  watchFor?: string;        // what to pay attention to before next week
  providerNote?: string;    // what to raise with a provider if the trend continues
  /** A visible learning moment: "I've changed my mind…" (only when it really shifted). */
  mindShift?: string;
  /** The one "I never realized that" — the non-obvious discovery to lead with. */
  surprise?: Surprise;
  /** True when this is a first-session read from onboarding alone (label it as early). */
  early?: boolean;
  /** True when Synapse is stepping back from coaching to urge provider discussion. */
  escalate?: boolean;
  source: "model" | "fallback";
}

/** A durable belief Synapse holds about this person — evolves with evidence. */
export interface Belief { statement: string; strength: "weak" | "moderate" | "strong"; updatedAt: string; }

/** The kind of help a moment calls for. A good coach doesn't always assign homework —
 * sometimes they reassure, explain, encourage, notice, ask, or give one small nudge.
 * Experiments are a special, rare tool, used only when evidence can actually be moved. */
export type InterventionType =
  | "reassure" | "explain" | "encourage" | "advise" | "experiment" | "observe" | "ask";

/** A confirmed theory that has graduated into a lasting behavior — the END of the
 * loop. Discovery → experiment → repeated success → habit → measurable improvement. */
export interface Habit {
  id: string;
  statement: string;              // "Keeping bedtime within ~30 min lifts your next-day focus"
  metric?: SignalId;
  fromHypothesisId?: string;
  status: "building" | "established" | "lapsed";
  reinforcements: number;         // times evidence/experiments have re-confirmed it
  establishedAt: string;
  updatedAt: string;
}

/** The one non-obvious finding worth leading with — an "I never realized that" moment.
 * Deliberately something a dashboard, a spreadsheet, or a generic chatbot could NOT
 * surface, because it only emerges from watching THIS person over time. */
export interface Surprise {
  observation: string;
  whyNonObvious: string;
  confidence: Confidence;
  recurrence: string;
}

/** Where a hypothesis sits in its life — the product is the LOOP: form → test → revise. */
export type HypothesisStatus =
  | "forming" | "testing" | "supported" | "confirmed" | "weakened" | "rejected" | "dormant";

/** A working theory Synapse holds about one person and actively tests over time. The
 * implementation is scientific; the language shown to the user is warm (lib/hypotheses.ts). */
export interface TrackedHypothesis {
  id: string;
  statement: string;
  metrics: SignalId[];
  status: HypothesisStatus;
  confidence: Confidence;
  supportingObservations: number;
  contradictingObservations: number;
  firstFormedAt: string;
  updatedAt: string;
  prediction?: string;
  suggestedExperiment?: string;
  originAssociationKey?: string;
  evidenceLog: { weekKey: string; direction: "support" | "contradict"; note: string }[];
}

/** Compact record of which relationships appeared in a week — the substrate for
 * recurrence ("four weeks running"), also our guard against one-week spurious links. */
export interface AssociationSnapshot { weekKey: string; key: string; r?: number; n: number; }

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

/** Synapse's evolving mental model of a human — organized (via lib/person-model.ts)
 * by epistemic state: what it KNOWS, BELIEVES, is QUESTIONING, is WONDERING about,
 * TRUSTS, and what the person is COMMITTED to. The fields below are the substrate;
 * the epistemic views are derived, never stored. */
export interface PersonModel {
  beliefs: Belief[];
  conclusions: string[];
  openQuestions: OpenQuestion[];
  weekly: Record<string, WeeklyFocusReasoning>;
  playbook: PlaybookEntry[];
  /** The working theories Synapse is actively testing about this person. */
  hypotheses: TrackedHypothesis[];
  /** Rolling record of which relationships appeared each week (for recurrence). */
  associationHistory: AssociationSnapshot[];
  /** Confirmed theories that have become lasting habits — the loop's payoff. */
  habits: Habit[];
  /** WHO this person is trying to become — the objective the engine steers toward.
   * Two people with identical evidence but different trajectories get different help. */
  trajectory?: Trajectory | null;
  /** The atomic evidence log — any kind (measurement/event/statement/outcome), not
   * just metrics. The quantitative engine consumes the measurement projection; the
   * rest enriches what Synapse knows/believes about the person. Additive in P1. */
  evidence?: Evidence[];
}

/** @deprecated transitional alias — the model is a PersonModel now. Kept so the
 * existing call sites compile while they migrate off the name. */
export type Mind = PersonModel;

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

export interface RecentChange { metric: SignalId; label: string; deltaNorm: number; framing: string; improving: boolean; }
export interface ProviderQuestion { id: string; text: string; source: "insight" | "proactive" | "chat" | "manual"; status: "open" | "asked" | "dismissed"; }

export interface HealthReport {
  id: string;
  cycleLabel: string;
  summary: string;
  overallConfidence: Confidence;
  insights: Insight[];
  /** 2-3 concrete priorities for next week (model-authored when available). */
  nextWeek?: string[];
  /** The single most eye-opening pattern this week — the thing to lead with. */
  mostSurprising?: string;
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


/* ═══════════════════════════════════════════════════════════════════════════
 * ENGINE V2 FOUNDATION — the person-understanding core.
 * The atom is EVIDENCE (not a metric). A measurement is one KIND of evidence.
 * A SIGNAL is a measurable dimension (health signals are one set among many).
 * A TRAJECTORY is who the person is becoming — the objective everything answers to.
 * Introduced additively in P1; the legacy metric types remain until later phases.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** One identity a person is actively building. Humans hold several at once
 * (founder AND father AND athlete); each has its own priority and can rise, fade,
 * pause, or resurface over time. The engine reasons about the tradeoffs between them. */
export interface Identity {
  id: string;
  label: string;                     // "founder", "present father", "athlete"
  statement?: string;                // fuller "who I'm becoming" phrasing
  priority: number;                  // 0..1 relative centrality right now
  status: "active" | "emerging" | "paused" | "background";
  why?: string;
  updatedAt: string;
}

/** Who this person is trying to become. First-class, never a tag. A person is not one
 * arrow: `identities` holds the several they are building at once, so two people with the
 * same evidence but different identities (and different priorities among them) get different
 * help. `statement` stays as the primary (highest-priority) identity for back-compat. */
export interface Trajectory {
  statement: string;                 // "become a founder", "be a present father"
  horizon?: "weeks" | "months" | "years" | "life";
  why?: string;                      // what reaching it would mean to them
  updatedAt: string;
  identities?: Identity[];
}

/** The kinds of thing Synapse can learn — people are more than measurements. */
export type EvidenceKind = "measurement" | "event" | "statement" | "outcome";

/** Facets, not a single domain: one piece of evidence can touch several at once
 * (an interview failure is career AND confidence AND learning AND relationships). */
export interface EvidenceFacets {
  areas?: string[];                  // free tags — "career","confidence","sleep","family"
  timeHorizon?: "now" | "days" | "weeks" | "months" | "years";
  people?: string[];
  goalRef?: string;                  // which goal / trajectory it bears on
  energy?: "draining" | "neutral" | "energizing";
  importance?: "low" | "medium" | "high";
  emotion?: string;
}

/** The atomic unit the engine learns from. */
export interface Evidence {
  id: string;
  kind: EvidenceKind;
  recordedAt: string;
  source: "checkin" | "assessment" | "tool" | "conversation" | "import";
  facets?: EvidenceFacets;
  // kind === "measurement"
  signalId?: SignalId; valueNorm?: number; raw?: number;
  // kind === "event" | "statement"
  text?: string;
  // kind === "outcome"
  refId?: string;
  captureConfidence?: Confidence;
}

/** A measurable dimension. OPEN: any domain's signal id is valid (health metric ids
 * are one subset). The registry (lib/signals.ts) owns validation and metadata. The
 * numeric correlation core still runs on the health `MetricKey` subset — its honest
 * quantitative substrate — while Evidence and the registry accept any signal. */
export type SignalId = string;
export type SignalKind = "rating" | "scalar" | "count" | "duration" | "boolean";
export interface SignalDef {
  id: SignalId;
  label: string;
  domain: string;                    // "health" for the legacy nine; open for new domains
  kind: SignalKind;
  direction: MetricDirection;
  cadence: "daily" | "weekly" | "event";
  description: string;
  expectedRelations?: SignalId[];    // known-obvious partners (feeds the surprise prior)
}

/** Canonical, domain-neutral names. A measurement series is a SIGNAL series; the
 * Metric* names survive only as the health-subset aliases the legacy call sites use. */
export type SignalPoint = MetricPoint;
export type SignalSeries = MetricSeries;
