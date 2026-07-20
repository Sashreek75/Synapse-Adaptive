/**
 * DETERMINISTIC STATS LAYER  (founding doc §7.1, §7.3 step 2, §7.4)
 * -----------------------------------------------------------------
 * All numbers are computed here, in plain code — never by the model.
 * The model receives this pre-computed evidence and translates it into
 * coach-voice language. This layer also owns the CONFIDENCE CEILING:
 * the model may lower confidence but never raise it above what the data
 * supports. This is the single most important trust mechanism.
 */

import type {
  Confidence,
  SignalId,
  MetricSeries,
  ProactivePatternType,
} from "@/types";

export interface TrendStat {
  metric: SignalId;
  n: number;
  latest: number;
  baseline: number; // rolling mean excluding latest
  delta: number; // latest - baseline
  pctChange: number;
  slope: number; // simple per-week slope over the window
  volatility: number; // std dev — used for noise flags
  confidenceCeiling: Confidence;
  flags: string[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

const std = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

/** Least-squares slope of y over index (per-step). */
function slope(ys: number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

/**
 * Confidence ceiling from data quality alone. The model can only go lower.
 * Deliberately conservative: early relationships are hypotheses, not findings.
 * - < 5 points            -> "low"       (too little to trust; treat as a hint)
 * - < 10 pts or noisy     -> "moderate"  (a real signal, still developing)
 * - >= 10 pts, low noise  -> "high"
 */
function confidenceCeiling(n: number, volatility: number): Confidence {
  if (n < 5) return "low";
  if (n < 10 || volatility > 12) return "moderate";
  return "high";
}

/** Relative, non-numeric description of where a value sits vs the user's baseline. */
export function relativeLevel(latest: number, baseline: number): string {
  const d = latest - baseline;
  const a = Math.abs(d);
  if (a < 4) return "in line with your recent baseline";
  const dir = d > 0 ? "above" : "below";
  const mag = a >= 19 ? "well " : a >= 10 ? "noticeably " : "a little ";
  return `${mag}${dir} your recent baseline`;
}

/** Relative, non-numeric description of a movement (positive = the "better" direction). */
export function relativeMove(betterDelta: number): string {
  const a = Math.abs(betterDelta);
  if (a < 4) return "held about steady";
  const mag = a >= 19 ? "clearly" : a >= 10 ? "noticeably" : "a little";
  return betterDelta > 0 ? `improved ${mag}` : `slipped ${mag}`;
}

export function computeTrend(series: MetricSeries): TrendStat {
  const values = series.points.map((p) => p.valueNorm);
  const n = values.length;
  const latest = values[n - 1] ?? 0;
  const prior = values.slice(0, -1);
  const baseline = prior.length ? mean(prior) : latest;
  const delta = latest - baseline;
  const volatility = std(values);
  const flags: string[] = [];
  if (n < 3) flags.push("small_sample");
  if (volatility > 12) flags.push("noisy_signal");

  return {
    metric: series.metric,
    n,
    latest,
    baseline,
    delta,
    pctChange: baseline === 0 ? 0 : (delta / baseline) * 100,
    slope: slope(values),
    volatility,
    confidenceCeiling: confidenceCeiling(n, volatility),
    flags,
  };
}

/** A pattern worth potentially surfacing proactively. */
export interface PatternCandidate {
  type: ProactivePatternType;
  metrics: SignalId[];
  /** 0..1 salience = strength × duration × goal-relevance × novelty. */
  salience: number;
  confidenceCeiling: Confidence;
  /** Machine description handed to the model to phrase in coach voice. */
  evidence: string;
  dedupeKey: string;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * THE PROACTIVE ENGINE'S DETERMINISTIC HALF (founding doc §20.3).
 * Scans trends for noticing-worthy patterns and scores their salience.
 * Only candidates above threshold get rendered by the model.
 */
export function detectPatterns(
  serieses: MetricSeries[],
  goals: SignalId[],
): PatternCandidate[] {
  const trends = serieses.map(computeTrend);
  const byKey = new Map(trends.map((t) => [t.metric, t]));
  const out: PatternCandidate[] = [];

  for (const t of trends) {
    const goalRelevance = goals.includes(t.metric) ? 1 : 0.6;
    const duration = clamp01((t.n - 2) / 4); // more weeks => more salient

    // Sustained trend: consistent slope over >=4 weeks.
    if (t.n >= 4 && Math.abs(t.slope) >= 1.2) {
      const strength = clamp01(Math.abs(t.slope) / 4);
      out.push({
        type: "sustained_trend",
        metrics: [t.metric],
        salience: clamp01(strength * 0.5 + duration * 0.3 + goalRelevance * 0.2),
        confidenceCeiling: t.confidenceCeiling,
        evidence: `${t.metric}: ${t.slope > 0 ? "rising" : "declining"} steadily over ${t.n} weeks (slope ${t.slope.toFixed(1)}/wk, latest ${t.latest.toFixed(0)}, baseline ${t.baseline.toFixed(0)}).`,
        dedupeKey: `sustained_trend:${t.metric}`,
      });
    }

    // Milestone: clear sustained improvement.
    if (t.n >= 3 && t.delta >= 10 && t.slope > 0) {
      out.push({
        type: "milestone",
        metrics: [t.metric],
        salience: clamp01(0.55 + goalRelevance * 0.3 + duration * 0.15),
        confidenceCeiling: t.confidenceCeiling,
        evidence: `${t.metric}: improved ${t.delta.toFixed(0)} points above the user's recent baseline.`,
        dedupeKey: `milestone:${t.metric}`,
      });
    }
  }

  // Divergence: one metric improving while another (related) slips.
  const fatigue = byKey.get("fatigue");
  const reaction = byKey.get("reaction_time");
  if (fatigue && reaction && fatigue.n >= 3 && reaction.n >= 3) {
    // fatigue is lower_is_better; rising fatigue score = worse.
    if (fatigue.slope >= 1 && Math.abs(reaction.slope) < 0.8) {
      out.push({
        type: "divergence",
        metrics: ["fatigue", "reaction_time"],
        salience: clamp01(0.7 + clamp01(fatigue.slope / 4) * 0.3),
        confidenceCeiling:
          fatigue.confidenceCeiling === "high" ? "moderate" : fatigue.confidenceCeiling,
        evidence: `fatigue rising steadily (slope ${fatigue.slope.toFixed(1)}/wk over ${fatigue.n} weeks) while reaction_time has held steady (slope ${reaction.slope.toFixed(1)}/wk).`,
        dedupeKey: `divergence:fatigue:reaction_time`,
      });
    }
  }

  return out.sort((a, b) => b.salience - a.salience);
}

/** Salience threshold above which a pattern becomes a proactive notice. */
export const SALIENCE_THRESHOLD = 0.6;
