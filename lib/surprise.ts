/**
 * THE SURPRISE ENGINE
 * -------------------
 * The product does not optimize for accurate summaries. It optimizes for one
 * thing: making the user think "I never realized that." A strong relationship
 * (sleep ↔ fatigue) is useless if it's obvious. This module re-ranks the
 * relationships found in `lib/correlations.ts` by how SURPRISING they are, not
 * just how strong — so the non-obvious, single-person, longitudinal discoveries
 * rise to the top and the obvious ones sink.
 *
 * surprise = non-obviousness × strength × recurrence × how-newly-it-changed
 *
 * All deterministic — the model never invents this. It receives the ranked
 * findings as evidence and voices the top one. Recurrence does double duty: it
 * powers "four weeks running" AND it is the cheapest guard against surfacing a
 * one-week spurious correlation as if it were a discovery.
 */

import { computeAssociations, type Association } from "@/lib/correlations";
import type { AssociationSnapshot, MetricKey, MetricSeries } from "@/types";

/** Stable key for a relationship: kind + the unordered metric pair. */
export function associationKey(a: Pick<Association, "kind" | "metrics">): string {
  return `${a.kind}:${[...a.metrics].sort().join("+")}`;
}

const pairKey = (metrics: MetricKey[]) => [...metrics].sort().join("+");

/**
 * The obviousness prior (0..1): how much a lay person already EXPECTS this
 * relationship. High = everyone knows it (boring). Low = genuinely non-obvious.
 * Deviation from expectation is what makes a finding feel like a revelation.
 * Any pair not listed defaults to 0.35 (mildly novel).
 */
const EXPECTEDNESS: Record<string, number> = {
  // Everybody already knows these — surfacing them is a failure.
  "fatigue+sleep_quality": 0.9,
  "mood+stress": 0.78,
  "fatigue+mood": 0.7,
  "mood+sleep_quality": 0.66,
  "sleep_quality+stress": 0.62,
  "stress+symptoms": 0.6,
  // Plausible but not obvious.
  "attention+fatigue": 0.5,
  "fatigue+stress": 0.5,
  "attention+sleep_quality": 0.45,
  "mood+symptoms": 0.45,
  // Genuinely non-obvious — the good stuff.
  "stress+working_memory": 0.25,
  "reaction_time+sleep_quality": 0.25,
  "processing_speed+stress": 0.22,
  "attention+stress": 0.3,
  "reaction_time+stress": 0.22,
};

/** Kind multiplier: a time-delayed (lag) effect is inherently something a
 * dashboard cannot show, so it's less "expected" even for a familiar pair. */
const KIND_FACTOR: Record<Association["kind"], number> = {
  lag: 0.55,       // "X today predicts Y tomorrow" — very non-obvious
  contrast: 0.7,   // "the one thing separating your best/worst days"
  same_day: 1.0,   // two things moving together — easiest to guess
  event: 0.6,
};

function expectednessOf(a: Association): number {
  const base = EXPECTEDNESS[pairKey(a.metrics)] ?? 0.35;
  return Math.max(0, Math.min(1, base * KIND_FACTOR[a.kind]));
}

export interface SurprisingFinding {
  association: Association;
  key: string;
  surprise: number;        // 0..1 — the ranking signal
  whySurprising: string;   // compact machine string for the model / logs
  recurrence: number;      // how many recent weeks this relationship appeared
  recurrenceLabel: string; // human phrasing
  isNew: boolean;          // not seen last recorded week
  flipped: boolean;        // sign reversed vs history
  /** A finding is only called a DISCOVERY once it recurs or is already high
   * confidence — otherwise it's a tentative "early sign". This is the guard. */
  readyToSurface: boolean;
}

function recurrenceOf(history: AssociationSnapshot[], key: string): { count: number; lastR?: number; lastWeek?: string } {
  const weeks = new Set<string>();
  let lastR: number | undefined;
  let lastWeek: string | undefined;
  for (const s of history) {
    if (s.key !== key) continue;
    weeks.add(s.weekKey);
    if (!lastWeek || s.weekKey > lastWeek) { lastWeek = s.weekKey; lastR = s.r; }
  }
  return { count: weeks.size, lastR, lastWeek };
}

function recurrenceLabel(count: number): string {
  if (count <= 0) return "first time I've seen this";
  if (count === 1) return "the second week I've seen this";
  return `${count + 1} weeks running now`;
}

/**
 * Re-rank this week's associations by SURPRISE. `history` is the rolling record
 * from Mind.associationHistory (empty is fine — the obviousness prior still
 * demotes the boring relationships).
 */
export function computeSurprises(
  serieses: MetricSeries[],
  goals: MetricKey[] = [],
  history: AssociationSnapshot[] = [],
  limit = 5,
): SurprisingFinding[] {
  // Pull a generous candidate set from the association engine, then re-rank.
  const associations = computeAssociations(serieses, goals, 12);
  const lastWeek = history.reduce<string>((mx, s) => (s.weekKey > mx ? s.weekKey : mx), "");

  const findings = associations.map((a): SurprisingFinding => {
    const key = associationKey(a);
    const { count, lastR } = recurrenceOf(history, key);
    const seenLastWeek = history.some((s) => s.key === key && s.weekKey === lastWeek);
    const isNew = !!lastWeek && !seenLastWeek;
    const flipped = lastR != null && a.r != null && Math.sign(lastR) !== 0 && Math.sign(a.r) !== 0 && Math.sign(lastR) !== Math.sign(a.r);

    const surprisePotential = 1 - expectednessOf(a);
    const recurrenceWeight = Math.min(count, 4) / 4;
    const changeNovelty = flipped ? 1 : isNew ? 0.6 : 0.2;

    const surprise =
      0.4 * surprisePotential +
      0.25 * Math.min(1, a.strength) +
      0.2 * recurrenceWeight +
      0.15 * changeNovelty;

    // EARN THE RIGHT TO SURPRISE: a finding is only a "discovery" once it clears a
    // real confidence bar AND (for moderate confidence) has recurred at least once.
    // High-confidence, FDR-controlled relationships may surface immediately; anything
    // low stays a tentative "early sign", never announced as a discovery.
    const readyToSurface = a.confidence === "high" || (a.confidence === "moderate" && count >= 1);

    const bits = [
      a.kind === "lag" ? "non-obvious next-day lag" : a.kind === "contrast" ? "best-vs-worst-day contrast" : "same-day link",
      flipped ? "DIRECTION FLIPPED vs before" : isNew ? "new this week" : recurrenceLabel(count),
      `strength ${a.strength.toFixed(2)}`,
    ];

    return {
      association: a,
      key,
      surprise: Math.max(0, Math.min(1, surprise)),
      whySurprising: bits.join("; "),
      recurrence: count,
      recurrenceLabel: recurrenceLabel(count),
      isNew,
      flipped,
      readyToSurface,
    };
  });

  return findings.sort((x, y) => y.surprise - x.surprise).slice(0, limit);
}

/** Append this week's relationships to the rolling history (deduped by week+key,
 * capped so the blob stays small). Feeds next week's recurrence calculation. */
export function recordAssociations(
  history: AssociationSnapshot[],
  weekKey: string,
  associations: Association[],
  cap = 120,
): AssociationSnapshot[] {
  const seen = new Set(history.map((s) => `${s.weekKey}|${s.key}`));
  const additions: AssociationSnapshot[] = [];
  for (const a of associations) {
    const key = associationKey(a);
    const id = `${weekKey}|${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    additions.push({ weekKey, key, r: a.r, n: a.n });
  }
  return [...history, ...additions].slice(-cap);
}
