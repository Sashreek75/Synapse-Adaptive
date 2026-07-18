/**
 * THE HYPOTHESIS LIFECYCLE — where discovery becomes a LOOP, not a summary.
 *
 * Synapse doesn't stop at "I noticed a pattern." It forms a theory, proposes ONE
 * small experiment to test it, watches the outcome, and then REVISES the theory —
 * strengthening it, weakening it, or admitting it was wrong. That revision is the
 * most trust-building thing the product does ("I've changed my mind").
 *
 *   notice → explain → suggest ONE experiment → observe outcome → update theory → repeat
 *
 * The implementation is scientific (evidence counts, confidence ceilings). The
 * language shown to the user is warm and collaborative (see THEORY_LABELS). All
 * deterministic, so the loop keeps turning even with no AI key.
 */

import { metricLabel, METRIC_META } from "@/lib/metrics";
import type { ExperimentReview } from "@/lib/focus";
import { associationKey, type SurprisingFinding } from "@/lib/surprise";
import type { Confidence, Habit, HypothesisStatus, MetricKey, TrackedHypothesis } from "@/types";

/** Warm, user-facing section names. The user never sees the word "hypothesis". */
export const THEORY_LABELS: Record<HypothesisStatus, string> = {
  forming: "Things we're figuring out",
  testing: "Things I'm testing right now",
  supported: "What I'm learning about you",
  confirmed: "What I've learned about you",
  weakened: "Theories I'm rethinking",
  rejected: "Things I was wrong about",
  dormant: "On the back burner",
};

const RANK: Record<Confidence, number> = { low: 0, moderate: 1, high: 2 };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);

/** Turn an association into a warm, first-person theory + a testable prediction
 * + the smallest experiment that would settle it. */
function phrasing(f: SurprisingFinding): { statement: string; prediction: string; experiment: string } {
  const a = f.association;
  const [m0, m1] = a.metrics;
  const l0 = metricLabel(m0).toLowerCase();
  const l1 = metricLabel(m1).toLowerCase();

  if (a.kind === "lag") {
    // m0 today tends to predict m1 tomorrow
    const better0 = METRIC_META[m0].direction === "higher_is_better";
    const lever = better0 ? `protecting your ${l0}` : `easing your ${l0}`;
    return {
      statement: `I'm starting to think your ${l0} on one day steers your ${l1} the next — like it runs a day ahead.`,
      prediction: `If that's real, a better ${l0} day should show up as a better ${l1} day tomorrow.`,
      experiment: `For the next few days, let's focus on ${lever} and watch what your ${l1} does the following day.`,
    };
  }
  if (a.kind === "contrast") {
    return {
      statement: `I think your ${l1} might be the hidden thing that separates your best days from your toughest ones.`,
      prediction: `If so, deliberately nudging your ${l1} should lift the kind of day you have.`,
      experiment: `Let's pick a few days to intentionally work on your ${l1} and see whether the whole day feels different.`,
    };
  }
  return {
    statement: `I'm noticing your ${l0} and your ${l1} tend to move together — I want to understand why.`,
    prediction: `If they're really linked, moving one should move the other.`,
    experiment: `Let's put some attention on your ${l0} for a few days and watch whether your ${l1} follows.`,
  };
}

export function hypothesisFromFinding(f: SurprisingFinding, weekKey: string, now = new Date().toISOString()): TrackedHypothesis {
  const p = phrasing(f);
  return {
    id: `hyp_${slug(p.statement)}`,
    statement: p.statement,
    metrics: f.association.metrics,
    status: "forming",
    confidence: f.association.confidence,
    supportingObservations: 1,
    contradictingObservations: 0,
    firstFormedAt: now,
    updatedAt: now,
    prediction: p.prediction,
    suggestedExperiment: p.experiment,
    originAssociationKey: f.key,
    evidenceLog: [{ weekKey, direction: "support", note: `First seen — ${f.whySurprising}.` }],
  };
}

/** Confidence from the evidence balance, never exceeding the data ceiling. */
export function confidenceFromEvidence(support: number, contradict: number, ceiling: Confidence): Confidence {
  const net = support - contradict;
  // High confidence demands sustained support AND a clean record. Any live
  // contradiction caps us at moderate. And we NEVER exceed the data's own
  // statistical ceiling (from the FDR-controlled correlation), so a theory can't
  // sound more certain than the numbers underneath it support.
  let c: Confidence = net >= 4 && contradict === 0 ? "high" : net >= 2 ? "moderate" : "low";
  if (contradict > 0 && c === "high") c = "moderate";
  if (RANK[c] > RANK[ceiling]) c = ceiling;
  return c;
}

export interface HypothesisMovement {
  id: string;
  statement: string;
  status: HypothesisStatus;
  movement: "formed" | "strengthened" | "weakened" | "confirmed" | "rejected" | "unchanged";
  inPlainWords: string;
}

export interface HypothesisUpdate { hypotheses: TrackedHypothesis[]; movements: HypothesisMovement[] }

function decideStatus(h: { supportingObservations: number; contradictingObservations: number }, opts: { recurrence: number; testingNow: boolean; gotEvidenceThisWeek: boolean; weeksSinceEvidence: number; confidence: Confidence }): HypothesisStatus {
  const { supportingObservations: sup, contradictingObservations: con } = h;
  // Demote fast — contradictions protect trust more than confirmations build it.
  if (con >= 3 || (con >= 2 && con > sup)) return "rejected";
  if (con > sup) return "weakened";
  if (opts.testingNow) return "testing";
  // Promote slowly: confirmation needs sustained CLEAN support, genuine recurrence,
  // AND a statistically solid underlying relationship (high ceiling). This is what
  // earns Synapse the right to say "I found something" and be believed.
  if (sup >= 4 && con === 0 && opts.recurrence >= 3 && opts.confidence === "high") return "confirmed";
  if (sup >= 2 && sup > con) return "supported";
  if (!opts.gotEvidenceThisWeek && opts.weeksSinceEvidence >= 3) return "dormant";
  return "forming";
}

/**
 * The weekly revision pass. Given the theories we already hold, this week's
 * surprising findings, and the outcomes of experiments we've been running,
 * update each theory's evidence, confidence, and status — and record the
 * MOVEMENT so Synapse can say "I've changed my mind" out loud.
 */
export function updateHypotheses(
  existing: TrackedHypothesis[],
  findings: SurprisingFinding[],
  reviews: ExperimentReview[],
  weekKey: string,
  now = new Date().toISOString(),
): HypothesisUpdate {
  const byKey = new Map(findings.map((f) => [f.key, f]));
  const movements: HypothesisMovement[] = [];
  const out: TrackedHypothesis[] = [];
  const claimed = new Set<string>();

  for (const h of existing) {
    let support = h.supportingObservations;
    let contradict = h.contradictingObservations;
    const log = [...h.evidenceLog];
    let gotEvidence = false;
    let ceiling: Confidence = h.confidence;

    // 1) Does the originating relationship still hold this week?
    const f = h.originAssociationKey ? byKey.get(h.originAssociationKey) : undefined;
    if (f) {
      claimed.add(f.key);
      ceiling = f.association.confidence;
      if (f.flipped) { contradict++; log.push({ weekKey, direction: "contradict", note: "The relationship reversed direction this week." }); }
      else { support++; log.push({ weekKey, direction: "support", note: `Still holding — ${f.recurrenceLabel}.` }); }
      gotEvidence = true;
    }

    // 2) Did an experiment we ran on these metrics settle anything? This is the
    //    behavior-change half of the loop feeding back into the theory.
    for (const r of reviews) {
      if (r.record.weekKey !== weekKey) continue;
      if (!h.metrics.includes(r.record.metric)) continue;
      if (r.outcome === "worked" || r.outcome === "partial") { support++; log.push({ weekKey, direction: "support", note: `An experiment on your ${metricLabel(r.record.metric).toLowerCase()} moved the right way.` }); gotEvidence = true; }
      else if (r.outcome === "regressed" || r.outcome === "no_change") { contradict++; log.push({ weekKey, direction: "contradict", note: `An experiment on your ${metricLabel(r.record.metric).toLowerCase()} didn't pan out.` }); gotEvidence = true; }
    }

    const testingNow = reviews.some((r) => r.record.weekKey === weekKey && h.metrics.includes(r.record.metric) && r.outcome === "inconclusive");
    const weeksSinceEvidence = gotEvidence ? 0 : (h.status === "dormant" ? 4 : (log.length ? 1 : 0) + 1);
    const prevStatus = h.status;
    const confidence = confidenceFromEvidence(support, contradict, ceiling);
    const status = decideStatus({ supportingObservations: support, contradictingObservations: contradict }, {
      recurrence: f?.recurrence ?? 0, testingNow, gotEvidenceThisWeek: gotEvidence, weeksSinceEvidence, confidence,
    });

    const updated: TrackedHypothesis = {
      ...h, supportingObservations: support, contradictingObservations: contradict,
      status, confidence, updatedAt: now, evidenceLog: log.slice(-12),
    };
    out.push(updated);

    if (status !== prevStatus) {
      const movement: HypothesisMovement["movement"] =
        status === "confirmed" ? "confirmed" :
        status === "rejected" ? "rejected" :
        status === "weakened" ? "weakened" :
        (status === "supported" || status === "testing") ? "strengthened" : "unchanged";
      movements.push({ id: updated.id, statement: updated.statement, status, movement, inPlainWords: mindShiftLine(updated, prevStatus) });
    }
  }

  // 3) Form new theories from this week's strongest, surface-ready surprises that
  //    we're not already tracking. Cap new ones so we stay focused.
  let added = 0;
  for (const f of findings) {
    if (added >= 2) break;
    if (claimed.has(f.key)) continue;
    if (out.some((h) => h.originAssociationKey === f.key)) continue;
    if (!f.readyToSurface) continue; // one-week flukes stay as tentative, not tracked theories
    const h = hypothesisFromFinding(f, weekKey, now);
    out.push(h);
    movements.push({ id: h.id, statement: h.statement, status: "forming", movement: "formed", inPlainWords: `New theory forming: ${h.statement}` });
    added++;
  }

  // Keep the working set focused; drop the least-active dormant theories first.
  const ordered = out
    .sort((a, b) => statusWeight(b.status) - statusWeight(a.status) || (b.updatedAt > a.updatedAt ? 1 : -1))
    .slice(0, 10);

  return { hypotheses: ordered, movements };
}

function statusWeight(s: HypothesisStatus): number {
  return { confirmed: 6, supported: 5, testing: 4, weakened: 3, forming: 2, rejected: 1, dormant: 0 }[s];
}

function mindShiftLine(h: TrackedHypothesis, prev: HypothesisStatus): string {
  const s = h.statement.replace(/^I'm (starting to think|noticing)\s*/i, "").replace(/\.$/, "");
  switch (h.status) {
    case "confirmed": return `I'm now confident about something: ${s}. It's held up long enough that I trust it.`;
    case "rejected": return `I've changed my mind — I no longer think ${s.toLowerCase()}. The evidence didn't hold up, and that's worth knowing.`;
    case "weakened": return `I'm rethinking one of my theories: ${s}. New data is pushing back on it.`;
    case "supported": return `A theory is getting stronger: ${s}.`;
    case "testing": return `I'm actively testing whether ${s.toLowerCase()}.`;
    default: return `Update on a theory (${prev} → ${h.status}): ${s}.`;
  }
}

/**
 * HABIT GRADUATION — the end of the loop. A theory that (1) has been CONFIRMED and
 * (2) has at least one experiment that actually worked becomes a lasting habit. This
 * is where the product stops being clever and starts being useful: a discovery the
 * user has turned into a durable behavior with measurable payoff. Idempotent.
 */
export function deriveHabits(
  existing: Habit[],
  hypotheses: TrackedHypothesis[],
  reviews: ExperimentReview[],
  weekKey: string,
  now = new Date().toISOString(),
): Habit[] {
  const byId = new Map(existing.map((h) => [h.id, h]));
  const out = new Map(existing.map((h) => [h.id, { ...h }]));

  for (const hyp of hypotheses) {
    if (hyp.status !== "confirmed") continue;
    const successes = reviews.filter((r) => hyp.metrics.includes(r.record.metric) && (r.outcome === "worked" || r.outcome === "partial")).length;
    if (successes < 1) continue; // a habit must be earned by an experiment that WORKED
    const regressedNow = reviews.some((r) => r.record.weekKey === weekKey && hyp.metrics.includes(r.record.metric) && r.outcome === "regressed");
    const id = `habit_${hyp.id}`;
    const prev = byId.get(id);
    const status: Habit["status"] = regressedNow ? "lapsed" : successes >= 2 ? "established" : "building";
    out.set(id, {
      id,
      statement: behaviorToHabit(hyp),
      metric: hyp.metrics[0],
      fromHypothesisId: hyp.id,
      status,
      reinforcements: successes,
      establishedAt: prev?.establishedAt ?? now,
      updatedAt: now,
    });
  }
  // Lapse any established habit whose theory has since been weakened/rejected.
  for (const h of out.values()) {
    const hyp = hypotheses.find((x) => x.id === h.fromHypothesisId);
    if (hyp && (hyp.status === "rejected" || hyp.status === "weakened") && h.status !== "lapsed") {
      out.set(h.id, { ...h, status: "lapsed", updatedAt: now });
    }
  }
  return [...out.values()].slice(-12);
}

function behaviorToHabit(h: TrackedHypothesis): string {
  const b = h.suggestedExperiment?.replace(/^For the next[^,]*,\s*/i, "").replace(/^Let's\s*/i, "").trim();
  const lead = b ? b.charAt(0).toUpperCase() + b.slice(1) : h.statement;
  return `${lead}`.replace(/\s+and watch[^.]*\.?$/i, "").replace(/\.$/, "") + " — it's paid off enough to keep.";
}

/**
 * The CURIOSITY OPENER — Synapse begins the week, rather than waiting to be asked.
 * Picks the single most compelling thing to open with, in warm first-person voice.
 * Returns null when there's genuinely nothing worth interrupting the user for.
 */
export function curiosityOpener(
  movements: HypothesisMovement[],
  findings: SurprisingFinding[],
  reviews: ExperimentReview[],
  weekKey: string,
): { kind: string; headline: string; body: string } | null {
  // 1) A mind change is the most valuable thing we can lead with.
  const changed = movements.find((m) => m.movement === "confirmed" || m.movement === "rejected");
  if (changed) {
    return {
      kind: changed.movement === "rejected" ? "changed_mind" : "confirmed",
      headline: changed.movement === "rejected" ? "I've changed my mind." : "I'm becoming much more confident.",
      body: changed.inPlainWords,
    };
  }
  // 2) A finished experiment — a real outcome from something we tried together.
  const settled = reviews.find((r) => r.record.weekKey === weekKey && (r.outcome === "worked" || r.outcome === "regressed"));
  if (settled) {
    return {
      kind: "experiment_result",
      headline: settled.outcome === "worked" ? "Our experiment worked." : "Our experiment didn't pan out — and that's useful.",
      body: `${settled.headline} ${settled.nextStep}`,
    };
  }
  // 3) A brand-new, non-obvious discovery.
  const discovery = findings.find((f) => f.isNew && f.readyToSurface);
  if (discovery) {
    return { kind: "discovery", headline: "I noticed something.", body: discovery.association.plain };
  }
  // 4) A theory just forming — an honest "I want to test an idea."
  const forming = movements.find((m) => m.movement === "formed");
  if (forming) {
    return { kind: "new_theory", headline: "I want to test an idea.", body: forming.statement };
  }
  return null;
}
