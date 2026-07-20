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
import { selectWeeklyFocus, reviewExperiment, currentWeekKey, detectEscalation, escalationReasoning, type ExperimentRecord } from "@/lib/focus";
import { computeSurprises, recordAssociations, type SurprisingFinding } from "@/lib/surprise";
import { updateHypotheses, deriveHabits } from "@/lib/hypotheses";
import { chooseIntervention, shouldProposeExperiment } from "@/lib/intervention";
import { goalMetricsForPath } from "@/lib/paths";
import { metricLabel } from "@/lib/metrics";
import type { PlanId } from "@/lib/billing/plans";
import type { AssociationSnapshot, Belief, Confidence, Habit, InterventionType, SignalId, MetricSeries, OpenQuestion, PlaybookEntry, RecentChange, TrackedHypothesis, WeeklyFocusReasoning } from "@/types";

const RANK: Record<Confidence, number> = { low: 0, moderate: 1, high: 2 };

export interface ReasoningInput {
  profile: {
    displayName?: string; path?: string; goals?: string[]; conditionLabel?: string;
    recoveryStage?: string; primaryChallenge?: string; occupation?: string;
    activityLevel?: string; lifestyle?: Record<string, string>; definitionOfBetter?: string;
    trajectory?: string; weeksTracked?: number;
  };
  series: MetricSeries[];
  recentChanges: RecentChange[];
  experiments: ExperimentRecord[];
  beliefs: Belief[];
  conclusions: string[];
  openQuestions?: OpenQuestion[];
  hypotheses?: TrackedHypothesis[];
  associationHistory?: AssociationSnapshot[];
  habits?: Habit[];
  notes: { prompt: string; answer: string }[];
  tier?: PlanId;
}

export interface ReasoningResult {
  reasoning: WeeklyFocusReasoning;
  beliefs?: Belief[];
  conclusions?: string[];
  openQuestions?: OpenQuestion[];
  playbook?: PlaybookEntry[];
  /** The evolving world-model of the user's working theories (the LOOP). */
  hypotheses?: TrackedHypothesis[];
  /** Rolling record of which relationships appeared this week (for recurrence). */
  associationHistory?: AssociationSnapshot[];
  /** Confirmed theories that have graduated into lasting habits. */
  habits?: Habit[];
}

function ceilingFor(series: MetricSeries[], metric: SignalId): Confidence {
  const s = series.find((x) => x.metric === metric);
  return s ? computeTrend(s).confidenceCeiling : "low";
}

/** Deterministic Playbook contribution: the user's experiment track record. */
function playbookFromExperiments(experiments: ExperimentRecord[], series: MetricSeries[]): PlaybookEntry[] {
  const wins = new Map<SignalId, number>();
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

function findingsFor(input: ReasoningInput): SurprisingFinding[] {
  const goals = goalMetricsForPath(input.profile.path);
  return computeSurprises(input.series, goals, input.associationHistory ?? [], 6);
}

function buildEvidence(input: ReasoningInput, findings: SurprisingFinding[]) {
  const trends = input.series.map((s) => {
    const t = computeTrend(s);
    return { metric: t.metric, n: t.n, latest: Math.round(t.latest), baseline: Math.round(t.baseline), delta: Math.round(t.delta), slopePerWeek: Number(t.slope.toFixed(2)), volatility: Math.round(t.volatility), confidenceCeiling: t.confidenceCeiling };
  });
  // Associations, RANKED BY SURPRISE — the model leads with the most non-obvious.
  const surprises = findings.map((f) => ({
    kind: f.association.kind, metrics: f.association.metrics, r: f.association.r, n: f.association.n,
    confidence: f.association.confidence, plain: f.association.plain,
    surprise: Number(f.surprise.toFixed(2)), whySurprising: f.whySurprising, recurrence: f.recurrenceLabel,
  }));
  // The theories we already hold — so the model REVISES them, not restarts.
  const currentTheories = (input.hypotheses ?? []).map((h) => ({
    statement: h.statement, status: h.status, confidence: h.confidence,
    supporting: h.supportingObservations, contradicting: h.contradictingObservations,
    prediction: h.prediction,
  }));
  const pastExperiments = input.experiments.slice(-6).map((e) => {
    const r = reviewExperiment(e, input.series);
    return { weekKey: e.weekKey, focus: e.title, behavior: e.behavior, metric: e.metric, baseline: e.baseline, outcome: r.outcome, result: r.result, verdict: r.headline };
  });
  const currentHabits = (input.habits ?? []).map((h) => ({ statement: h.statement, status: h.status, reinforcements: h.reinforcements }));
  // The engine's read on what KIND of help this week calls for, and whether an
  // experiment is even warranted. The model should treat these as strong guidance:
  // most weeks are NOT experiment weeks.
  const gate = shouldProposeExperiment({ weeksTracked: input.profile.weeksTracked, experiments: input.experiments, hypotheses: input.hypotheses, openQuestions: input.openQuestions });
  const suggestedIntervention = chooseIntervention({ weeksTracked: input.profile.weeksTracked, recentChanges: input.recentChanges, findings, hypotheses: input.hypotheses, experiments: input.experiments, openQuestions: input.openQuestions });
  return {
    profile: input.profile,
    weekKey: currentWeekKey(),
    thisWeekChanges: input.recentChanges.map((c) => ({ metric: c.metric, label: c.label, delta: c.deltaNorm, improving: c.improving })),
    trends,
    surprises,
    currentTheories,
    currentHabits,
    experimentWarranted: gate.propose,
    experimentGateRationale: gate.rationale,
    suggestedIntervention,
    pastExperiments,
    currentBeliefs: input.beliefs,
    priorConclusions: input.conclusions.slice(-15),
    openQuestions: (input.openQuestions ?? []).filter((q) => q.status === "open").slice(-5).map((q) => ({ question: q.question, whyItMatters: q.whyItMatters })),
    recentNotes: input.notes.slice(-6),
  };
}

/** The LOOP's memory: revise tracked theories against this week's findings and
 * experiment outcomes, and append this week's relationships to the history. Runs in
 * BOTH the model and fallback paths — code owns the counts, the model owns the words. */
function loopState(input: ReasoningInput, findings: SurprisingFinding[]): { hypotheses: TrackedHypothesis[]; associationHistory: AssociationSnapshot[]; habits: Habit[] } {
  const weekKey = currentWeekKey();
  const reviews = input.experiments.slice(-6).map((e) => reviewExperiment(e, input.series));
  const { hypotheses } = updateHypotheses(input.hypotheses ?? [], findings, reviews, weekKey);
  const associationHistory = recordAssociations(input.associationHistory ?? [], weekKey, findings.map((f) => f.association));
  const habits = deriveHabits(input.habits ?? [], hypotheses, reviews, weekKey);
  return { hypotheses, associationHistory, habits };
}

/** A deterministic surprise line from the top surface-ready finding (fallback path). */
function fallbackSurprise(findings: SurprisingFinding[]): WeeklyFocusReasoning["surprise"] | undefined {
  const f = findings.find((x) => x.readyToSurface) ?? findings[0];
  if (!f) return undefined;
  return {
    observation: f.association.plain,
    whyNonObvious: f.association.kind === "lag"
      ? "It's a next-day effect — a dashboard shows today's numbers, not how one day sets up the next."
      : f.association.kind === "contrast"
      ? "It only shows up when you compare your best days against your toughest ones over time."
      : "It only emerges from watching how two of your signals move together across weeks.",
    confidence: f.association.confidence,
    recurrence: f.recurrenceLabel,
  };
}

function fallbackReasoning(input: ReasoningInput, findings: SurprisingFinding[]): ReasoningResult {
  const playbook = playbookFromExperiments(input.experiments, input.series);
  const loop = loopState(input, findings);
  const surprise = fallbackSurprise(findings);
  const intervention = chooseIntervention({ weeksTracked: input.profile.weeksTracked, recentChanges: input.recentChanges, findings, hypotheses: input.hypotheses, experiments: input.experiments, openQuestions: input.openQuestions });
  const gate = shouldProposeExperiment({ weeksTracked: input.profile.weeksTracked, experiments: input.experiments, hypotheses: input.hypotheses, openQuestions: input.openQuestions });
  const includeExperiment = intervention.type === "experiment" && gate.propose;
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
        interventionType: "observe",
        biggestWin: "You started — that's the hardest part.",
        biggestConcern: "I simply don't know you well enough yet; a week of check-ins fixes that.",
        watchFor: "Just aim for a check-in most days this week.",
        ...(surprise ? { surprise } : {}),
        source: "fallback",
      },
      playbook,
      ...loop,
    };
  }
  return {
    reasoning: {
      weekKey: f.weekKey, metric: f.metric, title: f.title, action: f.focusAction,
      why: f.why, whyItMatters: f.whyItMatters, measure: f.measure, confidence: f.confidence,
      reasoningSummary: `Working from your recent data, ${metricLabel(f.metric).toLowerCase()} is where the most meaningful movement is, so I'm making it this week's focus. As more check-ins come in I'll weigh competing explanations more explicitly.`,
      hypotheses: [{ explanation: `${f.title}.`, support: f.whatChanged, confidence: f.confidence }],
      ...(includeExperiment ? { experiment: { hypothesis: f.experiment.hypothesis, behavior: f.experiment.behavior, expectedOutcome: f.experiment.expectedOutcome, followUp: f.experiment.followUp } } : {}),
      interventionType: intervention.type,
      biggestWin: win ? `Your ${win.label.toLowerCase()} moved the right way.` : "You kept showing up — consistency is its own win.",
      biggestConcern: concern ? `Your ${concern.label.toLowerCase()} slipped a little — worth a gentle eye.` : "Nothing's flashing red this week.",
      watchFor: `Notice how your ${metricLabel(f.metric).toLowerCase()} responds as you try this week's focus.`,
      ...(surprise ? { surprise } : {}),
      source: "fallback",
    },
    playbook,
    ...loop,
  };
}

export async function generateReasoning(input: ReasoningInput): Promise<ReasoningResult> {
  // Safety first, and never left to the model: if a monitored trend keeps
  // worsening, step back from coaching and urge a provider conversation.
  // This week's surprise-ranked findings drive BOTH the evidence the model sees
  // and the deterministic theory-revision (the loop's memory).
  const findings = findingsFor(input);
  const loop = loopState(input, findings);

  const esc = detectEscalation(input.series, input.profile.path ?? "general");
  if (esc) return { reasoning: escalationReasoning(esc), playbook: playbookFromExperiments(input.experiments, input.series), ...loop };

  const tier = input.tier ?? "pro";
  const maxTokens = tier === "max" ? 3600 : tier === "free" ? 2000 : 2800;
  const evidence = buildEvidence(input, findings);
  const raw = await callModel({ system: REASONING_PROMPT.system, user: JSON.stringify(evidence), maxTokens });
  if (!raw) return fallbackReasoning(input, findings);

  const parsed = reasoningSchema.safeParse(extractJson(raw));
  if (!parsed.success) return fallbackReasoning(input, findings);
  const d = parsed.data;

  const texts = [d.reasoningSummary, d.focus.action, d.focus.why, d.focus.whyItMatters, d.challenge ?? "", d.biggestWin ?? "", d.biggestConcern ?? "", d.watchFor ?? "", d.providerNote ?? "", d.mindShift ?? "", d.surprise?.observation ?? "", ...d.hypotheses.map((h) => `${h.explanation} ${h.support}`)];
  if (texts.some((t) => t && !postGate(t).ok)) return fallbackReasoning(input, findings);

  const ceiling = ceilingFor(input.series, d.focus.metric);
  const confidence: Confidence = RANK[d.focus.confidence] > RANK[ceiling] ? ceiling : d.focus.confidence;

  // Experiments are rare and gated: honor the model's intervention choice, but only
  // actually attach an experiment when the deterministic gate agrees it's warranted.
  const gate = shouldProposeExperiment({ weeksTracked: input.profile.weeksTracked, experiments: input.experiments, hypotheses: input.hypotheses, openQuestions: input.openQuestions });
  const intervention: InterventionType = d.interventionType ?? chooseIntervention({ weeksTracked: input.profile.weeksTracked, recentChanges: input.recentChanges, findings, hypotheses: input.hypotheses, experiments: input.experiments, openQuestions: input.openQuestions }).type;
  const includeExperiment = intervention === "experiment" && gate.propose && !!d.experiment;

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
    ...(includeExperiment && d.experiment ? { experiment: d.experiment } : {}),
    interventionType: intervention,
    ...(d.challenge ? { challenge: d.challenge } : {}),
    ...(d.biggestWin ? { biggestWin: d.biggestWin } : {}),
    ...(d.biggestConcern ? { biggestConcern: d.biggestConcern } : {}),
    ...(d.watchFor ? { watchFor: d.watchFor } : {}),
    ...(d.providerNote ? { providerNote: d.providerNote } : {}),
    ...(d.mindShift ? { mindShift: d.mindShift } : {}),
    // Always carry a surprise: the model's if it produced one, else the strongest
    // deterministic finding — the product must never skip the "I never realized that".
    ...((d.surprise ?? fallbackSurprise(findings)) ? { surprise: d.surprise ?? fallbackSurprise(findings) } : {}),
    source: "model",
  };

  const beliefs: Belief[] | undefined = d.beliefs?.slice(0, 6).map((b) => ({ statement: b.statement, strength: b.strength, updatedAt: new Date().toISOString() }));
  const modelPlaybook: PlaybookEntry[] = (d.playbook ?? []).map((p) => ({ id: `pb_${slug(p.statement)}`, statement: p.statement, category: p.category, evidence: p.evidence, updatedAt: new Date().toISOString() }));
  const playbook = [...modelPlaybook, ...playbookFromExperiments(input.experiments, input.series)];
  const openQuestions = d.openQuestions?.length
    ? reconcileOpenQuestions(input.openQuestions ?? [], d.openQuestions.filter((q) => postGate(`${q.question} ${q.answer ?? ""}`).ok))
    : undefined;

  return { reasoning, beliefs, conclusions: d.conclusions, openQuestions, playbook, ...loop };
}
