# Engine V2 - P5b: The Human Understanding Engine

Required pre-implementation self-review, then the completion plan. The manifesto is
the source of truth. The test for every abstraction: "Would I invent this if Synapse
had been created today?" If no, it is replaced - not because it is old, because it no
longer represents the product.

## The single principle

The engine should no longer distinguish between health, work, study, habits, fitness,
relationships, career, or growth. Those are sources of evidence about one person. The
engine should distinguish only two things:

1. Evidence measurable enough to support statistical reasoning.
2. Evidence too sparse or subjective, which stays qualitative and honestly uncertain.

That is the only architectural distinction that may exist.

## Required self-review

**1. Where does the architecture still secretly assume Synapse is a health product?**
One place, and it is the decisive one: **ingestion.** The correlation/surprise/hypothesis
machinery is already domain-neutral in its logic, but it is only ever *fed* series built
from the nine health check-in metrics (`deriveSeries(checkIns)`). No other domain can
become quantitative, because nothing else is ever handed to the engine. Secondary tells:
`correlations.ts` reads `METRIC_META[x].direction` (a nine-key health table) and hardcodes
health anchor metrics (`mood`, `attention`, `fatigue`) for contrast; `intelligence.ts`,
`focus.ts`, `reasoning.ts`, `pipeline.ts` index the same health table and type goals as
`MetricKey[]`.

**2. Which abstractions exist only because of the original implementation?**
`MetricKey` as the type of everything measurable (it should be one *subset* of `SignalId`).
`METRIC_META` as the source of direction/label for the engine (the Signal Registry is the
real source now). `goalMetricsForPath` as the *only* way goals enter the engine (goals
should be able to come from the trajectory and evidence too). A single `Trajectory.statement`
(a person builds several identities at once).

**3. Which parts are now more elegant?**
Ingestion collapses to one idea: evidence of kind `measurement` projects to a series,
regardless of domain, and the *same* n>=8 + FDR + confidence-ceiling gate decides whether it
earns a conclusion. "Health vs work vs study" disappears from the engine entirely; there is
only "measurable enough / not yet."

**4. Which parts became more complicated?**
The consumer files must stop assuming a signal is one of nine (registry-safe direction
lookups, copy tables keyed by `SignalId` that degrade to a generic fallback for signals they
have no entry for). This is honest complexity: the price of not privileging a domain.

**5. Can complexity be removed without sacrificing rigor?**
Yes: the hardcoded contrast anchors and the health obviousness assumptions go, replaced by
coverage- and goal-driven anchor selection and registry-derived expectedness. No statistical
threshold is relaxed - rigor is *preserved*, health-specificity is *removed*.

**6. Would a new engineer in two years infer this was built as a health app?**
Before P5b: yes - the engine can only measure health. After P5b: no - health is one set of
registered signals with rich copy, sitting beside work/study/habits/fitness, all flowing
through identical statistics. Health keeps its provider-escalation safety net as a *domain*
feature, not as a privilege over the engine.

## What P5b changes

- **Types**: measurable fields widen from `MetricKey` to `SignalId` (string). `MetricKey`
  survives only as the health subset (check-ins, `METRIC_META`). `SignalSeries`/`SignalPoint`
  become the canonical names; `MetricSeries`/`MetricPoint` are aliases.
- **Ingestion**: `seriesFromEvidence()` projects every `measurement`-kind Evidence into
  series by `signalId`, unioned with the health check-in series. Any recurring measurable
  behavior in any domain becomes quantitative input the moment it exists.
- **Engine**: `correlations.ts` uses the registry (`signalDirection`, `signalLabel`) not
  `METRIC_META`; contrast anchors are chosen by goals + coverage, not by health metric names.
  `surprise.ts`/`hypotheses.ts` type over `SignalId`.
- **Consumers**: registry-safe lookups everywhere; copy tables become `Record<SignalId, ...>`
  that fall back gracefully; goals accept any `SignalId`.
- **Trajectory**: gains `identities[]` so a person can be building "founder", "father",
  "athlete" at once, each with priority and status, evolving over time. `statement` stays as
  the primary identity for back-compat.
- **Person Model** becomes the center: momentum, drift, reliable behaviors, uncertain
  patterns, what Synapse changed its mind about, and the highest-leverage next move - all
  derived, all honest about "I don't know yet."

## The honesty guarantee (non-negotiable, unchanged)

Every new evidence type inherits the exact same discipline: confidence ceilings, recurrence
requirements, lag analysis, p-values, Benjamini-Hochberg correction, hypothesis promotion
and demotion, surprise ranking, experiment lifecycle, habit promotion. One workout teaches
nothing (n<8 -> low, never surfaced). Two study sessions teach nothing. Sparse evidence keeps
confidence low. If the engine cannot honestly support a conclusion it says "I don't know yet."
No thresholds are lowered to make new domains "work" - that would be faking capability, which
is forbidden. A cross-domain correlation is allowed to exist only when the data honestly
supports it.

## SHIPPED — verified (tsc: 0 errors)

- **Types widened** to `SignalId`; `MetricKey` survives only as the health subset. `SignalSeries`/`SignalPoint` are the canonical names. `Trajectory` now holds `identities[]`.
- **Ingestion generalized**: `seriesFromEvidence()` + `mergeSeries()` route every measurement-kind Evidence, any domain, into the correlation substrate alongside health check-ins. Wired in the store's `series`.
- **Engine de-healthed**: `correlations.ts` reads the registry (`signalDirection`/`signalLabel`), and contrast anchors are chosen by goal + coverage, never by health metric names. `surprise.ts`/`hypotheses.ts`/`stats`/`reasoning`/`pipeline`/`focus`/`intelligence` all type over `SignalId` with registry-safe, gracefully-degrading copy.
- **Person Model at the center**: `personSnapshot()` derives becoming / commitments / reliable / uncertain / changedMind / momentum / drifting / highestLeverage; `trajectoryView()` reads multiple identities by priority. Returns null / empty ("I don't know yet") when understanding is unearned.

Verification results:
- GOLDEN (health): planted sleep->attention next-day lag still ranks #1. PASS (no regression).
- CROSS-DOMAIN: a planted `deep_work_hours`(work) -> `attention`(health) next-day lag surfaces on top through the identical FDR/confidence machinery. PASS.
- HONESTY: a sparse signal (`trained`, 3 data points) produces NO correlation — no faked significance. PASS.
- INGESTION: measurement Evidence projects to series; statement Evidence excluded; domains union. PASS.
- SAFETY: `signalDirection()` returns a safe default for an unregistered signal (never crashes). PASS.
- PERSON MODEL: multi-identity ordering, momentum, and "turn a confirmed pattern into a habit" leverage all correct; honest null when unearned. PASS.

**Answer to audit Q6, now:** a new engineer would not infer a health origin from the engine. Health is one registered domain among work/study/habits/fitness, all flowing through identical statistics. The only distinction the engine makes is measurable-enough vs. not-yet.
