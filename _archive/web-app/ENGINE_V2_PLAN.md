# Synapse Engine V2 — Dependency Analysis, Risk Plan & Finalized Architecture

*Written as technical co-founder. I challenged my own V2 proposal and changed part of it (see §1). Grounded in a real dependency scan: 128 `MetricKey` references across 24 files; persistence is keyed by metric strings. That fact drives the whole safety strategy.*

---

## 1. Architecture self-critique — I was wrong that "Signal" is the atom

My V2 doc proposed **Signal** as the fundamental unit. Challenging it against the question *"what is the fundamental unit of evidence Synapse learns from?"* — Signal is too narrow. A Signal implies a **measured, repeated quantity**. But most of what defines a person is not a time series:

- a **commitment** ("run 3× a week"),
- a **stated preference** ("I hate morning meetings"),
- an **event** ("bombed the interview"),
- a **reflection** ("felt proud I shipped it").

If Signal is the atom, all of that is second-class — which just re-creates the health-metric bias in a new costume. So I'm revising the foundation:

**The atom is `Evidence` — a timestamped, sourced, domain-tagged thing Synapse learned about the person.** A Signal is now just the *registry of measurable dimensions* — the projection target for one KIND of evidence (measurements). The statistical engine runs over the measurement projection; the rest enriches the model directly.

```ts
type Domain = "health"|"work"|"study"|"fitness"|"habits"|"relationships"|"career"|"creativity"|"finance"|"growth";
type EvidenceKind = "measurement" | "event" | "statement" | "outcome";

interface Evidence {
  id: string;
  kind: EvidenceKind;
  domain: Domain;
  recordedAt: string;
  source: "checkin" | "assessment" | "tool" | "conversation" | "import";
  // kind === "measurement":
  signalId?: string; valueNorm?: number; raw?: number;
  // kind === "event" | "statement":
  text?: string; tags?: string[];
  // kind === "outcome":
  refId?: string;            // the experiment/commitment it resolves
  captureConfidence?: Confidence; // high for logged measurements; lower for model-inferred statements
}

interface SignalDef {        // registry of measurable dimensions (replaces METRIC_META entries)
  id: string; label: string; domain: Domain;
  kind: "rating"|"scalar"|"count"|"duration"|"boolean";
  direction: "higher_is_better"|"lower_is_better"|"neutral";
  cadence: "daily"|"weekly"|"event";
  toNorm: (raw:number)=>number; expectedRelations?: string[]; description: string;
}
```
`SignalSeries` is now a **derived projection** (`measurement`-evidence for one `signalId`), not a stored primitive. The stats engine keeps consuming `SignalSeries` unchanged. This is strictly stronger: qualitative capture the product already does (context notes, goals) becomes first-class Evidence instead of a side channel.

---

## 2. Person Model self-critique — a mind has epistemic states, not just topics

My V2 layers (Identity/Behavior/Preferences/Decisions/Progress) are *topical buckets* — still a data container. The instruction ("what it knows / believes / is uncertain about / is trying to learn / trusts / is questioning") is **epistemic**, and it's stronger. Crucially, the engine already produces every epistemic state; they're just scattered. The refined model organizes the mind by **certainty**, with topic as a tag:

| Epistemic state | Means | Backed today by |
|---|---|---|
| **Knows** | established facts | stated identity (name, goals, values); distilled `conclusions` |
| **Believes** | current best theories, with confidence | `beliefs` + `hypotheses` (supported/confirmed) |
| **Questioning** | theories under doubt | `hypotheses` (weakened/rejected) — "I changed my mind" |
| **Wondering** | actively trying to learn | `openQuestions` |
| **Trusts** | proven, durable | `habits` (established) + confirmed patterns |
| **Committed** | what the user is doing about it | experiments in flight + `commitments` (new) |

So `PersonModel` = an **epistemic state machine over domain-tagged Evidence**, with topical layers (Identity/Behavior/Preferences/Decisions/Progress) as facets. This is what makes a new engineer say "designed to understand people." Every existing `Mind` field maps into it (§4), so migration stays additive.

---

## 3. Dependency analysis (from the real scan)

**Types that must change** (`types/index.ts` — the root):
- `MetricKey` (enum) → `SignalId = string` + `SignalDef` registry. **128 refs / 24 files.**
- `MetricSeries`/`MetricPoint` → `SignalSeries`/`Observation` (alias during transition).
- `MetricMeta`/`METRIC_META` → `SignalRegistry`.
- `Mind` → `PersonModel`; `TrackedHypothesis.metrics`→`.signals`; `Habit.metric`→`.signalId`; `RecentChange.metric`; `WeeklyFocusReasoning.metric`; new `Evidence`, `Commitment`, `DecisionPattern`.

**Files that must change** (grouped by role):
- **Engine math (low conceptual risk, mechanical):** `lib/stats/index.ts`, `lib/correlations.ts`, `lib/surprise.ts`, `lib/hypotheses.ts`, `lib/intervention.ts`, `lib/focus.ts`, `lib/intelligence.ts`, `lib/metrics.ts`→`lib/signals.ts`, `lib/paths.ts`→`lib/focus-areas.ts`.
- **AI layer:** `ai/reasoning.ts`, `ai/pipeline.ts`, `ai/render.ts`, `ai/schemas.ts` (the closed `metricEnum`/`dailyMetricEnum` → registry-validated), `ai/prompts/index.ts` (phrasing off metadata).
- **Store:** `components/providers/health-store.tsx` → owns `CheckIn.metrics`, `Mind`, series derivation; the migration lives here.
- **APIs:** `app/api/report`, `app/api/focus`, `app/api/daily-plan`, `app/api/assessment-plan`, `app/api/profile-summary` (pass signals not metrics; mostly pass-through).
- **Components depending on the types:** `agent-console`, `dashboard/{cards,first-week,generated-dashboard,focus-of-week,curiosity,health-narrative,trend-chart}`, `daily/daily-checkin`, `assessments/{assessment-runner,task-renderers}`, `profile/understanding-evolution`, `synapse/explain-why`, `shell/notifications-bell`, `app/(app)/{stats,report,playbook}/page.tsx`.
- **Stores affected:** one — the localStorage blob under `synapse.recovery.v3` (single source; nothing else persists).

**Migrations required:** exactly one — an idempotent `migratePersonModel(snapshot)` in the store's `applySnapshot`. No server DB (Supabase holds the same JSON blob).

---

## 4. Data safety — how every user keeps everything

The whole strategy rests on one decision: **stable string ids.** `MetricKey` becomes `SignalId = string`, and the legacy nine keep their **exact current ids** (`"sleep_quality"`, `"fatigue"`, …), registered as `domain:"health"` signals. Consequence:

| Artifact | Stored as | Survives because |
|---|---|---|
| **Check-ins** | `CheckIn.metrics` keyed by `"sleep_quality"`… | ids unchanged → same keys resolve; also projected into `Evidence` (kind `measurement`) |
| **Hypotheses** | `hypothesis.metrics: ["attention",…]` | field aliased `.metrics`→`.signals`; values are the same strings |
| **Habits** | `habit.metric` | `.metric`→`.signalId`, value identical |
| **Experiments** | `experiment.metric` | identical string |
| **Association history** | `key: "lag:attention+sleep_quality"` | key format unchanged (built from same ids) |
| **Weekly reports** | `mind.weekly[wk]` (+ localStorage report cache) | shape unchanged; `focus.metric` id unchanged |
| **Beliefs/conclusions/open questions** | `mind.*` | copied verbatim into `PersonModel.knows/believes/wondering` |

`migratePersonModel` is **wrap-and-backfill, never rewrite**: wrap existing `Mind` fields into the epistemic model, backfill `domain:"health"` on derived series, synthesize `Evidence` from existing `checkIns`+`contextNotes` (so history isn't lost to the new atom), default-empty the new layers. Idempotent; guarded by a `schemaVersion` bump; old blobs still load via the existing `{...DEFAULT, ...loaded}` merge. **Unknown ids never crash:** any id seen in data but missing from the registry gets a generated fallback `SignalDef`.

Belt-and-suspenders: on first V2 load, snapshot the pre-migration blob to `synapse.recovery.v3.pre_v2` so a user can be rolled back byte-for-byte.

---

## 5. Risk analysis & rollback, per phase

Phases are ordered so each **compiles, preserves data, and runs** on its own.

**P1 — Type foundation + aliases + migration (invisible).**
Introduce `SignalId`/`SignalSeries`/`SignalRegistry` and `Evidence`; keep `type MetricKey = SignalId` etc. as deprecated aliases; register legacy 9; add `migratePersonModel` + pre-v2 backup.
- *Break:* migration corrupts the blob; alias mismatch breaks a type. *Why:* 128 refs. *Detect:* `tsc` must stay green; a migration unit-check that round-trips a real snapshot and asserts checkIns/hypotheses/habits counts unchanged. *Rollback:* aliases mean zero call-site changes to revert; restore `.pre_v2` blob.

**P2 — `Mind` → `PersonModel` (epistemic) via accessors.**
Rename type; expose `knows/believes/questioning/wondering/trusts/committed` as views over existing fields; wire `identity`/`preferences` from onboarding (already captured).
- *Break:* a surface reads `mind.hypotheses` directly and now gets undefined. *Detect:* tsc + grep for `mind.` call sites (10 files, enumerated). *Rollback:* keep `Mind` as a structural alias of `PersonModel` for one release.

**P3 — Generalize surprise expectedness + hypothesis phrasing off metadata.**
Replace the health `EXPECTEDNESS` table with derived expectedness (same-domain/cadence + `expectedRelations` + default); `phrasing()` uses `SignalDef.label`+`direction`.
- *Break:* rankings shift; phrasing reads awkwardly for a new signal. *Why:* heuristic change. *Detect:* golden-file test — feed the planted-signal synthetic dataset from earlier and assert the non-obvious lag still ranks #1 and noise still yields 0 ready-to-surface. *Rollback:* feature-flag `EXPECTEDNESS_V2`; revert to the table.

**P4 — Cadence-aware correlation + non-health ingestion.**
`buildMatrix` buckets by each signal's cadence; tools/check-in emit non-health `Evidence`.
- *Break (highest):* correlating mismatched cadences manufactures significance. *Why:* the one genuinely new math. *Detect:* a test that pairs a weekly signal with a daily one on random data and asserts it does **not** surface (FDR + n-thresholds hold); assert health-only users get byte-identical results to P3. *Rollback:* gate cadence logic; fall back to daily-only bucketing (current behavior) for `cadence:"daily"` signals — health path unchanged.

**P5 — Delete the enum, path system, health pair table; drop aliases.**
Only after all call sites migrated.
- *Break:* a missed reference to a deleted symbol. *Detect:* tsc (aliases removed → any straggler fails to compile) + full grep sweep. *Rollback:* re-add the alias; deletion is the only irreversible step, so it's last and gated on a clean sweep.

Cross-cutting detection every phase: `tsc --noEmit` green; the synthetic-data engine test (planted signal surfaces, noise doesn't, confidence rises with recurrence, habit graduates) must pass identically; a snapshot round-trip test proving no user artifact count changes.

---

## 6. Which parts stay identical vs must change

- **Identical (reused verbatim — the rigor):** `computeTrend`, `pearson`, `pValue`, `normCdf`, Benjamini-Hochberg selection, `corrConfidence`, `confidenceFromEvidence`, `decideStatus`, recurrence, `reviewExperiment`, habit graduation, salience/dedupe, safety pre/post-gates, the persistence mechanism.
- **Must change:** the type foundation (enum→registry+Evidence), `Mind`→epistemic `PersonModel`, obviousness prior (table→derived), the lens (`PathDef` conditions→focus areas/domains), cadence-aware bucketing, phrasing-from-metadata, ingestion (tools/check-ins emit cross-domain Evidence).
- **Deleted:** closed `MetricKey`/`metricEnum`, `PathDef` condition system, hardcoded health `EXPECTEDNESS`, `symptoms`-as-privileged, daily-only matrix assumption.

---

## 7. Future-engineer test & success criteria

A new engineer in two years sees: an `Evidence` atom (any domain), a `SignalRegistry` (health is one set of entries among many), a `PersonModel` organized by what Synapse *knows / believes / is questioning / is wondering / trusts / is committed to*, and a statistics core that never mentions health. They conclude: **"this was built to understand people."** Health reads as the first, best-instrumented domain — not the identity.

Success = strongest long-term foundation, not least code: rigor preserved (same tests pass), generality increased (new domains need only registry entries + evidence, no engine edits), assumptions reduced (no closed enum, no condition lens), nothing faked (cadence honesty enforced by the same FDR/n-gates).

---

## Recommendation

Approve this finalized architecture (note the two self-revisions: **Evidence as the atom**, and the **epistemic PersonModel**). Then I implement **P1 first** — invisible, tsc-verified, migration + pre-v2 backup — which de-risks everything after it and lets us prove "no user loses anything" before touching behavior. I will not begin P1 until you've signed off on §1–§2, since those are the decisions that are expensive to reverse.

---

## Amendment (co-founder review adopted) + P1 shipped

**Design changes accepted and encoded:**
- **Trajectory is first-class.** `Trajectory { statement, horizon, why }` — who the person is becoming, the objective the engine steers toward. Two users with identical evidence but different trajectories get different help.
- **Facets, not a single domain.** `Evidence.facets` (areas[], timeHorizon, people, goalRef, energy, importance, emotion). An interview failure is career AND confidence AND learning AND relationships — no forced single bucket. `domain` survives only as a signal-registry attribute, not as the organizing principle.
- **Architectural law** written into `types/index.ts`: no abstraction may exist merely because it was inherited from the health app; each must justify itself against today's product.
- The loop is **Evidence → Understanding → Intent(Trajectory) → Decision → Action → Learning**.

**P1 — SHIPPED (invisible, tsc-green, no data moved):**
- `types/index.ts`: added `Trajectory`, `Evidence` (+`EvidenceFacets`, `EvidenceKind`), `SignalId`/`SignalKind`/`SignalDef`; extended `Mind` with optional `trajectory` + `evidence`. Legacy metric types untouched.
- `lib/signals.ts`: the Signal Registry, seeded from the legacy health metrics with ids kept verbatim.
- `health-store`: persists `trajectory`/`evidence`; **one-time `synapse.recovery.v3.pre_v2` backup** on first load; old blobs backfill defaults via the existing merge → zero user loss.
- Onboarding captures the Trajectory from the aspiration; reasoning + chat now receive it and are instructed to steer toward it.

**Next: P2** — rename `Mind`→`PersonModel` and expose the epistemic views (knows / believes / questioning / wondering / trusts / committed) over the existing fields. Touches ~10 `mind.` sites; recommend a checkpoint before starting.

**P2 — SHIPPED (tsc-green, no data moved):**
- `types/index.ts`: `Mind` → `PersonModel` (interface renamed); `export type Mind = PersonModel` transitional alias keeps all ~10 call sites compiling.
- `lib/person-model.ts`: the mind as epistemic states — `epistemicView(pm)` derives **knows / believes / questioning / wondering / trusts / committed** purely from the existing substrate (no new storage, no migration). `understandingDepth(pm)` gives an honest "forming → developing → strong" read.
- "You" surface now leads with the **Trajectory** ("You're working to become: …, I weigh what I notice against that") and shows an honest depth line. Verified with a synthetic model: knows/believes/questioning/wondering/trusts populate correctly from real hypothesis statuses.

**Next: P3** — generalize the surprise obviousness prior + hypothesis phrasing off `SignalDef` metadata (remove the hardcoded health pair table), gated behind the golden-file test so ranking behavior is provably preserved.

**P3 — SHIPPED:** health obviousness table deleted from the engine; expectedness derived from signal metadata + domain relationship (same-domain = more expected, cross-domain = more surprising). Hypothesis phrasing sourced from the registry. Golden test passes (planted non-obvious lag ranks #1, obvious pair demoted, noise → 0).

**P4 — SHIPPED:** correlation is cadence-aware — each signal buckets by its registry cadence, so mismatched cadences never share a bucket and the engine refuses to correlate across them (no manufactured significance). Daily-health behavior byte-identical (regression verified).

**P5 — SHIPPED (with an honest boundary):** `SignalId` widened to open `string`; the Signal Registry now spans health/work/study/habits/fitness; every context note is captured as first-class `Evidence` (the atom), so the person model reasons over a whole life, not just metrics. Health `MetricKey` deliberately remains the **numeric correlation substrate** — the honest quantitative core — rather than force-widening 128 call sites right before a test.

**Deferred, and labeled (P5b — needs runtime QA, not a rush):** deleting the `MetricKey` enum entirely, replacing the `PathDef` health-condition lens with focus-area/domain weighting, and routing non-health *numeric* signals through correlation (`METRIC_META`→registry across 18 files). These are invisible-under-the-hood today (health copy already removed) and don't block the person-understanding MVP test; they're a deliberate, test-driven cleanup.

**Net:** the engine now reads as a person-understanding engine — Evidence atom (any domain), Trajectory as the objective, an epistemic PersonModel, a domain-general surprise engine, cadence honesty, all rigor preserved (same golden test). Health is one source of evidence, not the identity. tsc green; existing users' data intact (pre-v2 backup + additive migration).
