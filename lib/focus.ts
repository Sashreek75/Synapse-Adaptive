/**
 * DECISION INTELLIGENCE — the Focus + Experiment engine.
 *
 * This is the organizing principle of the product. At any moment Synapse asks
 * the user to focus on exactly ONE thing. Everything else is secondary.
 *
 * A WeeklyFocus completes the coaching loop:
 *   1. What changed?      2. Why (with uncertainty, multiple sources)?
 *   3. Why does it matter?  4. The ONE thing to focus on.
 *   5. How we'll know it helped (the follow-up measure).
 *
 * And it always carries an Experiment: a small, low-risk behavior to try, a
 * hypothesis, an expected outcome, and a follow-up — so Synapse learns WITH the
 * user instead of guessing. Deterministic (works offline); the model deepens the
 * language but never needs to for the loop to be complete.
 */

import { computeTrend, relativeLevel, relativeMove } from "@/lib/stats";
import { computeAssociations } from "@/lib/correlations";
import { signalLabel, signalDirection } from "@/lib/signals";
import { goalMetricsForPath, getPath } from "@/lib/paths";
import type { Confidence, MetricSeries, RecentChange, SignalId, WeeklyFocusReasoning } from "@/types";

export interface Experiment {
  hypothesis: string;    // what we think is true
  behavior: string;      // the ONE small thing to try
  expectedOutcome: string;
  followUp: string;      // what Synapse will measure next
  durationDays: number;
}

export interface WeeklyFocus {
  id: string;
  weekKey: string;
  metric: SignalId;
  title: string;         // "Improve sleep consistency"
  /** 1. What changed */
  whatChanged: string;
  /** 2. Why I think this happened (with uncertainty) */
  why: string;
  /** 3. Why it matters */
  whyItMatters: string;
  /** 4. The ONE thing to focus on — today's action */
  focusAction: string;
  /** 5. How we'll know it helped */
  measure: string;
  experiment: Experiment;
  confidence: Confidence;
  /** Whether this focus is about protecting a win vs addressing a dip. */
  mode: "improve" | "protect" | "monitor";
}

/** Week key = the Sunday that ends the current week (matches dashboard + report). */
export function currentWeekKey(d = new Date()): string {
  const s = new Date(d);
  s.setDate(s.getDate() + ((7 - s.getDay()) % 7));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`;
}

/**
 * The coaching template per metric — the ONE behavior, framed as an experiment.
 * Behavioral only, never medical. Kept short: a coach gives one clear instruction.
 */
const PLAYBOOK: Partial<Record<SignalId, {
  title: string;
  behavior: string;
  matters: string;
  hypothesisLead: string; // "steadier sleep tends to lift your focus"
}>> = {
  sleep_quality: {
    title: "Improve sleep consistency",
    behavior: "Keep your bed and wake times within a one-hour window every day this week — consistency matters more than total hours.",
    matters: "Sleep is the lever that quietly moves your energy, focus, and mood, so steadying it tends to lift several things at once.",
    hypothesisLead: "steadier sleep tends to lift your next-day focus and energy",
  },
  fatigue: {
    title: "Protect your energy",
    behavior: "Pick one day this week for a genuinely lighter load, and take a real break before you feel you've earned it.",
    matters: "Letting energy recover on purpose keeps a dip from compounding into a rougher stretch.",
    hypothesisLead: "deliberate recovery keeps your energy from sliding further",
  },
  stress: {
    title: "Steady your stress",
    behavior: "Add one five-minute wind-down at the same time each day — a short walk or slow breathing. Small and repeatable beats big and occasional.",
    matters: "Stress colors sleep, focus, and mood, so easing it a little often lifts the rest.",
    hypothesisLead: "a daily decompress lowers your stress and steadies your sleep",
  },
  attention: {
    title: "Sharpen your focus",
    behavior: "Protect a single 25-minute, distraction-free block each day for the thing that matters most.",
    matters: "Attention responds directly to how protected your focus time is — it's something you can influence today.",
    hypothesisLead: "protected focus time raises your attention scores",
  },
  mood: {
    title: "Lift your baseline mood",
    behavior: "Do one small thing that reliably lifts you each day, and note what it was.",
    matters: "Mood is one of your most responsive signals — small, intentional inputs show up quickly.",
    hypothesisLead: "small daily lifts move your mood measurably",
  },
  reaction_time: {
    title: "Give reaction time a fair read",
    behavior: "Take your assessments at the same time of day this week, rested, without caffeine right before.",
    matters: "Reaction time is sensitive to timing and rest, so a clean read makes everything else more trustworthy.",
    hypothesisLead: "consistent testing conditions steady your reaction-time reads",
  },
  working_memory: {
    title: "Build working memory gently",
    behavior: "Do a few minutes of focused mental work daily rather than one long session.",
    matters: "Working memory responds to steady, low-pressure practice, not cramming.",
    hypothesisLead: "short daily practice nudges your working memory up",
  },
  processing_speed: {
    title: "Give speed a clean run",
    behavior: "Do this week's timed tasks somewhere quiet, at a consistent time.",
    matters: "Processing speed is an early signal that rewards a fair test.",
    hypothesisLead: "a consistent, quiet setting steadies your processing speed",
  },
  symptoms: {
    title: "Track symptoms in context",
    behavior: "Jot a quick note on the days symptoms interfere, with what else was going on that day.",
    matters: "Symptom timing is often what connects the rest of your trends together for your provider.",
    hypothesisLead: "noting context reveals what your symptoms track with",
  },
};

const dayKey = (iso: string) => iso.slice(0, 10);

/** Choose the ONE metric that most deserves focus this week. */
function pickFocusMetric(
  series: MetricSeries[],
  path: string,
  recent: RecentChange[],
): { metric: SignalId; mode: WeeklyFocus["mode"]; delta: number; latest: number; baseline: number; n: number; confidence: Confidence } | null {
  if (!series.length) return null;
  const goals = new Set<SignalId>(goalMetricsForPath(path));
  const trends = series.map((s) => ({ s, t: computeTrend(s) }));

  const scored = trends.map(({ s, t }) => {
    const higher = signalDirection(s.metric) === "higher_is_better";
    const declining = higher ? t.delta < -3 : t.delta > 3;
    const improving = higher ? t.delta > 3 : t.delta < -3;
    // Priority: a declining GOAL metric is the most decision-worthy thing.
    let score = 0;
    if (declining) score += 1.2;
    if (goals.has(s.metric)) score += 0.8;
    score += Math.min(1, Math.abs(t.delta) / 15);
    score += Math.min(0.6, t.volatility / 20);
    if (improving && !declining) score -= 0.3; // wins matter, but dips lead
    return { metric: s.metric, t, declining, improving, score };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top) return null;
  const mode: WeeklyFocus["mode"] = top.declining ? "improve" : top.improving ? "protect" : "monitor";
  return {
    metric: top.metric, mode,
    delta: Math.round(top.t.delta), latest: Math.round(top.t.latest),
    baseline: Math.round(top.t.baseline), n: top.t.n, confidence: top.t.confidenceCeiling,
  };
}

/**
 * Select this week's single focus — the whole product revolves around this.
 */
export function selectWeeklyFocus(
  series: MetricSeries[],
  path: string,
  recent: RecentChange[],
): WeeklyFocus | null {
  const pick = pickFocusMetric(series, path, recent);
  if (!pick) return null;
  const { metric, mode, delta, latest, baseline, n, confidence } = pick;
  const label = signalLabel(metric).toLowerCase();
  const play = PLAYBOOK[metric] ?? {
    title: `Focus on your ${label}`,
    behavior: `Give your ${label} deliberate, repeatable attention this week and note what shifts.`,
    matters: `It's one of the signals you're tracking, so a small, steady push here is the kind of thing that moves it.`,
    hypothesisLead: `steady, deliberate attention to your ${label} tends to move it`,
  };

  // Connect to a real relationship in the data when we have one (multi-source "why").
  const assoc = computeAssociations(series, goalMetricsForPath(path), 4);
  const linked = assoc.find((a) => a.metrics.includes(metric));
  const connection = linked ? ` It doesn't move alone, either — ${linked.plain.charAt(0).toLowerCase()}${linked.plain.slice(1)}` : "";

  const level = relativeLevel(latest, baseline);
  const whatChanged =
    mode === "improve"
      ? `Your ${label} has slipped lately — it's sitting ${level}.`
      : mode === "protect"
      ? `Your ${label} has been trending up — currently ${level}.`
      : `Your ${label} has held fairly steady, and it's central to what you're working toward.`;

  const why =
    (mode === "improve"
      ? `A single week bounces around with sleep, stress, and daily life, so I'm not over-reading one dip.`
      : mode === "protect"
      ? `This looks like real, consistent movement rather than noise.`
      : `Steady isn't the same as finished — it's the area where a small, deliberate push is most likely to pay off.`) + connection;

  const focusAction = play.behavior;
  const measure =
    mode === "protect"
      ? `Next week I'll check whether your ${label} holds — if it does on good data, we'll know the routine is working.`
      : `Next week's ${label} reading is how we'll know: if it moves toward your baseline, the change is likely helping; if not, we'll try a different angle together.`;

  const experiment: Experiment = {
    hypothesis: `I think ${play.hypothesisLead}.`,
    behavior: play.behavior,
    expectedOutcome:
      mode === "protect"
        ? `If we're right, your ${label} holds where it is or better.`
        : `If we're right, your ${label} edges back toward your usual range over the week.`,
    followUp: `We'll compare next week's ${label} against this week and review it together.`,
    durationDays: 7,
  };

  return {
    id: `focus_${currentWeekKey()}_${metric}`,
    weekKey: currentWeekKey(),
    metric,
    title: mode === "protect" ? `Protect your ${label}` : play.title,
    whatChanged,
    why,
    whyItMatters: play.matters,
    focusAction,
    measure,
    experiment,
    confidence,
    mode,
  };
}

/* ============================================================================
 * EXPERIMENT TRACKING — closing the loop across weeks. We persist the experiment
 * (and the metric's value when it started), then review it against the check-ins
 * that came AFTER it started. This is what makes Synapse "learn with you" instead
 * of re-suggesting into the void.
 * ========================================================================== */

export type ExperimentOutcome = "worked" | "partial" | "no_change" | "regressed" | "inconclusive";

export interface ExperimentRecord {
  id: string;
  weekKey: string;
  metric: SignalId;
  title: string;
  behavior: string;
  hypothesis: string;
  mode: WeeklyFocus["mode"];
  baseline: number;    // metric value when the experiment started
  startedAt: string;   // ISO
}

/** Capture the starting point for a focus so we can measure it later. */
export function experimentFromFocus(focus: WeeklyFocus, series: MetricSeries[]): ExperimentRecord {
  const s = series.find((x) => x.metric === focus.metric);
  const baseline = s && s.points.length ? Math.round(computeTrend(s).latest) : 0;
  return {
    id: focus.id, weekKey: focus.weekKey, metric: focus.metric, title: focus.title,
    behavior: focus.focusAction, hypothesis: focus.experiment.hypothesis, mode: focus.mode,
    baseline, startedAt: new Date().toISOString(),
  };
}

export interface ExperimentReview {
  record: ExperimentRecord;
  outcome: ExperimentOutcome;
  baseline: number;
  result: number | null;
  delta: number;      // improvement in the "better" direction (can be negative)
  headline: string;
  detail: string;
  nextStep: string;
}

const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/** Review a past experiment against the readings that came after it started. */
export function reviewExperiment(rec: ExperimentRecord, series: MetricSeries[]): ExperimentReview {
  const label = signalLabel(rec.metric).toLowerCase();
  const s = series.find((x) => x.metric === rec.metric);
  const post = s ? s.points.filter((p) => new Date(p.recordedAt).getTime() > new Date(rec.startedAt).getTime()).map((p) => p.valueNorm) : [];

  if (post.length < 2) {
    return {
      record: rec, outcome: "inconclusive", baseline: rec.baseline, result: null, delta: 0,
      headline: `Our experiment on your ${label} is still running.`,
      detail: `I need a couple more check-ins before I can honestly say whether it's working — there isn't enough new data yet.`,
      nextStep: `Keep going with one thing: ${rec.behavior}`,
    };
  }

  const result = Math.round(meanOf(post));
  const higher = signalDirection(rec.metric) === "higher_is_better";
  const delta = Math.round(higher ? result - rec.baseline : rec.baseline - result);
  const outcome: ExperimentOutcome = delta >= 5 ? "worked" : delta >= 2 ? "partial" : delta <= -5 ? "regressed" : "no_change";
  const move = `your ${label} ${relativeMove(delta)}`;

  const verdict: Record<Exclude<ExperimentOutcome, "inconclusive">, { headline: string; detail: string; nextStep: string }> = {
    worked: {
      headline: `That looks like it helped — ${move} versus where you started.`,
      detail: `The change moved with what we tried, though a single week can't prove one caused the other. It's an encouraging early sign, not a settled fact.`,
      nextStep: `Let's hold this another week to see if the gain sticks before I trust it.`,
    },
    partial: {
      headline: `A small, promising move — ${move}.`,
      detail: `It nudged the right way, but not enough to be sure yet. Worth one more week.`,
      nextStep: `Let's run the same experiment again and see if the trend holds.`,
    },
    no_change: {
      headline: `Being honest, ${move} — this one didn't move the needle.`,
      detail: `No meaningful change. That's genuinely useful: it's a sign this probably isn't the main lever for your ${label} right now.`,
      nextStep: `Rather than push harder on the same thing, let's test a different angle this week.`,
    },
    regressed: {
      headline: `${move.charAt(0).toUpperCase()}${move.slice(1)} — the opposite of what we hoped.`,
      detail: `That might be the experiment, or just a harder week — I won't over-read a single week either way.`,
      nextStep: `Let's ease off and pick a gentler focus, and keep watching.`,
    },
  };
  const v = verdict[outcome as Exclude<ExperimentOutcome, "inconclusive">];
  return { record: rec, outcome, baseline: rec.baseline, result, delta, headline: v.headline, detail: v.detail, nextStep: v.nextStep };
}

/* ============================================================================
 * ESCALATION — when a monitored trend consistently worsens (or symptoms stay
 * high), Synapse stops coaching and urges a timely provider conversation. Safety
 * over cleverness: this is deterministic, never left to the model.
 * ========================================================================== */
export interface Escalation { metric: SignalId; label: string; reason: string; }

export function detectEscalation(series: MetricSeries[], path: string): Escalation | null {
  const goals = new Set<SignalId>(goalMetricsForPath(path));
  for (const s of series) {
    if (s.points.length < 4) continue;
        const pts = s.points.slice(-4).map((p) => p.valueNorm);
    const higher = signalDirection(s.metric) === "higher_is_better";
    const net = pts[pts.length - 1] - pts[0];
    const worseningNet = higher ? net <= -15 : net >= 15;
    let badSteps = 0;
    for (let i = 1; i < pts.length; i++) { const d = pts[i] - pts[i - 1]; if (higher ? d < 0 : d > 0) badSteps++; }
    if (worseningNet && badSteps >= 2 && (goals.has(s.metric) || s.metric === "symptoms")) {
      return { metric: s.metric, label: signalLabel(s.metric), reason: `your ${signalLabel(s.metric).toLowerCase()} has moved the wrong way across several check-ins in a row` };
    }
    if (s.metric === "symptoms" && pts.slice(-3).every((v) => v >= 70)) {
      return { metric: "symptoms", label: "Symptoms", reason: "your symptoms have stayed high across several check-ins" };
    }
  }
  return null;
}

/** Build an escalation "focus" — stop experimenting, point to qualified real-world help. */
export function escalationReasoning(e: Escalation): WeeklyFocusReasoning {
  return {
    weekKey: currentWeekKey(), metric: e.metric, title: "Time to bring in real help",
    action: `I'd talk this over soon with a professional who can actually help — ${e.reason}, and that's beyond what a small experiment should carry.`,
    why: `When a trend keeps moving the wrong way over several check-ins, the responsible next step isn't another self-experiment — it's a real conversation with someone qualified to help.`,
    whyItMatters: `I can help you track and prepare, but I can't assess this myself. Getting a qualified person's eyes on it now is the safer call.`,
    measure: `Keep checking in if you can — I'll keep watching, and it'll help you describe the trend accurately when you get help.`,
    confidence: "moderate",
    reasoningSummary: `I'm stepping back from coaching this week: ${e.reason}. Rather than propose an experiment, I think this deserves a timely conversation with someone qualified to help.`,
    hypotheses: [{ explanation: "This trend may be beyond what small changes can address.", support: e.reason, confidence: "moderate" }],
    experiment: { hypothesis: "Someone qualified can assess this properly.", behavior: "Book time with a professional who can help, and bring your recent trend.", expectedOutcome: "A qualified read on what's driving this.", followUp: "I'll keep tracking so that conversation is well-informed." },
    providerNote: `${e.label}: ${e.reason}.`,
    escalate: true,
    source: "fallback",
  };
}

/** First-session read from onboarding alone — clearly an early impression. */
export function earlyImpression(profile: { displayName?: string; path?: string; goals?: string[]; primaryChallenge?: string; conditionLabel?: string }): WeeklyFocusReasoning {
  const p = getPath(profile.path);
  const goal = (profile.goals?.[0] || profile.primaryChallenge || p.focusNoun).toLowerCase();
  const watching = p.goalMetrics.slice(0, 2).map((m) => signalLabel(m).toLowerCase());
  const watchList = watching.length === 2 ? `${watching[0]} and ${watching[1]}` : watching[0] ?? "how you're doing";
  return {
    weekKey: currentWeekKey(), metric: p.goalMetrics[0], title: "Getting to know you",
    action: "Do your first check-in — and an assessment when you have a few minutes — so I can move from impression to evidence.",
    why: "Everything here is based only on your onboarding so far, so treat it as a starting point I'll revise, not a conclusion.",
    whyItMatters: `You told me you're focused on ${goal}. Given that, I'll start by paying attention to your ${watchList} — and let what actually matters for you emerge from your check-ins.`,
    measure: "Once you've checked in a few times, I'll replace this early impression with a read grounded in your own data.",
    confidence: "low",
    reasoningSummary: `This is an early impression from what you shared in onboarding — I haven't seen any check-ins yet, so it's a starting hypothesis, not a finding. Based on your goal of ${goal}, I'd begin by watching your ${watchList}, and I'll sharpen this as you check in.`,
    hypotheses: [{ explanation: `You're focused on ${goal}.`, support: "From your onboarding answers — not yet from your data.", confidence: "low" }],
    experiment: { hypothesis: "A week of check-ins will reveal your real baseline.", behavior: "Check in daily this week.", expectedOutcome: "Enough signal for me to form a focus grounded in your data.", followUp: "I'll turn this early impression into a real, evidence-based focus next week." },
    early: true,
    source: "fallback",
  };
}

export interface FocusProgress {
  daysLogged: number;
  target: number;
  pct: number;      // 0..1
  label: string;
}

/**
 * Honest progress toward the week's focus: how consistently the user has shown
 * up this week (the thing that lets us actually measure the experiment).
 */
export function focusProgress(checkInDates: string[]): FocusProgress {
  const wk = currentWeekKey();
  const end = new Date(`${wk}T00:00:00`);
  const start = new Date(end); start.setDate(start.getDate() - 6);
  const days = new Set<string>();
  for (const iso of checkInDates) {
    const d = new Date(iso);
    if (d >= start && d <= new Date(end.getTime() + 864e5)) days.add(dayKey(iso));
  }
  const daysLogged = days.size;
  const target = 7;
  const pct = Math.min(1, daysLogged / target);
  const label =
    daysLogged === 0
      ? "No check-ins yet this week — the first one starts the experiment."
      : daysLogged >= target
      ? "A full week of check-ins — we'll have a clean read to review."
      : `${daysLogged} of ${target} days logged this week — each one sharpens how we measure this.`;
  return { daysLogged, target, pct, label };
}
