/**
 * THE PERSON MODEL — Synapse's evolving mental model of a human.
 *
 * Not a data container: a MIND. It is organized by epistemic state — what Synapse
 * KNOWS, what it BELIEVES, what it's QUESTIONING, what it's still WONDERING about,
 * what it TRUSTS, and what the person is COMMITTED to. These are derived VIEWS over
 * the persisted substrate (beliefs, hypotheses, habits, open questions, trajectory),
 * so there is nothing new to store and nothing to migrate — the certainty a fact
 * carries is expressed by WHERE it lands, exactly like a real understanding of a person.
 */

import type { PersonModel, TrackedHypothesis, Habit, OpenQuestion, Belief, Trajectory, Identity } from "@/types";
import type { ExperimentRecord } from "@/lib/focus";

export interface EpistemicView {
  /** Established: who they're becoming, their goals, and things Synapse has concluded. */
  knows: { trajectory: Trajectory | null; goals: string[]; conclusions: string[] };
  /** Current best theories, held with confidence — supported + confirmed. */
  believes: { beliefs: Belief[]; theories: TrackedHypothesis[] };
  /** Theories under doubt — the "I'm rethinking / I was wrong" set. */
  questioning: TrackedHypothesis[];
  /** Honest unknowns Synapse is actively trying to answer. */
  wondering: OpenQuestion[];
  /** Proven and durable — habits that have taken hold. */
  trusts: Habit[];
  /** What the person is actively doing about it right now. */
  committed: { habitsBuilding: Habit[]; experiments: ExperimentRecord[] };
}

const BELIEVED = new Set(["supported", "confirmed"]);
const DOUBTED = new Set(["weakened", "rejected"]);

/** Project the substrate into epistemic states. `goals` come from the profile
 * (identity lives there), passed in so this stays a pure function of inputs. */
export function epistemicView(
  pm: PersonModel,
  opts: { goals?: string[]; experiments?: ExperimentRecord[] } = {},
): EpistemicView {
  const hypotheses = pm.hypotheses ?? [];
  const habits = pm.habits ?? [];
  return {
    knows: {
      trajectory: pm.trajectory ?? null,
      goals: opts.goals ?? [],
      conclusions: pm.conclusions ?? [],
    },
    believes: {
      beliefs: pm.beliefs ?? [],
      theories: hypotheses.filter((h) => BELIEVED.has(h.status)),
    },
    questioning: hypotheses.filter((h) => DOUBTED.has(h.status)),
    wondering: (pm.openQuestions ?? []).filter((q) => q.status === "open"),
    trusts: habits.filter((h) => h.status === "established"),
    committed: {
      habitsBuilding: habits.filter((h) => h.status === "building"),
      experiments: opts.experiments ?? [],
    },
  };
}

/** One-line summary of how well Synapse understands this person right now —
 * used to communicate growth honestly ("still forming a picture" → "I know you well"). */
export function understandingDepth(pm: PersonModel): "forming" | "developing" | "strong" {
  const confirmed = (pm.hypotheses ?? []).filter((h) => h.status === "confirmed").length;
  const believed = (pm.hypotheses ?? []).filter((h) => BELIEVED.has(h.status)).length;
  if (confirmed >= 2) return "strong";
  if (believed >= 1 || (pm.beliefs ?? []).length >= 1) return "developing";
  return "forming";
}


/* ═══════════════════════════════════════════════════════════════════════════
 * THE PERSON MODEL AS THE CENTER OF THE ENGINE.
 *
 * The manifesto: everything else exists to improve this model. Signals, statistics,
 * and evidence are inputs; the point is a continuously-updated understanding of ONE
 * evolving human. These derivations answer the questions the engine actually cares
 * about — who they are becoming, what is becoming reliable, what is still uncertain,
 * what Synapse has changed its mind about, where momentum is building, where they are
 * drifting, and the single move most worth making next. Every one of them is allowed
 * to honestly return "nothing yet": the model never manufactures understanding it has
 * not earned. All derived, nothing new to store.
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface TrajectoryView {
  /** The identity carrying the most weight right now. */
  primary: Identity | null;
  /** Every identity the person is building, most-central first. */
  identities: Identity[];
  /** True when they are actively building more than one identity at once. */
  multiple: boolean;
}

/** A person is not one arrow. Read the several identities they are building, ordered by
 * how central each is right now. Falls back to synthesizing a single identity from the
 * legacy `statement` so older data still reads correctly. */
export function trajectoryView(pm: PersonModel): TrajectoryView {
  const t = pm.trajectory;
  if (!t) return { primary: null, identities: [], multiple: false };
  let ids = [...(t.identities ?? [])].sort((a, b) => b.priority - a.priority);
  if (!ids.length && t.statement) {
    ids = [{ id: "primary", label: t.statement, statement: t.statement, priority: 1, status: "active", why: t.why, updatedAt: t.updatedAt }];
  }
  return { primary: ids[0] ?? null, identities: ids, multiple: ids.length > 1 };
}

export interface PersonSnapshot {
  /** Who they are trying to become (possibly several identities at once). */
  becoming: TrajectoryView;
  /** What they are actively doing about it right now. */
  commitments: { building: Habit[]; experimentsActive: number };
  /** Behaviors that have become reliable — the proven, durable wins. */
  reliable: Habit[];
  /** What is still uncertain and being worked out — held honestly, not asserted. */
  uncertain: { patterns: TrackedHypothesis[]; questions: OpenQuestion[] };
  /** Things Synapse concluded and then revised — "I was wrong / I've rethought that". */
  changedMind: string[];
  /** Where momentum is increasing. */
  momentum: string[];
  /** Where the person is slipping or a theory is weakening. */
  drifting: string[];
  /** The single move most likely to help long-term — or null when it is honestly too
   * early to say (the engine says "I don't know yet" rather than inventing advice). */
  highestLeverage: { move: string; rationale: string } | null;
}

const netSupport = (h: TrackedHypothesis) => h.supportingObservations - h.contradictingObservations;

/** The engine's read of the whole person, assembled from the substrate. Pure. */
export function personSnapshot(
  pm: PersonModel,
  opts: { experimentsActive?: number } = {},
): PersonSnapshot {
  const hyp = pm.hypotheses ?? [];
  const habits = pm.habits ?? [];
  const becoming = trajectoryView(pm);

  const reliable = habits.filter((h) => h.status === "established");
  const building = habits.filter((h) => h.status === "building");

  // Momentum: durable habits taking hold + theories gaining clean support.
  const momentum: string[] = [];
  for (const h of reliable) momentum.push(`"${h.statement}" has held up (${h.reinforcements}x reconfirmed).`);
  for (const h of building.filter((b) => b.reinforcements >= 2)) momentum.push(`"${h.statement}" is starting to stick.`);
  for (const h of hyp.filter((x) => (x.status === "supported" || x.status === "confirmed") && netSupport(x) >= 2))
    momentum.push(`Growing confidence: ${h.statement}`);

  // Drift: habits lapsing + theories weakening under contradiction.
  const drifting: string[] = [];
  for (const h of habits.filter((x) => x.status === "lapsed")) drifting.push(`"${h.statement}" has lapsed.`);
  for (const h of hyp.filter((x) => x.status === "weakened" || netSupport(x) < 0))
    drifting.push(`Losing confidence: ${h.statement}`);

  // Changed mind: the trust-building admission that a theory moved.
  const changedMind: string[] = [];
  for (const h of hyp.filter((x) => x.status === "rejected")) changedMind.push(`I was wrong: ${h.statement}`);
  for (const h of hyp.filter((x) => x.status === "weakened")) changedMind.push(`I'm rethinking: ${h.statement}`);

  const uncertain = {
    patterns: hyp.filter((x) => x.status === "forming" || x.status === "testing"),
    questions: (pm.openQuestions ?? []).filter((q) => q.status === "open"),
  };

  return {
    becoming,
    commitments: { building, experimentsActive: opts.experimentsActive ?? 0 },
    reliable,
    uncertain,
    changedMind,
    momentum,
    drifting,
    highestLeverage: highestLeverage(pm),
  };
}

/** The one move most worth making, chosen for long-term benefit and steered toward the
 * person's trajectory when there is one. Deliberately conservative: it returns null when
 * the evidence does not yet justify a recommendation, so the product can honestly say
 * "I don't know yet" instead of fabricating a next step. */
export function highestLeverage(pm: PersonModel): { move: string; rationale: string } | null {
  const hyp = pm.hypotheses ?? [];
  const habits = pm.habits ?? [];
  const toward = pm.trajectory?.statement ? ` It moves you toward ${pm.trajectory.statement}.` : "";

  // 1) A confirmed theory that has not yet been turned into a durable habit is the
  //    highest-leverage thing there is: proven, and not yet banked.
  const confirmed = hyp.find((h) => h.status === "confirmed" && !habits.some((b) => b.fromHypothesisId === h.id));
  if (confirmed) return { move: `Turn a proven pattern into a habit: ${confirmed.statement}`, rationale: `It's confirmed by your own data and not yet locked in as a routine.${toward}` };

  // 2) A habit almost established — one more push banks it.
  const nearly = habits.filter((h) => h.status === "building" && h.reinforcements >= 2).sort((a, b) => b.reinforcements - a.reinforcements)[0];
  if (nearly) return { move: `Reinforce "${nearly.statement}" once more to make it stick`, rationale: `It's close to becoming automatic.${toward}` };

  // 3) A theory being tested right now — see it through.
  const testing = hyp.find((h) => h.status === "testing");
  if (testing) return { move: `See the current experiment through: ${testing.suggestedExperiment ?? testing.statement}`, rationale: `You'll either confirm or rule out a real pattern.${toward}` };

  // 4) Not enough earned yet — say so honestly.
  return null;
}
