/**
 * COGNITIVE PRIMITIVE ENGINE
 * --------------------------
 * The point of this file is NOT to hard-code assessments. It defines a small
 * set of *parameterized, procedurally-generated cognitive primitives* — the
 * irreducible building blocks Synapse composes into assessments. Every concrete
 * "assessment" is just a primitive + parameters + a seed, so the Agent can
 * invent endless, personalized, difficulty-calibrated scenarios WITHOUT any new
 * code. Code owns: trial generation (procedural), param safety bounds, and
 * scoring → normalized 0..100. The Agent owns: which primitives, which params,
 * and why (see lib/assessments/planner.ts + /api/assessment-plan).
 */

import type { MetricKey } from "@/types";

export type TaskKind =
  | "reaction"        // simple reaction time
  | "go_no_go"        // choice RT + inhibition (attention)
  | "memory_span"     // remember & reproduce a sequence (working memory)
  | "visual_search"   // find a target among distractors (attention / processing speed)
  | "pattern"         // continue a logical sequence (pattern recognition)
  | "self_report";    // a calibrated self-report scale for any metric

export interface TaskCatalogEntry {
  kind: TaskKind;
  title: string;
  family: "performance" | "self_report";
  measures: MetricKey[];
  /** One line Synapse can read to decide when this primitive is useful. */
  blurb: string;
  /** Whether difficulty is meaningful (enables adaptive staircase). */
  adaptiveDifficulty: boolean;
}

/** The catalog the Agent reasons over. Generic capabilities, not scenarios. */
export const TASK_CATALOG: Record<TaskKind, TaskCatalogEntry> = {
  reaction: {
    kind: "reaction", title: "Reaction time", family: "performance", measures: ["reaction_time", "processing_speed"],
    blurb: "Tap the instant a target appears. Best for tracking raw responsiveness and processing speed.",
    adaptiveDifficulty: false,
  },
  go_no_go: {
    kind: "go_no_go", title: "Go / No-Go", family: "performance", measures: ["attention", "reaction_time"],
    blurb: "Respond to targets, hold back on distractors. Measures sustained attention and impulse control.",
    adaptiveDifficulty: true,
  },
  memory_span: {
    kind: "memory_span", title: "Memory span", family: "performance", measures: ["working_memory"],
    blurb: "Reproduce a growing sequence. A staircase finds the longest span held — best for working memory.",
    adaptiveDifficulty: true,
  },
  visual_search: {
    kind: "visual_search", title: "Visual search", family: "performance", measures: ["attention", "processing_speed", "reaction_time"],
    blurb: "Find the odd one out among distractors. Measures selective attention and processing speed.",
    adaptiveDifficulty: true,
  },
  pattern: {
    kind: "pattern", title: "Pattern recognition", family: "performance", measures: ["working_memory", "attention"],
    blurb: "Choose what comes next in a sequence. Measures pattern recognition and fluid reasoning.",
    adaptiveDifficulty: true,
  },
  self_report: {
    kind: "self_report", title: "Quick check-in", family: "self_report", measures: ["fatigue", "mood", "sleep_quality", "stress", "symptoms"],
    blurb: "A short, kind scale question. The only way to read felt states like fatigue, sleep, stress, mood, and symptom load.",
    adaptiveDifficulty: false,
  },
};

export const TASK_KINDS = Object.keys(TASK_CATALOG) as TaskKind[];
export const isTaskKind = (s: string): s is TaskKind => (TASK_KINDS as string[]).includes(s);

/**
 * Permissive params. The Agent may set any subset; clampParams() enforces sane
 * bounds so a malformed plan can never break the UI or the scoring.
 */
export interface TaskParams {
  difficulty: number;    // 1..5 starting difficulty
  trials: number;        // number of trials / rounds
  metric?: MetricKey;    // self_report target (and optional override elsewhere)
  prompt?: string;       // self_report question text
  lowLabel?: string;
  highLabel?: string;
  invert?: boolean;      // self_report: higher selection = "more" of a lower-is-better metric
}

const clampInt = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : dflt;
  return Math.max(lo, Math.min(hi, n));
};

/** Per-kind safe bounds. */
export function clampParams(kind: TaskKind, p: Partial<TaskParams> = {}): TaskParams {
  const difficulty = clampInt(p.difficulty, 1, 5, 2);
  switch (kind) {
    case "reaction": return { difficulty, trials: clampInt(p.trials, 3, 7, 5) };
    case "go_no_go": return { difficulty, trials: clampInt(p.trials, 10, 30, 18) };
    case "memory_span": return { difficulty, trials: clampInt(p.trials, 3, 8, 5) };
    case "visual_search": return { difficulty, trials: clampInt(p.trials, 3, 8, 5) };
    case "pattern": return { difficulty, trials: clampInt(p.trials, 3, 8, 5) };
    case "self_report": {
      const metric = (p.metric && ["fatigue", "mood", "sleep_quality", "stress", "symptoms"].includes(p.metric)) ? p.metric : "fatigue";
      return { difficulty: 1, trials: 1, metric, prompt: p.prompt, lowLabel: p.lowLabel, highLabel: p.highLabel, invert: p.invert };
    }
  }
}

/** Rough time estimate (seconds) for budgeting + the intro card. */
export function estTaskSeconds(kind: TaskKind, p: TaskParams): number {
  switch (kind) {
    case "reaction": return 15 + p.trials * 4;
    case "go_no_go": return 20 + p.trials * 2;
    case "memory_span": return 20 + p.trials * 8;
    case "visual_search": return 15 + p.trials * 7;
    case "pattern": return 15 + p.trials * 10;
    case "self_report": return 20;
  }
}

/* ----------------------------------------------------------------------------
 * Seeded RNG (mulberry32) — procedural generation is deterministic per seed so
 * a given plan is reproducible, yet every run gets fresh content via a new seed.
 * -------------------------------------------------------------------------- */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const randomSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
export const pick = <T,>(rng: () => number, xs: T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];
export const shuffle = <T,>(rng: () => number, xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const clamp = (v: number, lo = 5, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));

/* ----------------------------------------------------------------------------
 * SCORING — pure functions turning raw performance into normalized 0..100 in
 * each metric's natural magnitude (so it lines up with METRIC_META direction:
 * performance metrics higher = better; fatigue/stress higher = "more of it").
 * -------------------------------------------------------------------------- */

/** Reaction-time ms -> 0..100 (220ms ≈ 100, slower ramps down). */
export function normReactionMs(ms: number): number { return clamp(100 - (ms - 220) / 6); }

/** Accuracy 0..1 -> 0..100. */
export function normAccuracy(acc: number): number { return clamp(acc * 100); }

/** Working-memory span -> 0..100 (span of ~9 ≈ ceiling). */
export function normSpan(span: number): number { return clamp((span / 9) * 100); }

/** Visual search: accuracy with a gentle speed adjustment on median ms/target. */
export function normSearch(acc: number, medianMs: number): number {
  const speedFactor = 1 - Math.max(0, Math.min(0.4, (medianMs - 900) / 4500));
  return clamp(acc * 100 * speedFactor);
}

/** Processing speed: speed-weighted accuracy (≈600ms/decision ≈ ceiling). */
export function normProcessing(acc: number, medianMs: number): number {
  const speed = Math.max(5, Math.min(100, 100 - (medianMs - 600) / 22));
  return clamp(acc * speed);
}

/** Combine a list of normalized values for the same metric (mean). */
export function meanNorm(values: number[]): number {
  if (!values.length) return 0;
  return clamp(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Self-report level (1..5) -> 0..100 in the metric's natural magnitude. */
export function normSelfReport(level1to5: number): number { return clamp(level1to5 * 20, 20, 100); }
