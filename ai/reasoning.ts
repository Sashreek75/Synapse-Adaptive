import "server-only";

/**
 * THE REASONING ENGINE — Synapse's clinical-reasoning pass.
 *
 * Each week the model gets a rich picture of the person (profile, trends,
 * associations, PAST EXPERIMENT OUTCOMES, current beliefs, prior conclusions,
 * recent notes) and runs a hypothesis chain: consider several explanations, weigh
 * them, commit to the strongest, choose ONE priority, design an experiment, and
 * show its working. It also revises its beliefs (and says so — "I've changed my
 * mind"), writes the flagship weekly-report fields, and grows the Personal
 * Playbook of "how you work" learnings. Deterministic fallback keeps it alive.
 */

import { callModel, extractJson } from "@/ai/client";
import { REASONING_PROMPT } from "@/ai/prompts";
import { postGate } from "@/ai/safety";
import { reasoningSchema } from "@/ai/schemas";
import { computeTrend } from "@/lib/stats";
import { computeAssociations } from "@/lib/correlations";
import { selectWeeklyFocus, reviewExperiment, currentWeekKey, detectEscalation, escalationReasoning, type ExperimentRecord } from "@/lib/focus";
import { goalMetricsForPath } from "@/lib/paths";
import { metricLabel } from "@/lib/metrics";
import type { PlanId } from "@/lib/billing/plans";
import type { Belief, Confidence, MetricKey, MetricSeries, OpenQuestion, PlaybookEntry, RecentChange, WeeklyFocusReasoning } from "@/types";

const RANK: Record<Confidence, number> = { low: 0, moderate: 1, high: 2 };

export interface ReasoningInput {
  profile: {
    displayName?: string; path?: string; goals?: string[]; conditionLabel?: string;
    recoveryStage?: string; primaryChallenge?: string; occupation?: string;
    activityLevel?: string; lifestyle?: Record<string, string>; definitionOfBetter?: string;
    weeksTracked?: number;
  };
  series: MetricSeries[];
  recentChanges: RecentChange[];
  experiments: ExperimentRecord[];
  beliefs: Belief[];
  conclusions: string[];
  openQuestions?: OpenQuestion[];
  notes: { prompt: string; answer: string }[];
  tier?: PlanId;
}

export interface ReasoningResult {
  reasoning: WeeklyFocusReasoning;
  beliefs?: Belief[];
  conclusions?: string[];
  openQuestions?: OpenQuestion[];
  playbook?: PlaybookEntry[];
}

function ceilingFor(series: MetricSeries[], metric: MetricKey): Confidence {
  const s = series.find((x) => x.metric === metric);
  return s ? computeTrend(s).confidenceCeiling : "low";
}

/** Deterministic Playbook contribution: the user's experiment track record. */
function playbookFromExperiments(experiments: ExperimentRecord[], series: MetricSeries[]): PlaybookEntry[] {
  const wins = new Map<MetricKey, number>();
  for (const e of experiments) {
    const r = reviewExperiment(e, series);
    if (r.outcome === "worked" || r.outcome === "partial") wins.set(e.metric, (wins.get(e.metric) ?? 0) + 1);
  }
  const out: PlaybookEntry[] = [];
  for (const [m, n] of wins) {
    out.push({
      id: `pb_track_${m}`, category: "track_record", experiments: n, updatedAt: new Date().toISOString(),
      statement: `You've completed ${n} successful experiment${n === 1 ? "" : "s"} improving your ${metricLabel(m).toLowerCase()}.`,
    });
  }
  return out;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

/** Reconcile the model's returned open-question list with the existing one:
 * keep stable ids for carried-forward questions, cap the open set at 5. */
function reconcileOpenQuestions(
  existing: OpenQuestion[],
  fromModel: { question: string; whyItMatters?: string; status: "open" | "answered" | "parked"; answer?: string }[],
): OpenQuestion[] {
  const now = new Date().toISOString();
  const byId = new Map(existing.map((q) => [q.id, q]));
  const out: OpenQuestion[] = [];
  for (const m of fromModel) {
    if (m.status === "answered" && !m.answer) continue; // an answer requires... an answer
    const id = `oq_${slug(m.question)}`;
    const prev = byId.get(id);
    out.push({
      id,
      question: m.question,
      whyItMatters: m.whyItMatters ?? prev?.whyItMatters,
      status: m.status,
      answer: m.answer ?? prev?.answer,
      openedAt: prev?.openedAt ?? now,
      updatedAt: now,
    });
  }
  // Preserve previously answered questions the model didn't re-send (they're history).
  for (const q of existing) {
    if (q.status === "answered" && !out.some((o) => o.id === q.id)) out.push(q);
  }
  const open = out.filter((q) => q.status === "open").slice(0, 5);
  const rest = out.filter((q) => q.status !== "open").slice(-10);
  return [...open, ...rest];
}

function buildEvidence(input: ReasoningInput) {
  const goals = goalMetricsForPath(input.profile.path);
  const trends = input.series.map((s) => {
    const t = computeTrend(s);
    return { metric: t.metric, n: t.n, latest: Math.round(t.latest), baseline: Math.round(t.baseline), delta: Math.round(t.delta), slopePerWeek: Number(t.slope.toFixed(2)), volatility: Math.round(t.volatility), confidenceCeiling: t.confidenceCeiling };
  });
  const associations = computeAssociations(input.series, goals, 6).map((a) => ({ kind: a.kind, metrics: a.metrics, r: a.r, n: a.n, confidence: a.confidence, detail: a.evidence }));
  const pastExperiments = input.experiments.slice(-6).map((e) => {
    const r = reviewExperiment(e, input.series);
    return { weekKey: e.weekKey, focus: e.title, behavior: e.behavior, metric: e.metric, baseline: e.baseline, outcome: r.outcome, result: r.result, verdict: r.headline };
  });
  return {
    profile: input.profile,
    weekKey: currentWeekKey(),
    thisWeekChanges: input.recentChanges.map((c) => ({ metric: c.metric, label: c.label, delta: c.deltaNorm, improving: c.improving })),
    trends,
    associations,
    pastExperiments,
    currentBeliefs: input.beliefs,
    priorConclusions: input.conclusions.slice(-15),
    openQuestions: (input.openQuestions ?? []).filter((q) => q.status === "open").slice(-5).map((q) => ({ question: q.question, whyItMatters: q.whyItMatters })),
    recentNotes: input.notes.slice(-6),
  };
}

function fallbackReasoning(input: ReasoningInput): ReasoningResult {
  const playbook = playbookFromExperiments(input.experiments, input.series);
  const win = input.recentChanges.find((c) => c.improving);
  const concern = input.recentChanges.find((c) => !c.improving);
  const f = selectWeeklyFocus(input.series, input.profile.path ?? "general", input.recentChanges);
  if (!f) {
    return {
      reasoning: {
        weekKey: currentWeekKey(), metric: "sleep_quality", title: "Build our baseline",
        action: "Check in daily this week so I have enough signal to reason from.",
        why: "I don't have enough data yet to form a confident opinion.",
        whyItMatters: "A week of steady check-ins is what lets me tell signal from noise.",
        measure: "Next week I'll have a baseline to reason against.",
        confidence: "low",
        reasoningSummary: "I don't have enough of your data yet to weigh explanations, so this week is about gathering a clean baseline before I commit to a focus.",
        hypotheses: [{ explanation: "Not enough data to hypothesize yet.", support: "Fewer than a couple of check-ins.", confidence: "low" }],
        experiment: { hypothesis: "Consistent check-ins will reveal a pattern.", behavior: "Log a quick daily check-in.", expectedOutcome: "Enough signal to form a real focus next week.", followUp: "I'll reason over the week's data next Sunday." },
        biggestWin: "You started — that's the hardest part.",
        biggestConcern: "I simply don't know you well enough yet; a week of check-ins fixes that.",
        watchFor: "Just aim for a check-in most days this week.",
        source: "fallback",
      },
      playbook,
    };
  }
  return {
    reasoning: {
      weekKey: f.weekKey, metric: f.metric, title: f.title, action: f.focusAction,
      why: f.why, whyItMatters: f.whyItMatters, measure: f.measure, confidence: f.confidence,
      reasoningSummary: `Working from your recent data, ${metricLabel(f.metric).toLowerCase()} is where the most meaningful movement is, so I'm making it this week's focus. As more check-ins come in I'll weigh competing explanations more explicitly.`,
      hypotheses: [{ explanation: `${f.title}.`, support: f.whatChanged, confidence: f.confidence }],
      experiment: { hypothesis: f.experiment.hypothesis, behavior: f.experiment.behavior, expectedOutcome: f.experiment.expectedOutcome, followUp: f.experiment.followUp },
      biggestWin: win ? `Your ${win.label.toLowerCase()} moved the right way.` : "You kept showing up — consistency is its own win.",
      biggestConcern: concern ? `Your ${concern.label.toLowerCase()} slipped a little — worth a gentle eye.` : "Nothing's flashing red this week.",
      watchFor: `Notice how your ${metricLabel(f.metric).toLowerCase()} responds as you try this week's focus.`,
      source: "fallback",
    },
    playbook,
  };
}

export async function generateReasoning(input: ReasoningInput): Promise<ReasoningResult> {
  // Safety first, and never left to the model: if a monitored trend keeps
  // worsening, step back from coaching and urge a provider conversation.
  const esc = detectEscalation(input.series, input.profile.path ?? "general");
  if (esc) return { reasoning: escalationReasoning(esc), playbook: playbookFromExperiments(input.experiments, input.series) };

  const tier = input.tier ?? "pro";
  const maxTokens = tier === "max" ? 3600 : tier === "free" ? 2000 : 2800;
  const evidence = buildEvidence(input);
  const raw = await callModel({ system: REASONING_PROMPT.system, user: JSON.stringify(evidence), maxTokens });
  if (!raw) return fallbackReasoning(input);

  const parsed = reasoningSchema.safeParse(extractJson(raw));
  if (!parsed.success) return fallbackReasoning(input);
  const d = parsed.data;

  const texts = [d.reasoningSummary, d.focus.action, d.focus.why, d.focus.whyItMatters, d.challenge ?? "", d.biggestWin ?? "", d.biggestConcern ?? "", d.watchFor ?? "", d.providerNote ?? "", d.mindShift ?? "", ...d.hypotheses.map((h) => `${h.explanation} ${h.support}`)];
  if (texts.some((t) => t && !postGate(t).ok)) return fallbackReasoning(input);

  const ceiling = ceilingFor(input.series, d.focus.metric);
  const confidence: Confidence = RANK[d.focus.confidence] > RANK[ceiling] ? ceiling : d.focus.confidence;

  const reasoning: WeeklyFocusReasoning = {
    weekKey: currentWeekKey(),
    metric: d.focus.metric,
    title: d.focus.title,
    action: d.focus.action,
    why: d.focus.why,
    whyItMatters: d.focus.whyItMatters,
    measure: d.focus.measure,
    confidence,
    reasoningSummary: d.reasoningSummary,
    hypotheses: d.hypotheses,
    experiment: d.experiment,
    ...(d.challenge ? { challenge: d.challenge } : {}),
    ...(d.biggestWin ? { biggestWin: d.biggestWin } : {}),
    ...(d.biggestConcern ? { biggestConcern: d.biggestConcern } : {}),
    ...(d.watchFor ? { watchFor: d.watchFor } : {}),
    ...(d.providerNote ? { providerNote: d.providerNote } : {}),
    ...(d.mindShift ? { mindShift: d.mindShift } : {}),
    source: "model",
  };

  const beliefs: Belief[] | undefined = d.beliefs?.slice(0, 6).map((b) => ({ statement: b.statement, strength: b.strength, updatedAt: new Date().toISOString() }));
  const modelPlaybook: PlaybookEntry[] = (d.playbook ?? []).map((p) => ({ id: `pb_${slug(p.statement)}`, statement: p.statement, category: p.category, evidence: p.evidence, updatedAt: new Date().toISOString() }));
  const playbook = [...modelPlaybook, ...playbookFromExperiments(input.experiments, input.series)];
  const openQuestions = d.openQuestions?.length
    ? reconcileOpenQuestions(input.openQuestions ?? [], d.openQuestions.filter((q) => postGate(`${q.question} ${q.answer ?? ""}`).ok))
    : undefined;

  return { reasoning, beliefs, conclusions: d.conclusions, openQuestions, playbook };
}
