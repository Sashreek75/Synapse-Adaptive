/**
 * THE SIGNAL REGISTRY — measurable dimensions of a person, across domains.
 *
 * Health signals are the first, best-instrumented set; other domains register here
 * with zero engine changes. "Obvious" relationships live as signal METADATA
 * (expectedRelations), not baked into the surprise engine. NOTE: the numeric
 * correlation core currently reasons over the health (MetricKey) subset — its honest
 * quantitative substrate — while the registry and the Evidence atom already span
 * every domain, so non-health evidence is captured and understood qualitatively today.
 */

import { METRIC_META, metricLabel } from "@/lib/metrics";
import type { Evidence, MetricDirection, MetricKey, MetricSeries, SignalDef, SignalId } from "@/types";

/** Everybody-knows-this partnerships among the legacy health signals (metadata). */
const EXPECTED: Partial<Record<MetricKey, MetricKey[]>> = {
  sleep_quality: ["fatigue", "mood", "stress"],
  fatigue: ["sleep_quality", "mood"],
  mood: ["stress", "fatigue", "sleep_quality"],
  stress: ["mood", "sleep_quality", "symptoms"],
  symptoms: ["stress"],
};

/** Health metrics as health-domain signals (ids kept verbatim → stored data resolves). */
const HEALTH: SignalDef[] = (Object.keys(METRIC_META) as MetricKey[]).map((k) => {
  const m = METRIC_META[k];
  return { id: k, label: m.label, domain: "health", kind: "rating", direction: m.direction, cadence: "daily", description: m.description, expectedRelations: EXPECTED[k] };
});

/** Example non-health dimensions — the registry spans a life, not a clinic. New
 * domains are just more entries; the engine never branches on domain. */
const OTHER: SignalDef[] = [
  { id: "deep_work_hours", label: "Deep-work hours", domain: "work", kind: "duration", direction: "higher_is_better", cadence: "daily", description: "Focused, uninterrupted work." },
  { id: "focused_study", label: "Focused study", domain: "study", kind: "duration", direction: "higher_is_better", cadence: "daily", description: "Real, undistracted study time." },
  { id: "habit_kept", label: "Habit kept", domain: "habits", kind: "boolean", direction: "higher_is_better", cadence: "daily", description: "Whether you kept a habit you're building." },
  { id: "trained", label: "Trained", domain: "fitness", kind: "boolean", direction: "higher_is_better", cadence: "daily", description: "Whether you moved / worked out." },
];

export const SIGNAL_REGISTRY: Record<SignalId, SignalDef> =
  Object.fromEntries([...HEALTH, ...OTHER].map((d) => [d.id, d]));

export function getSignal(id: SignalId): SignalDef | undefined { return SIGNAL_REGISTRY[id]; }
export function signalLabel(id: SignalId): string { return SIGNAL_REGISTRY[id]?.label ?? metricLabel(id as MetricKey); }
export function signalDomain(id: SignalId): string { return SIGNAL_REGISTRY[id]?.domain ?? "health"; }
export function areExpectedPartners(a: SignalId, b: SignalId): boolean {
  return !!(getSignal(a)?.expectedRelations?.includes(b) || getSignal(b)?.expectedRelations?.includes(a));
}
/** Direction of "good" for any signal. Registry-driven, with a neutral default so an
 * unregistered signal never crashes the engine (it is simply treated as higher-is-better). */
export function signalDirection(id: SignalId): MetricDirection {
  return getSignal(id)?.direction ?? "higher_is_better";
}
/** A guaranteed meta object for any signal (registered or not) — so UI/consumers that
 * used the nine-key METRIC_META table can read label/direction for ANY domain safely. */
export function signalMeta(id: SignalId): { label: string; direction: MetricDirection; description: string } {
  const d = getSignal(id);
  return { label: d?.label ?? id, direction: d?.direction ?? "higher_is_better", description: d?.description ?? "" };
}

/* ── INGESTION: any domain becomes quantitative ─────────────────────────────
 * The engine's quantitative substrate is no longer "the nine health metrics". It is
 * every piece of MEASUREMENT-kind evidence, whatever domain it came from. This projects
 * that evidence into per-signal series — the identical shape the correlation engine
 * consumes — so a workout, a deep-work block, or a kept habit flows through the exact
 * same statistics as sleep or mood. Nothing here privileges health. */

/** Project measurement-kind evidence into per-signal series (any domain). */
export function seriesFromEvidence(evidence: Evidence[] = []): MetricSeries[] {
  const by = new Map<SignalId, MetricSeries>();
  for (const e of evidence) {
    if (e.kind !== "measurement" || !e.signalId || e.valueNorm == null) continue;
    if (!by.has(e.signalId)) by.set(e.signalId, { metric: e.signalId, points: [] });
    by.get(e.signalId)!.points.push({ metric: e.signalId, valueNorm: e.valueNorm, recordedAt: e.recordedAt });
  }
  for (const s of by.values()) s.points.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  return [...by.values()];
}

/** Union series by signal id, de-duping points that share a timestamp so a signal fed
 * from two sources (e.g. a health check-in and an imported measurement) isn't counted twice. */
export function mergeSeries(...groups: MetricSeries[][]): MetricSeries[] {
  const by = new Map<SignalId, MetricSeries>();
  for (const g of groups) for (const ser of g) {
    if (!by.has(ser.metric)) by.set(ser.metric, { metric: ser.metric, points: [] });
    by.get(ser.metric)!.points.push(...ser.points);
  }
  for (const ser of by.values()) {
    const seen = new Set<string>();
    ser.points = ser.points
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      .filter((p) => (seen.has(p.recordedAt) ? false : (seen.add(p.recordedAt), true)));
  }
  return [...by.values()];
}
