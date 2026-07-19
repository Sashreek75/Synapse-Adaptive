# Synapse Engine V2 — From Health Engine to Person Understanding Engine

*The rigor stays; the health assumption goes. This is the design; implementation follows in staged, tsc-verified phases. Grounded in the real current types (`MetricKey`, `MetricSeries`, `Association`, `SurprisingFinding`, `TrackedHypothesis`, `Habit`, `Mind`, and the `lib/` math).*

**Design principle:** the statistical machinery is *already* domain-agnostic. What's health-specific is (1) the closed `MetricKey` enum, (2) the hand-authored health obviousness table, (3) the health-condition "path" lens, and (4) the daily-only cadence assumption. Generalize those four; keep everything else.

---

## 1. What data model replaces health metrics?

The atom becomes a **Signal** — any measurable thing about the person, tagged with a domain. The fixed 9-metric enum is replaced by an open **Signal Registry**.

```ts
type Domain = "health" | "work" | "study" | "fitness" | "habits"
            | "relationships" | "career" | "creativity" | "finance" | "growth";
type SignalKind = "rating" | "scalar" | "count" | "duration" | "boolean" | "event";
type Direction  = "higher_is_better" | "lower_is_better" | "neutral";

interface SignalDef {                 // replaces METRIC_META entries
  id: string;                         // STABLE id — legacy ids kept verbatim (see §5)
  label: string;                      // "Sleep quality", "Deep-work hours", "Pages written"
  domain: Domain;
  kind: SignalKind;
  direction: Direction;
  cadence: "daily" | "weekly" | "event";
  unit?: string;
  toNorm: (raw: number) => number;    // → comparable 0..100 (ratings pass through; durations cap; counts scale)
  description: string;
  expectedRelations?: string[];       // optional: signal ids this is *obviously* related to (feeds surprise, §2)
}

interface Observation {               // replaces MetricPoint
  signalId: string;
  valueNorm: number;                  // 0..100, comparable across kinds
  raw?: number;                       // original (hours, count, 1-5)
  recordedAt: string;
  source: "checkin" | "assessment" | "tool" | "conversation" | "import";
}

interface SignalSeries { signalId: string; domain: Domain; points: Observation[]; }  // replaces MetricSeries
```

Health metrics don't disappear — they become **registered health-domain signals** (`sleep_quality`, `fatigue`, … with `domain: "health"`). New domains are just new registry entries: `work.deep_work_hours` (duration), `study.focused_minutes` (duration), `habits.meditated` (boolean), `creativity.words_written` (count). The engine never branches on domain; it reasons over `SignalSeries` + `SignalDef` metadata.

The **Person Model** stops being a UI idea and becomes the engine's top object — `Mind` is renamed and widened into it:

```ts
interface PersonModel {              // replaces Mind
  identity:    { aspiration?: string; goals: string[]; values: string[] };        // qualitative
  behavior:    { series: SignalSeries[]; hypotheses: TrackedHypothesis[];         // quantitative + theories
                 associationHistory: AssociationSnapshot[] };
  preferences: { coachingStyle?: string; proactivity?: string; learned: string[] };// stated + learned
  decisions:   DecisionPattern[];                                                  // emergent, low-confidence
  progress:    { experiments: ExperimentRecord[]; habits: Habit[]; commitments: Commitment[] };
  memory:      { beliefs: Belief[]; conclusions: string[]; openQuestions: OpenQuestion[];
                 weekly: Record<string, WeeklyReasoning> };
}
```
Every observation now writes to at least one layer, and each subsystem must justify which layer it strengthens — the "am I learning the person, or only their health?" test becomes structural.

---

## 2. What abstractions survive (the crown jewels)?

All of the statistical honesty survives essentially **unchanged** — it was never health-specific:

- **Trend math** (`computeTrend`: least-squares slope, volatility, baseline).
- **Confidence ceilings** (data-quality → max confidence; model may only lower).
- **Correlation engine** (Pearson, next-day **lag**, best/worst **contrast**) + **p-values + Benjamini-Hochberg FDR** + n-thresholds.
- **Surprise engine** (surprise = non-obviousness × strength × recurrence × change), **recurrence gate**, "earn the right to surface."
- **Hypothesis lifecycle** (forming→supported→confirmed / weakened→rejected, evidence counts, `confidenceFromEvidence`, "I changed my mind").
- **Experiments → outcomes → habit graduation.**
- **Memory** (beliefs, conclusions, open questions, weekly reasoning) and its persistence mechanism.
- **Safety** (crisis pre-gate, content post-gate) and **intervention gate** (rare experiments, role selection).

The **obviousness prior** survives conceptually but must generalize (§6): instead of a hand-authored health-pair table, expectedness derives from (a) same-domain same-day = more expected, cross-domain or lagged = more surprising, (b) each signal's optional `expectedRelations`, (c) a neutral default. Same behavior ("demote the obvious"), no health hardcoding.

---

## 3. What gets renamed

| Now (health) | V2 (person) | Note |
|---|---|---|
| `MetricKey` (closed enum) | `SignalId` = `string` (validated vs registry) | the pivotal change |
| `MetricSeries` / `MetricPoint` | `SignalSeries` / `Observation` | + `domain`, `source`, `raw` |
| `METRIC_META` / `metricLabel` | `SignalRegistry` / `signalLabel` | registry lookup |
| `goalMetricsForPath` | `prioritySignalsFor(person)` | driven by focus areas, not a condition |
| `PathDef` / `getPath` / "path" | `FocusArea` + `Domain` weighting | condition-lens → life-domain lens |
| `Mind` | `PersonModel` | widened to 5 layers |
| `TrackedHypothesis.metrics` | `.signals` | string ids, may span domains |
| `ExperimentRecord.metric` | `.signalId` | — |
| `Habit.metric` | `.signalId` | — |
| `computeAssociations` inputs | (same fn, `SignalSeries`) | math identical |
| health-store `series`/`recentChanges` | signal-store equivalents | same derivation |

Routes, component names, and the `synapse.recovery.v3` storage key stay (see §5).

---

## 4. What should be deleted

- **The closed `MetricKey` enum** and the `metricEnum` Zod schema — replaced by registry-validated string ids. This is the single assumption that says "this is a health app."
- **The health-condition `PathDef` system** (`recovery_injury`, `recovery_neuro`, `provider_monitoring`, `athlete`, …) as the organizing lens. Keep the *idea* of a lens (which signals to emphasize) but derive it from the person's focus areas/domains, not a diagnosis.
- **The hardcoded health `EXPECTEDNESS` pair table** — replaced by the derived expectedness above.
- **`symptoms` as a privileged axis** and any provider/condition-shaped fields (`conditionLabel`, `recoveryStage`) as first-class — demote to optional health-domain signals/metadata.
- **`daily`-only matrix assumption** in `buildMatrix` — replaced by cadence-aware bucketing (§6).

Nothing statistical gets deleted. Only health *assumptions*.

---

## 5. Migration strategy (zero user loss)

The migration is **additive and mostly identity**, because signals are a superset of metrics and we keep ids stable.

1. **Keep legacy ids verbatim.** Register the 9 existing metrics as health-domain `SignalDef`s using their *exact current ids* (`"sleep_quality"`, `"fatigue"`, …). Every stored check-in (`CheckIn.metrics` keyed by those strings) and every `mind` reference (`hypothesis.metrics`, `associationHistory.key`, `habit.metric`) resolves unchanged. New signals are namespaced (`work.deep_work_hours`) so they never collide.
2. **Storage key unchanged** (`synapse.recovery.v3`). Add a one-time, non-destructive `migratePersonModel(snapshot)`: wrap the existing `Mind` fields into the `PersonModel` layers, backfill `domain: "health"` on existing series, default empty `identity/preferences/decisions`. Idempotent; runs on load; old blobs still parse via `{...DEFAULT, ...loaded}` (the pattern already in `applySnapshot`).
3. **Type aliases during transition.** `type MetricKey = SignalId` and `type MetricSeries = SignalSeries` as deprecated aliases so the refactor lands incrementally without a big-bang; remove aliases once call sites migrate.
4. **Registry seeds from data.** Any signal id seen in stored observations but missing from the registry gets a generated fallback `SignalDef` (label from id, domain inferred from namespace, neutral direction) — so a user who somehow has extra data never crashes the engine.

Result: an existing user opens V2 and their months of check-ins, confirmed theories, and habits are intact — now sitting inside a person model that can also hold non-health signals.

---

## 6. Identical vs must-fundamentally-change

**Remain byte-for-byte identical (domain-agnostic already):**
- `computeTrend`, `pearson`, `pValue`, `normCdf`, Benjamini-Hochberg selection, `corrConfidence`, `confidenceFromEvidence`, `decideStatus` transitions, recurrence logic, `reviewExperiment` outcome math, habit graduation thresholds, salience/dedupe, safety gates.

**Must fundamentally change:**
1. **The type foundation** — `MetricKey` enum → open `SignalId` + `SignalRegistry`. Ripples everywhere but mechanically (rename + registry lookups). *Biggest, but low-conceptual-risk.*
2. **Obviousness/expectedness** — health-pair table → derived (domain-relationship + `expectedRelations` + default). *Preserves "demote the obvious," removes health hardcoding.*
3. **The lens** — `PathDef` conditions → `FocusArea`/`Domain` weighting that sets `prioritySignals`. *Person-first, not diagnosis-first.*
4. **Cadence alignment** — `buildMatrix` (daily) → bucket observations by each signal's cadence (day/week) and correlate only aligned buckets. Low-frequency signals honestly yield fewer pairs → lower confidence via the *existing* n-thresholds. *Genuinely new code; the one place to be careful not to fake significance across mismatched cadences.*
5. **Hypothesis/experiment phrasing** — `lib/hypotheses.ts` `phrasing()` health-flavored templates → domain-neutral phrasing from `SignalDef.label` + `direction`. *Wording generated from metadata, not hardcoded.*
6. **Ingestion** — the daily check-in and tools write `Observation`s across domains (progress notes can become qualitative signals; the focus timer can emit a `work.focus_minutes` signal). *This is what finally lets the quantitative engine speak about non-health domains — the seam called out in the last audit.*

---

## Honest risks & non-fakes

- **Cross-cadence correlation is the real hazard.** Correlating weekly finance against daily mood must not manufacture significance — the fix is strict bucket alignment + unchanged FDR/n-thresholds, so sparse signals simply stay "low confidence." I will not relax the stats to make new domains look smart.
- **Cross-domain expectedness is a heuristic, not ground truth.** Marking cross-domain links "more surprising" is defensible but should be tunable and, later, learnable — not presented as certainty.
- **Sparse new domains will feel quiet for weeks** (same cold-start as health). That's honest, and the first-week experience already sets that expectation.

---

## Recommended implementation phases (post-approval)

- **P1 — Type foundation (no behavior change):** introduce `SignalRegistry` + `SignalId`/`SignalSeries` with legacy aliases; register the 9 health signals with current ids; `migratePersonModel`. Ships invisibly; tsc-verified; users unaffected.
- **P2 — Rename `Mind`→`PersonModel`** and slot existing fields into layers; wire `identity/preferences` from the new onboarding (already captured).
- **P3 — Generalize surprise expectedness + hypothesis phrasing** off metadata.
- **P4 — Cadence-aware correlation** + let tools/check-in emit non-health signals.
- **P5 — Delete** the enum, path system, and health pair table once call sites are migrated.

Each phase compiles and preserves memory on its own; the engine is never left broken between phases.

---

*Verdict: this is a generalization, not a rewrite. ~70% of the engine (all the math and lifecycle) is reused verbatim; the change is dissolving four health assumptions into a Signal + Person Model foundation. Two years from now the codebase reads as "a person-understanding engine that happens to support health as one domain" — which is the point.*
