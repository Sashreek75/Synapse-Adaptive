# Synapse — Thinking-Layer Upgrade: Stage 1 Architecture Spec (no code yet)

*North star: Synapse should not merely remember what you told it — it should discover how you operate by paying attention. This spec defines the exact, minimal changes to make that real by **extending** existing machinery. Nothing here is built. Awaiting approval.*

## Governing constraints carried in
The allocation milestone is preserved unchanged (protect/maintain/park/watch; allocation ≠ execution ≠ action; no matrix; no score). This layer **feeds** allocation, never replaces it. Reuse existing infra; build no personality engine, no second person model, no hidden profile.

---

## The whole loop in one line
`conversation → [[observe]] tag → mind.evidence (synced) → deterministic behavioral-hypothesis pass (existing lifecycle) → behavioralContextBlock injected everywhere → sharper allocation / PFT / clarity / coaching → outcomes → more observation.`

Every step below reuses something that already exists.

---

## 1. Observation schema (the atom)
**Tag the model appends, invisibly, at most ~1–2 per reply, only when a concrete behavior is worth remembering:**
```
[[observe: <pattern-key> | <+|-> | <one concrete, specific observation>]]
```
- `pattern-key`: kebab slug, e.g. `reopened-decision`, `stalls-on-ambiguity`, `commits-when-step-concrete`, `enthusiasm-no-allocation`, `abandons-after-one-setback`, `seeks-reassurance-post-decision`, `circular-uncertainty`.
- `+|-` (optional, default `+`): **polarity** — does this support or contradict the pattern? ("committed fast once the step was concrete" = `-` against `stalls-on-ambiguity` is wrong; it's `+` for `commits-when-step-concrete`). Polarity is what lets contradictions *weaken* a hypothesis (invariant 12).
- observation text: **concrete and specific**, never an adjective. Good: "Returned to the college decision a 4th time after saying last week it was settled." Bad: "Indecisive."

**Becomes this Evidence record (written to the already-synced `mind.evidence`):**
```
Evidence {
  id, recordedAt,
  kind: "event",
  source: "conversation",
  text: <observation>,
  captureConfidence: "low",           // a single observation is always low
  facets: { patternKey, observationPolarity, importance }
}
```
**Type change (additive, backward-compatible):** add to `EvidenceFacets` two optional fields — `patternKey?: string` and `observationPolarity?: "support" | "contradict"`. Nothing else in the type changes; existing evidence records stay valid.

## 2. Parser
New `lib/observations.ts` → `extractObserveTag(text)`, mirroring the existing `extractRecTag` / `extractPrincipleTag` exactly (regex `/\[\[\s*observe\s*:\s*([^\]]+?)\s*\]\]/i`, split on `|`, strip the tag from what the user sees). Returns `{ patternKey?, polarity, note?, cleaned }`. **Called in the two places that already parse tags** — `components/agent/agent-console.tsx` and `components/companion-presence.tsx` — in the same post-reply handler that runs `extractRecTag`/`extractPrincipleTag`/`extractMindShiftTag` today.

## 3. Write path (into the synced mind)
Add `addObservation(patternKey, note, polarity)` to the health-store, **modeled line-for-line on the existing `addContextNote`** (which already mints an `Evidence{source:"conversation"}` into `mind.evidence` and calls `persist`). Expose it on `useHealth()` and destructure it in the two chat components. No new storage system — it lands in the exact log that already syncs to Supabase and caps at 500.

## 4. Behavioral-hypothesis pass (reuse the lifecycle, don't rewrite it)
New pure function in `lib/observations.ts`: `deriveBehavioralHypotheses(evidence, existingHypotheses)`.
- Filter `evidence` to `source:"conversation"` with a `patternKey`; group by key.
- `support` = count of `+` observations, `contradict` = count of `-`.
- **Recurrence gate:** a key with only 1 observation stays a raw observation (never a hypothesis) — invariant 11.
- Represent a behavioral hypothesis as a **`TrackedHypothesis`** (the existing type): `id: "bhyp_<key>"`, `metrics: []`, `originAssociationKey: "obs:<key>"`, `supportingObservations/contradictingObservations` from the counts, `confidence` via the **existing** `confidenceFromEvidence(support, contradict, ceiling)`.
- **Ceiling capped at `"moderate"`** for behavioral hypotheses — conversation alone can never make Synapse "highly confident" about who someone is (invariant 13, depth-scales-with-evidence). Only cross-signal corroboration (behavior + execution outcomes) could later justify more, and that's out of scope now.
- Status via the **existing** demote-fast rules (contradiction weakens/rejects faster than support confirms).
- Runs inside `addObservation` (cheap, deterministic) so `mind.hypotheses` updates and persists immediately, and again available to the weekly pass.

**What is NOT reused:** the metric-correlation input path (`SurprisingFinding` → `updateHypotheses`) is untouched and stays frozen. This is a *parallel input* into the same hypothesis store, not a rewrite.

## 5. Persistence boundary (and the one real fork)
- Observations + behavioral hypotheses live in **`mind`** → synced across devices. ✅ (invariant 18).
- **Fork — where a *graduated durable truth* lives.** The `principles` store is device-local (not in the synced snapshot). To honor invariant 18, a confirmed behavioral truth should NOT graduate only into local principles. **Recommended:** represent it as a **`Belief` in `mind.beliefs`** (existing type, already synced) — e.g. `{ statement: "You commit easily once ambiguity is reduced; the bottleneck is choosing what to eliminate.", strength: "moderate" }` — and have the context block read durable truths from there. Optionally mirror into the local `principles` store purely for the "Who you're becoming" UI, with `mind` as source of truth. **Alternative:** widen the cloud snapshot to include the principles store. *Your call before I build — I recommend Beliefs-in-mind (no new synced field, reuses an existing type).*

## 6. Reasoning integration (existing injection points only)
New `behavioralContextBlock()` in `lib/observations.ts`, injected into chat + orb **right beside `principlesContextBlock()`** (same context array). Content, held explicitly as hypothesis, never fact:
```
WHAT I'M NOTICING ABOUT HOW THEY OPERATE (observed patterns — hypotheses, not facts; the user can correct these):
- [observed 3x, moderate] Commits quickly once the next step is concrete; stalls when it's ambiguous.
- [observed 2x, low] Reopens settled decisions when several options stay open.
Use these to reason better, and — only when specific, useful, and earned — surface one as "I've noticed X across several moments — does that fit?" Never declare a trait. Answer their actual question first.
```
- **Allocation:** the same block informs the charter's existing "expected-return / execution" factor — e.g. "Startup deserves attention, but its next step is ambiguous and that's where you stall, so the high-leverage move is to *clarify the action*, not raise the allocation." (Reasoning changes, not a score.)
- **PFT upgrade (§11 of your prompt):** extend `pftContextBlock` to add, when a behavioral pattern supports it, a **most-likely bottleneck** + coaching implication — `Follow-through: medium · likely bottleneck: ambiguity · make the first step concrete rather than adding pressure.` Interpretable, not a numeric model.
- **Clarity/doubt (§9–10):** a charter directive (below) plus the behavioral patterns for `circular-uncertainty` vs `productive-uncertainty` let Synapse name the loop.

## 7. J decision-quality persistence (the missing write path)
New tag `[[assess: <weekKey> | good|bad|uncertain | <what was misjudged, short>]]`, parsed by `extractAssessTag` (same pattern), which resolves the allocation for that week (`loadAllocations()` by `weekKey`, else `priorAllocation`) and calls the **already-built** `assessAllocationDecision(id, quality, note)`. This lights up the aggregate calibration lines already implemented and tested in `lib/allocations.ts`. **Honest caveat:** the allocations store is device-local; per your invariant 18 allowance, decision-quality memory is acknowledged as local, not part of the cross-device person model. (Widening it to sync is a separate, optional step.)

## 8. Identity change (charter — this is a *philosophy* change, per your point 1 & 17)
Add a tight block to `ai/personality.ts` (bump version), placed in the relationship/HOW-YOU-THINK section, covering: (a) **understand, don't just store** — notice how they ask/hesitate/avoid/reopen/contradict/emphasize as OBSERVATIONS; (b) **observe → hypothesize → test → never declare**; (c) **question behind the question** — offer it as a tentative fork ("you might be asking whether it's still worth it — or whether you're frustrated with *how* you're pursuing it; which is closer?"), never a presumption; (d) **answer first** — person-understanding sharpens the answer, never replaces it (invariant 15); (e) **surface only when earned** — specific, evidence-backed, useful now, always "does that fit?", and correction is welcome evidence; (f) **specificity over profundity** (invariant 20). Plus two lines in the INVISIBLE MACHINERY list documenting `[[observe:]]` and `[[assess:]]`.

## 9. Safeguards → invariants (built in, not bolted on)
- **9 obs≠inference / 10 inference≠fact:** the tag captures observations; hypotheses are labeled as such; the context block says "hypotheses, not facts"; charter forbids declaring traits.
- **11 one obs ≠ a person:** recurrence gate (≥2) before any hypothesis.
- **12 contradiction weakens:** polarity + existing demote-fast lifecycle.
- **13 depth needs evidence:** behavioral confidence ceiling capped at moderate; Levels 1→4 language in the charter.
- **14 user can correct:** correction becomes a `-` observation that weakens the hypothesis.
- **15 answer first:** explicit charter rule.
- **16 no clinical / 17 no hidden profile:** charter boundary (no diagnosis/subconscious/clinical labels); everything is inspectable in "Who you're becoming"; no adjectives stored.
- **18 persists cross-device:** everything durable lives in synced `mind` (pending the §5 fork).
- **19 insight ties to a decision/action:** the block instructs surfacing only when useful *now*; it feeds allocation/PFT/clarity.
- **20 no manufactured profundity:** concrete-observation schema; "specificity beats eloquence" in charter.

## 10. Exact file change list (for approval)
| # | File | Change | Risk |
|---|------|--------|------|
| 1 | `types/index.ts` | add `patternKey?`, `observationPolarity?` to `EvidenceFacets` | trivial, additive |
| 2 | `lib/observations.ts` (new) | `extractObserveTag`, `extractAssessTag`, `deriveBehavioralHypotheses`, `behavioralContextBlock` | isolated |
| 3 | `components/providers/health-store.tsx` | add `addObservation(...)` (clone of `addContextNote`); expose on context | low |
| 4 | `components/agent/agent-console.tsx` | parse `[[observe]]`/`[[assess]]`; inject `behavioralContextBlock()`; call `addObservation` | low |
| 5 | `components/companion-presence.tsx` | same as #4 for the orb | low |
| 6 | `lib/pft.ts` | add optional most-likely-bottleneck line from behavioral hypotheses | low |
| 7 | `ai/personality.ts` | identity block + 2 tag docs; version bump | medium (charter) |
| 8 | `lib/allocations.ts` | (already built) — only wire the `[[assess]]` resolver in #4/#5 | none |
| 9 | `mind.beliefs` graduation (per §5 fork) | represent durable behavioral truth as a synced Belief | pending your decision |

Frozen, untouched: the FDR/correlation statistics engine and its `SurprisingFinding → updateHypotheses` path; REASONING/report JSON schemas; the metric check-in pipeline; the allocation contract; `goal-plan` as action selection.

## 11. Staging (this doc = Stage 1)
- **Stage 2** — capture path only: `[[observe]]` → `addObservation` → `mind.evidence` → verify it persists and syncs. Nothing reasons on it yet.
- **Stage 3** — `deriveBehavioralHypotheses` over the evidence log, into `mind.hypotheses` (reuse lifecycle).
- **Stage 4** — inject `behavioralContextBlock` into chat/orb + the PFT-bottleneck + allocation reasoning.
- **Stage 5** — `[[assess]]` → `assessAllocationDecision` (J persistence).
- **Stage 6** — live conversational tests A–J + allocation perturbation probes. **These require a running model — I cannot fabricate transcripts; you run them, I fix what they expose.**
- **Stage 7** — fix only the smallest layer any failing test implicates.

## Two decisions I need before writing code
1. **§5 persistence fork:** graduate durable behavioral truths into **synced `mind.beliefs`** (my recommendation), or widen the snapshot to sync the local principles store?
2. **Scope of this build:** all of Stage 2–5 in one pass, or **capture-first** (Stage 2 only — prove the observation signal is real and useful before letting it drive hypotheses/decisions)? I lean capture-first, consistent with your "prove behavior in the live product" instruction two milestones ago.

No code written. On your approval (and answers to the two forks), I'll start with the stage you choose and report at each checkpoint.
