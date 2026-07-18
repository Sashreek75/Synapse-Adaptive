/**
 * THE INTERVENTION SELECTOR — "the right help at the right moment."
 *
 * Synapse is NOT an experiment machine. A good coach mostly notices, reassures,
 * explains, encourages, or offers one small nudge — and only occasionally, when
 * new evidence would genuinely sharpen understanding, proposes an experiment.
 * This module decides which of those a given week/moment calls for, and gates
 * experiments hard so they stay intentional (≈ once every week or two, not every
 * conversation). All deterministic, so the offline path is just as thoughtful.
 */

import { currentWeekKey, type ExperimentRecord } from "@/lib/focus";
import type { Confidence, InterventionType, MetricKey, OpenQuestion, RecentChange, TrackedHypothesis } from "@/types";
import type { SurprisingFinding } from "@/lib/surprise";

const DAY = 864e5;

export interface ExperimentGate {
  propose: boolean;
  target?: string;   // what the experiment would resolve
  rationale: string; // why (or why not) now
}

/**
 * Should Synapse propose an experiment THIS week? Only when an experiment would
 * actually reduce uncertainty that matters — never as a routine. Conditions:
 *  - enough history to run a clean test,
 *  - no experiment already running,
 *  - a cool-down since the last one (so they don't stack up),
 *  - AND a real, reducible unknown: an open question, or a theory that's promising
 *    but not yet confirmed (confidence "moderate" — exactly where a test helps most).
 */
export function shouldProposeExperiment(input: {
  weeksTracked?: number;
  experiments: ExperimentRecord[];
  hypotheses?: TrackedHypothesis[];
  openQuestions?: OpenQuestion[];
  now?: Date;
}): ExperimentGate {
  const now = input.now ?? new Date();
  const wk = currentWeekKey(now);

  if ((input.weeksTracked ?? 0) < 2) return { propose: false, rationale: "Too little history yet — this week is for gathering a clean baseline, not testing." };

  if (input.experiments.some((e) => e.weekKey === wk)) return { propose: false, rationale: "An experiment is already running this week — let it finish before starting another." };

  const lastStart = input.experiments.reduce<number>((mx, e) => Math.max(mx, Date.parse(e.startedAt) || 0), 0);
  if (lastStart && now.getTime() - lastStart < 10 * DAY) return { propose: false, rationale: "We ran one recently — experiments should breathe, not stack up. Give this one time to teach us something." };

  // A reducible unknown worth a test: an open question, or a promising-but-unproven theory.
  const openQ = (input.openQuestions ?? []).find((q) => q.status === "open");
  const testable = (input.hypotheses ?? []).find((h) => (h.status === "forming" || h.status === "supported") && h.confidence === "moderate");
  if (openQ) return { propose: true, target: openQ.question, rationale: "There's an open question a small test could actually answer." };
  if (testable) return { propose: true, target: testable.statement, rationale: "A promising theory is sitting at the confidence level where one clean test would settle it." };

  return { propose: false, rationale: "Nothing right now needs testing — the honest move is to keep watching, not to invent homework." };
}

/** Recommendation language must match the strength of the evidence — never overclaim. */
export function strengthPhrase(confidence: Confidence, opts?: { habit?: boolean }): string {
  if (opts?.habit) return "it's worth making this a habit";
  return confidence === "high" ? "I'm becoming fairly confident that"
    : confidence === "moderate" ? "I think"
    : "I'm wondering if";
}

export interface InterventionChoice { type: InterventionType; rationale: string }

/**
 * Choose the kind of help this moment calls for. Priority reflects a good coach's
 * instincts: safety and thin-data first, celebrate real wins, address real dips
 * gently, share a genuine discovery, propose a test only when it's truly earned,
 * and otherwise simply reassure or notice. Experiments are near the BOTTOM on
 * purpose — they're the exception, not the default.
 */
export function chooseIntervention(input: {
  weeksTracked?: number;
  recentChanges: RecentChange[];
  findings: SurprisingFinding[];
  hypotheses?: TrackedHypothesis[];
  experiments: ExperimentRecord[];
  openQuestions?: OpenQuestion[];
  hasStressContext?: boolean; // e.g. user mentioned heavy workload — dips may be explainable
  now?: Date;
}): InterventionChoice {
  if ((input.weeksTracked ?? 0) < 2) return { type: "observe", rationale: "Still getting to know them — notice and gather, don't prescribe." };

  const improving = input.recentChanges.filter((c) => c.improving);
  const declines = input.recentChanges.filter((c) => !c.improving);
  const bigDecline = declines.find((c) => Math.abs(c.deltaNorm) >= 10);
  const readySurprise = input.findings.find((f) => f.readyToSurface && (f.isNew || f.flipped));

  // A meaningful, unexplained dip deserves a gentle, concrete suggestion — unless the
  // person's own context already explains it, in which case reassurance beats advice.
  if (bigDecline && !input.hasStressContext) return { type: "advise", rationale: `A real dip in ${bigDecline.label.toLowerCase()} — offer one small, concrete step.` };
  if (bigDecline && input.hasStressContext) return { type: "reassure", rationale: "The dip lines up with what they told me is going on — reassure and normalize, don't optimize." };

  // A genuinely new, trustworthy discovery is worth sharing even without a test.
  if (readySurprise) return { type: "explain", rationale: "There's a real, non-obvious pattern worth showing them — explain it plainly." };

  // Only now consider an experiment, and only if the gate truly warrants one.
  const gate = shouldProposeExperiment(input);
  if (gate.propose) return { type: "experiment", rationale: gate.rationale };

  if (improving.length && !declines.length) return { type: "encourage", rationale: "Things are moving the right way — name it and reinforce it." };

  const openQ = (input.openQuestions ?? []).some((q) => q.status === "open");
  if (openQ) return { type: "ask", rationale: "A gentle question would sharpen my understanding more than any advice right now." };

  return { type: "reassure", rationale: "Steady week — sometimes the most useful thing is to say so, plainly." };
}
