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

import { getSignal, signalLabel, signalDirection } from "@/lib/signals";
import type { Confidence, MetricSeries, SignalId } from "@/types";

const dayKey = (iso: string) => iso.slice(0, 10);
/** ISO-week bucket (year + week number) for weekly-cadence signals. */
function weekKeyOf(iso: string): string {
  const d = new Date(iso); const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3); const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 864e5 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
/** CADENCE-AWARE bucketing: a signal is aligned to its own rhythm (daily → day,
 * weekly → ISO week). Two signals only ever co-occur when they share a bucket, so
 * a weekly signal and a daily signal NEVER align — the engine refuses to correlate
 * across mismatched cadences rather than manufacture significance. Honesty by design.
 * (Health signals are all daily, so their behavior is byte-identical to before.) */
function bucketKey(signalId: SignalId, iso: string): string {
  return getSignal(signalId)?.cadence === "weekly" ? weekKeyOf(iso) : dayKey(iso);
}
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

/** Standard normal CDF (Abramowitz & Stegun 7.1.26). */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const pp = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - pp : pp;
}

/** Two-sided p-value for a Pearson r via a t-approximation (df = n - 2). This is
 * how we stop calling coincidences "discoveries": a relationship must be unlikely
 * to have arisen by chance BEFORE it is allowed to surface. */
function pValue(r: number, n: number): number {
  if (n < 4) return 1;
  const df = n - 2;
  const rr = Math.min(0.999999, Math.abs(r));
  const t = rr * Math.sqrt(df / Math.max(1e-9, 1 - rr * rr));
  const z = (t * (1 - 1 / (4 * df))) / Math.sqrt(1 + (t * t) / (2 * df));
  return Math.max(0, Math.min(1, 2 * (1 - normCdf(z))));
}

export interface Association {
  kind: "lag" | "contrast" | "same_day" | "event";
  metrics: SignalId[];
  r?: number;
  n: number;
  /** Two-sided p-value (after multiple-comparison control) — how likely this is noise. */
  p?: number;
  strength: number; // 0..1 salience for ranking
  confidence: Confidence;
  /** Compact machine description handed to the model. */
  evidence: string;
  /** Human, first-person phrasing usable directly in the deterministic fallback. */
  plain: string;
}

/** day -> { metric -> averaged value that day } */
type DayMatrix = Map<string, Partial<Record<SignalId, number>>>;

function buildMatrix(serieses: MetricSeries[]): DayMatrix {
  const m: DayMatrix = new Map();
  const counts = new Map<string, Partial<Record<SignalId, number>>>();
  for (const s of serieses) {
    for (const p of s.points) {
      const d = bucketKey(s.metric, p.recordedAt);
      if (!m.has(d)) { m.set(d, {}); counts.set(d, {}); }
      const row = m.get(d)!; const c = counts.get(d)!;
      row[s.metric] = (row[s.metric] ?? 0) + p.valueNorm;
      c[s.metric] = (c[s.metric] ?? 0) + 1;
    }
  }
  // average same-day duplicates
  for (const [d, row] of m) {
    const c = counts.get(d)!;
    for (const k of Object.keys(row) as SignalId[]) row[k] = row[k]! / (c[k] || 1);
  }
  return m;
}

function corrConfidence(n: number, absR: number, p: number): Confidence {
  if (p > 0.05 || n < 8) return "low";       // not significant, or too little data
  if (p < 0.01 && n >= 12 && absR >= 0.6) return "high";
  return "moderate";
}

/** "higher"/"lower" word for a metric given whether we're at its good end. */
const moreWord = (m: SignalId) => (signalDirection(m) === "higher_is_better" ? "more" : "higher");

/**
 * Translate a correlation sign into plain "when X is higher, Y tends to be …".
 * We speak in raw-value terms (higher/lower score) so it's unambiguous.
 */
function relate(a: SignalId, b: SignalId, r: number, lead = "tend to move together"): string {
  const la = signalLabel(a).toLowerCase();
  const lb = signalLabel(b).toLowerCase();
  const dir = r > 0 ? "higher" : "lower";
  return `On the days your ${la} is higher, your ${lb} tends to be ${dir} too — they ${lead}.`;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

interface CorrCandidate {
  kind: "same_day" | "lag";
  lead: SignalId; follow: SignalId; // for same_day, order is cosmetic
  r: number; n: number; p: number;
}

/** Minimum sample sizes: we require enough paired days before a correlation is
 * even a candidate. Small samples are where spurious "discoveries" come from. */
const MIN_SAMEDAY_N = 8;
const MIN_LAG_N = 8;
const R_FLOOR = 0.45;          // practical-relevance floor on effect size
const BH_Q = 0.10;             // Benjamini-Hochberg false-discovery rate

/**
 * Same-day and next-day correlations across all metric pairs, with statistical
 * discipline. We scan every pair (that's dozens of tests), so we compute a
 * p-value for each candidate and apply a Benjamini-Hochberg correction: only the
 * relationships that survive multiple-comparison control are allowed to surface.
 * This is the core defense against "eye-opening" noise.
 */
function correlationAssociations(matrix: DayMatrix, goals: Set<SignalId>): Association[] {
  const days = [...matrix.keys()].sort();
  const metrics = new Set<SignalId>();
  for (const row of matrix.values()) for (const k of Object.keys(row) as SignalId[]) metrics.add(k);
  const list = [...metrics];
  const cands: CorrCandidate[] = [];

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j];
      // same-day
      const xs: number[] = [], ys: number[] = [];
      for (const d of days) {
        const row = matrix.get(d)!;
        if (row[A] != null && row[B] != null) { xs.push(row[A]!); ys.push(row[B]!); }
      }
      if (xs.length >= MIN_SAMEDAY_N) {
        const r = pearson(xs, ys);
        cands.push({ kind: "same_day", lead: A, follow: B, r, n: xs.length, p: pValue(r, xs.length) });
      }
      // next-day lag, both directions
      for (const [lead, follow] of [[A, B], [B, A]] as [SignalId, SignalId][]) {
        const lx: number[] = [], ly: number[] = [];
        for (let k = 0; k < days.length - 1; k++) {
          const d0 = days[k], d1 = days[k + 1];
          if ((Date.parse(d1) - Date.parse(d0)) !== 864e5) continue;
          const r0 = matrix.get(d0)!, r1 = matrix.get(d1)!;
          if (r0[lead] != null && r1[follow] != null) { lx.push(r0[lead]!); ly.push(r1[follow]!); }
        }
        if (lx.length >= MIN_LAG_N) {
          const r = pearson(lx, ly);
          cands.push({ kind: "lag", lead, follow, r, n: lx.length, p: pValue(r, lx.length) });
        }
      }
    }
  }

  // Benjamini-Hochberg: sort by p ascending; the largest rank k with p(k) <= (k/m)*q
  // sets the cutoff. Everything at or below that p-value is a "real" discovery.
  const m = cands.length;
  const bySig = [...cands].sort((a, b) => a.p - b.p);
  let cutoff = 0;
  for (let k = 0; k < m; k++) {
    if (bySig[k].p <= ((k + 1) / m) * BH_Q) cutoff = bySig[k].p;
  }

  const out: Association[] = [];
  for (const c of cands) {
    if (c.p > cutoff || Math.abs(c.r) < R_FLOOR) continue; // failed FDR control or too weak to matter
    const conf = corrConfidence(c.n, Math.abs(c.r), c.p);
    if (c.kind === "same_day") {
      const A = c.lead, B = c.follow;
      const rel = goals.has(A) || goals.has(B) ? 0.2 : 0;
      out.push({
        kind: "same_day", metrics: [A, B], r: c.r, n: c.n, p: c.p,
        strength: clamp01(Math.abs(c.r) * 0.8 + rel),
        confidence: conf,
        evidence: `same-day correlation ${signalLabel(A)}~${signalLabel(B)}: r=${c.r.toFixed(2)}, n=${c.n}, p=${c.p.toFixed(3)} (FDR-controlled).`,
        plain: relate(A, B, c.r),
      });
    } else {
      const lead = c.lead, follow = c.follow;
      const rel = goals.has(follow) ? 0.25 : goals.has(lead) ? 0.15 : 0;
      const dir = c.r > 0 ? "higher" : "lower";
      out.push({
        kind: "lag", metrics: [lead, follow], r: c.r, n: c.n, p: c.p,
        strength: clamp01(Math.abs(c.r) * 0.9 + rel + 0.1),
        confidence: conf,
        evidence: `next-day lag ${signalLabel(lead)}(d)->${signalLabel(follow)}(d+1): r=${c.r.toFixed(2)}, n=${c.n}, p=${c.p.toFixed(3)} (FDR-controlled).`,
        plain: `When your ${signalLabel(lead).toLowerCase()} is higher one day, your ${signalLabel(follow).toLowerCase()} the next day tends to be ${dir} — it looks like ${signalLabel(lead).toLowerCase()} runs a day ahead of your ${signalLabel(follow).toLowerCase()}.`,
      });
    }
  }
  return out;
}

/**
 * Best-vs-worst day contrast for an anchor metric: what most differentiates the
 * user's top days from their bottom days.
 */
function contrastAssociations(matrix: DayMatrix, goals: Set<SignalId>): Association[] {
  const days = [...matrix.keys()].sort();
  const metrics = new Set<SignalId>();
  for (const row of matrix.values()) for (const k of Object.keys(row) as SignalId[]) metrics.add(k);

  // pick anchors: prefer mood / a goal metric that has enough coverage
  // Anchors are chosen by relevance + coverage — never by health metric names. Goal
  // signals first, then whichever signals we simply have the most days of data for.
  const coverage = new Map<SignalId, number>();
  for (const d of days) for (const k of Object.keys(matrix.get(d)!) as SignalId[]) coverage.set(k, (coverage.get(k) ?? 0) + 1);
  const anchorPrefs: SignalId[] = [...goals, ...[...coverage.keys()].sort((a, b) => coverage.get(b)! - coverage.get(a)!)];
  const out: Association[] = [];
  const seenAnchor = new Set<SignalId>();

  for (const anchor of anchorPrefs) {
    if (seenAnchor.has(anchor) || !metrics.has(anchor)) continue;
    seenAnchor.add(anchor);
    const withAnchor = days.filter((d) => matrix.get(d)![anchor] != null);
    if (withAnchor.length < 10) continue;
    const sorted = [...withAnchor].sort((a, b) => matrix.get(a)![anchor]! - matrix.get(b)![anchor]!);
    const k = Math.max(2, Math.floor(sorted.length / 3));
    const low = sorted.slice(0, k), high = sorted.slice(-k);

    let best: { metric: SignalId; diff: number } | null = null;
    for (const m of metrics) {
      if (m === anchor) continue;
      const hv = high.map((d) => matrix.get(d)![m]).filter((v): v is number => v != null);
      const lv = low.map((d) => matrix.get(d)![m]).filter((v): v is number => v != null);
      if (hv.length < 3 || lv.length < 3) continue;
      const diff = mean(hv) - mean(lv);
      if (!best || Math.abs(diff) > Math.abs(best.diff)) best = { metric: m, diff };
    }
    if (best && Math.abs(best.diff) >= 10) {
      const anchorHigherIsBetter = signalDirection(anchor) === "higher_is_better";
      const goodWord = anchorHigherIsBetter ? "best" : "toughest"; // high anchor value
      const dir = best.diff > 0 ? "higher" : "lower";
      out.push({
        kind: "contrast", metrics: [anchor, best.metric], n: withAnchor.length,
        strength: clamp01(0.55 + Math.min(0.3, Math.abs(best.diff) / 60) + (goals.has(best.metric) ? 0.15 : 0)),
        confidence: withAnchor.length >= 10 ? "moderate" : "low",
        evidence: `contrast on ${signalLabel(anchor)}: top-third vs bottom-third days differ most in ${signalLabel(best.metric)} by ${best.diff.toFixed(0)} pts (n=${withAnchor.length}).`,
        plain: `On your ${goodWord} ${signalLabel(anchor).toLowerCase()} days, your ${signalLabel(best.metric).toLowerCase()} tends to run about ${Math.abs(best.diff).toFixed(0)} points ${dir} than on the other days — it's the single biggest thing that separates them.`,
      });
    }
  }
  return out;
}

/**
 * The public entry point. Returns the strongest associations, ranked, for the
 * report evidence, the chat context, and the deterministic renderer.
 */
export function computeAssociations(serieses: MetricSeries[], goals: SignalId[] = [], limit = 4): Association[] {
  const matrix = buildMatrix(serieses);
  if (matrix.size < 8) return []; // not enough days to say anything honest
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
