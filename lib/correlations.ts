/**
 * THE ASSOCIATION ENGINE — where Synapse stops describing single metrics and
 * starts finding the RELATIONSHIPS between them. This is the deterministic
 * substrate behind "non-obvious, eye-opening" insight: correlations the user
 * can't eyeball from a dashboard.
 *
 * All of this is computed in plain code (never the model). The model receives
 * these associations as pre-computed evidence and turns them into direct,
 * actionable language — it never invents a relationship that isn't here.
 *
 * Four kinds of association, in rough order of "how surprising / useful":
 *   1. lag      — one metric today predicts ANOTHER tomorrow (e.g. sleep → next-day focus)
 *   2. contrast — what differs on your best vs worst days for an anchor metric
 *   3. same_day — two metrics that move together on the same day
 *   4. event    — how a logged life-event / context tag shifts a metric
 *
 * Confidence is owned here (data quality), mirroring lib/stats: the model may
 * only lower it, never raise it.
 */

import { METRIC_META, metricLabel } from "@/lib/metrics";
import type { Confidence, MetricKey, MetricSeries } from "@/types";

const dayKey = (iso: string) => iso.slice(0, 10);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export interface Association {
  kind: "lag" | "contrast" | "same_day" | "event";
  metrics: MetricKey[];
  r?: number;
  n: number;
  strength: number; // 0..1 salience for ranking
  confidence: Confidence;
  /** Compact machine description handed to the model. */
  evidence: string;
  /** Human, first-person phrasing usable directly in the deterministic fallback. */
  plain: string;
}

/** day -> { metric -> averaged value that day } */
type DayMatrix = Map<string, Partial<Record<MetricKey, number>>>;

function buildMatrix(serieses: MetricSeries[]): DayMatrix {
  const m: DayMatrix = new Map();
  const counts = new Map<string, Partial<Record<MetricKey, number>>>();
  for (const s of serieses) {
    for (const p of s.points) {
      const d = dayKey(p.recordedAt);
      if (!m.has(d)) { m.set(d, {}); counts.set(d, {}); }
      const row = m.get(d)!; const c = counts.get(d)!;
      row[s.metric] = (row[s.metric] ?? 0) + p.valueNorm;
      c[s.metric] = (c[s.metric] ?? 0) + 1;
    }
  }
  // average same-day duplicates
  for (const [d, row] of m) {
    const c = counts.get(d)!;
    for (const k of Object.keys(row) as MetricKey[]) row[k] = row[k]! / (c[k] || 1);
  }
  return m;
}

function corrConfidence(n: number, absR: number): Confidence {
  if (n < 5) return "low";
  if (n >= 8 && absR >= 0.7) return "high";
  return "moderate";
}

/** "higher"/"lower" word for a metric given whether we're at its good end. */
const moreWord = (m: MetricKey) => (METRIC_META[m].direction === "higher_is_better" ? "more" : "higher");

/**
 * Translate a correlation sign into plain "when X is higher, Y tends to be …".
 * We speak in raw-value terms (higher/lower score) so it's unambiguous.
 */
function relate(a: MetricKey, b: MetricKey, r: number, lead = "tend to move together"): string {
  const la = metricLabel(a).toLowerCase();
  const lb = metricLabel(b).toLowerCase();
  const dir = r > 0 ? "higher" : "lower";
  return `On the days your ${la} is higher, your ${lb} tends to be ${dir} too — they ${lead}.`;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Same-day and next-day correlations across all metric pairs.
 */
function correlationAssociations(matrix: DayMatrix, goals: Set<MetricKey>): Association[] {
  const days = [...matrix.keys()].sort();
  const metrics = new Set<MetricKey>();
  for (const row of matrix.values()) for (const k of Object.keys(row) as MetricKey[]) metrics.add(k);
  const list = [...metrics];
  const out: Association[] = [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];

      // --- same-day ---
      const xs: number[] = [], ys: number[] = [];
      for (const d of days) {
        const row = matrix.get(d)!;
        if (row[A] != null && row[B] != null) { xs.push(row[A]!); ys.push(row[B]!); }
      }
      if (xs.length >= 5) {
        const r = pearson(xs, ys);
        if (Math.abs(r) >= 0.5) {
          const rel = goals.has(A) || goals.has(B) ? 0.2 : 0;
          out.push({
            kind: "same_day", metrics: [A, B], r, n: xs.length,
            strength: clamp01(Math.abs(r) * 0.8 + rel),
            confidence: corrConfidence(xs.length, Math.abs(r)),
            evidence: `same-day correlation ${metricLabel(A)}~${metricLabel(B)}: r=${r.toFixed(2)}, n=${xs.length}.`,
            plain: relate(A, B, r),
          });
        }
      }

      // --- next-day lag, both directions (A today -> B tomorrow, B today -> A tomorrow) ---
      for (const [lead, follow] of [[A, B], [B, A]] as [MetricKey, MetricKey][]) {
        const lx: number[] = [], ly: number[] = [];
        for (let k = 0; k < days.length - 1; k++) {
          const d0 = days[k], d1 = days[k + 1];
          // require truly consecutive calendar days for a "next-day" claim
          if ((Date.parse(d1) - Date.parse(d0)) !== 864e5) continue;
          const r0 = matrix.get(d0)!, r1 = matrix.get(d1)!;
          if (r0[lead] != null && r1[follow] != null) { lx.push(r0[lead]!); ly.push(r1[follow]!); }
        }
        if (lx.length >= 5) {
          const r = pearson(lx, ly);
          if (Math.abs(r) >= 0.5) {
            const rel = goals.has(follow) ? 0.25 : goals.has(lead) ? 0.15 : 0;
            const dir = r > 0 ? "higher" : "lower";
            out.push({
              kind: "lag", metrics: [lead, follow], r, n: lx.length,
              strength: clamp01(Math.abs(r) * 0.9 + rel + 0.1), // lag effects are the most useful
              confidence: corrConfidence(lx.length, Math.abs(r)),
              evidence: `next-day lag ${metricLabel(lead)}(d)->${metricLabel(follow)}(d+1): r=${r.toFixed(2)}, n=${lx.length}.`,
              plain: `When your ${metricLabel(lead).toLowerCase()} is higher one day, your ${metricLabel(follow).toLowerCase()} the next day tends to be ${dir} — it looks like ${metricLabel(lead).toLowerCase()} runs a day ahead of your ${metricLabel(follow).toLowerCase()}.`,
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Best-vs-worst day contrast for an anchor metric: what most differentiates the
 * user's top days from their bottom days.
 */
function contrastAssociations(matrix: DayMatrix, goals: Set<MetricKey>): Association[] {
  const days = [...matrix.keys()].sort();
  const metrics = new Set<MetricKey>();
  for (const row of matrix.values()) for (const k of Object.keys(row) as MetricKey[]) metrics.add(k);

  // pick anchors: prefer mood / a goal metric that has enough coverage
  const anchorPrefs: MetricKey[] = ["mood", "attention", "fatigue", ...goals];
  const out: Association[] = [];
  const seenAnchor = new Set<MetricKey>();

  for (const anchor of anchorPrefs) {
    if (seenAnchor.has(anchor) || !metrics.has(anchor)) continue;
    seenAnchor.add(anchor);
    const withAnchor = days.filter((d) => matrix.get(d)![anchor] != null);
    if (withAnchor.length < 6) continue;
    const sorted = [...withAnchor].sort((a, b) => matrix.get(a)![anchor]! - matrix.get(b)![anchor]!);
    const k = Math.max(2, Math.floor(sorted.length / 3));
    const low = sorted.slice(0, k), high = sorted.slice(-k);

    let best: { metric: MetricKey; diff: number } | null = null;
    for (const m of metrics) {
      if (m === anchor) continue;
      const hv = high.map((d) => matrix.get(d)![m]).filter((v): v is number => v != null);
      const lv = low.map((d) => matrix.get(d)![m]).filter((v): v is number => v != null);
      if (hv.length < 3 || lv.length < 3) continue;
      const diff = mean(hv) - mean(lv);
      if (!best || Math.abs(diff) > Math.abs(best.diff)) best = { metric: m, diff };
    }
    if (best && Math.abs(best.diff) >= 8) {
      const anchorHigherIsBetter = METRIC_META[anchor].direction === "higher_is_better";
      const goodWord = anchorHigherIsBetter ? "best" : "toughest"; // high anchor value
      const dir = best.diff > 0 ? "higher" : "lower";
      out.push({
        kind: "contrast", metrics: [anchor, best.metric], n: withAnchor.length,
        strength: clamp01(0.55 + Math.min(0.3, Math.abs(best.diff) / 60) + (goals.has(best.metric) ? 0.15 : 0)),
        confidence: withAnchor.length >= 10 ? "moderate" : "low",
        evidence: `contrast on ${metricLabel(anchor)}: top-third vs bottom-third days differ most in ${metricLabel(best.metric)} by ${best.diff.toFixed(0)} pts (n=${withAnchor.length}).`,
        plain: `On your ${goodWord} ${metricLabel(anchor).toLowerCase()} days, your ${metricLabel(best.metric).toLowerCase()} tends to run about ${Math.abs(best.diff).toFixed(0)} points ${dir} than on the other days — it's the single biggest thing that separates them.`,
      });
    }
  }
  return out;
}

/**
 * The public entry point. Returns the strongest associations, ranked, for the
 * report evidence, the chat context, and the deterministic renderer.
 */
export function computeAssociations(serieses: MetricSeries[], goals: MetricKey[] = [], limit = 4): Association[] {
  const matrix = buildMatrix(serieses);
  if (matrix.size < 5) return []; // not enough days to say anything honest
  const goalSet = new Set(goals);
  const all = [
    ...correlationAssociations(matrix, goalSet),
    ...contrastAssociations(matrix, goalSet),
  ];
  // dedupe by unordered metric pair + kind, keep the strongest
  const byKey = new Map<string, Association>();
  for (const a of all) {
    const key = `${a.kind}:${[...a.metrics].sort().join("+")}`;
    const cur = byKey.get(key);
    if (!cur || a.strength > cur.strength) byKey.set(key, a);
  }
  return [...byKey.values()].sort((a, b) => b.strength - a.strength).slice(0, limit);
}
