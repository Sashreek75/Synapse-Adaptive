# Synapse — Person-Understanding Audit (Phase 1, no code)

*North star: "Synapse should not merely remember what you told it about yourself. It should gradually discover how you operate by paying attention to you."*

**Bottom line up front:** Synapse already has ~80% of the substrate this upgrade needs — a real hypothesis lifecycle, a principles/mind-shifts store, an atomic evidence log that already models conversational statements, and a cloud-synced person model. It does **not** need a new "personality engine." It needs one **input path** (turn conversational behavior into evidence), one **loop extension** (let that evidence form/revise behavioral hypotheses the way metric findings already do), a **PFT upgrade** (from "how likely" to "what determines follow-through"), and a **persistence fix** (behavioral learning is currently device-local). Build nothing yet.

---

## 1. What Synapse currently learns *explicitly*
From onboarding and direct statements: `profile` (displayName, aspiration → `trajectory.statement`, `primaryChallenge`, focus areas, **accountability preference** — explicit coaching-style evidence), goals (title/why/priority/timeline/**dueDate**), and anything the user types. All persisted.

## 2. What it currently observes *implicitly* (behavior → stored)
Real but narrow and mostly **numeric/outcome-based**:
- **Commitments** (kept/partial/broken) → `lib/commitments`.
- **Focus sessions** (started/completed, time-of-day) → `lib/focus-session`.
- **Strategy outcomes** (worked/failed tallies) → `lib/decisions`.
- **Allocation calls + auto-derived execution** → `lib/allocations` (new).
- **Check-in metrics** → correlations → **SurprisingFindings** → the **hypothesis lifecycle** (`lib/hypotheses`).
- **Activity witness** (events like "opened", "session ended") → `lib/activity`.
- **Presence outcomes** (which reach-outs landed) → `lib/presence`.

## 3. What conversational signals are currently **lost** (the core gap)
The transcript *is* persisted (`Snapshot.chat`), but nothing extracts **behavioral signals** from it. Today the only things a conversation writes back to the person model are three **spontaneous, rare tags** the model may choose to emit: `[[rec:]]`, `[[principle:]]`, `[[mindshift:]]`. There is **no structured detection or capture** of:
- repeated reopening of a settled decision;
- the same question asked in different forms (need-for-certainty);
- enthusiasm-for-a-goal vs repeated avoidance at the *same step*;
- contradiction between stated priority and allocated attention;
- ambition-vs-sustained-execution mismatch;
- doubt markers (qualification, "but what if", reassurance-seeking, abandoning a plan after one setback);
- the **question behind the question**.

So Synapse can *react* to these in the moment (the charter tells it to), but it **cannot accumulate them into evidence** — the observation evaporates when the session ends unless the model happened to fire a principle/mindshift tag.

## 4. What the Person Model already represents (`types.PersonModel` / `Mind`)
Rich and directly reusable: `beliefs[]` (weak/moderate/strong), `conclusions[]`, `openQuestions[]`, `hypotheses[]` (**TrackedHypothesis** with status, confidence, support/contradict counts, `evidenceLog[]`), `habits[]`, `playbook[]`, `trajectory`, and an **atomic `evidence?: Evidence[]`** log. `lib/person-model.ts` already projects this into epistemic views (knows / believes / questioning / wondering / trusts / committed) and a `personSnapshot` (momentum / drifting / changedMind / highestLeverage). **This is a genuine mind, not a data bag.**

## 5. What the Evidence Engine can already represent (two distinct things — important)
- **`lib/evidence.ts` (`EvidenceItem`)**: a **read-only, derived, ephemeral** view — it recomputes citable statements from existing stores each turn for the context block. Stores nothing. Already enforces the **KNOWN vs OBSERVED vs HYPOTHESIS** discipline and an L1–L5 confidence ladder.
- **`types.Evidence` (atomic log on `mind.evidence`)**: a **persisted** record with `kind: "measurement" | "event" | "statement" | "outcome"`, `source: "checkin" | "assessment" | "tool" | "conversation" | "import"`, optional `captureConfidence`, capped at 500, **cloud-synced**. Crucially, **`kind:"statement"` + `source:"conversation"` already exist in the schema** — the atomic log was designed to hold conversational observations. Today only one writer appends to it (health-store), fed by check-ins — **not conversation.** This is the single most important finding: **the storage for behavioral observation already exists and is unused by chat.**

## 6. What PFT already captures — and its ceiling
`lib/pft.ts` estimates a single follow-through likelihood (band high/medium/low) from promise keep-rate + momentum + focus completion, and tells the model how to coach for that band. It answers **"how likely?"** It does **not** answer **"what *determines* follow-through for this person?"** (clarity vs accountability vs ambiguity vs ambition vs emotional resistance vs no-immediate-reward). PFT is currently **determinant-blind** — exactly your point 8.

## 7. What persists between sessions — and the asymmetry
- **Cloud-synced (survives new device):** the `Snapshot` = `profile`, `checkIns`, `chat` transcript, `contextNotes`, `experiments`, `spaces`, and the whole **`mind`** (beliefs, hypotheses, openQuestions, playbook, habits, trajectory, **atomic evidence[]**).
- **Local-only (per-device, lost on a new device):** `principles`, `mind-shifts`, `decisions` ledger, **`allocations`**, `commitments`, `goals`, focus history — each a separate `synapse.*` localStorage key, **not in the Snapshot**.
- **The asymmetry:** the metric-derived mind syncs, but much of the **behavioral/relational learning (principles, allocation memory, decision ledger) is device-local.** Any "how you operate" learning we add should live in the synced `mind` (e.g., the atomic evidence log + hypotheses), or the sync boundary should be widened — otherwise the understanding doesn't follow the person.

## 8. Where hypotheses can currently live
`mind.hypotheses: TrackedHypothesis[]`, with a full revision engine in `lib/hypotheses.ts` (support/contradict counts, confidence-from-evidence with ceilings, demote-fast-on-contradiction, status machine forming→testing→supported→confirmed→weakened→rejected→dormant, habit graduation, and the "I've changed my mind" movement log). **The scientific loop you described in your prompt already exists here** — but its **only input is `SurprisingFinding` (metric correlations).** `TrackedHypothesis.metrics` is typed `SignalId[]` (an *open* string type since the P5 generalization), so the shape isn't strictly health-locked, but the *update path* is.

## 9. Where inferred behavioral patterns could naturally integrate (no new subsystem)
Three existing homes, in order of fit:
1. **`mind.evidence[]` (atomic log)** — capture raw conversational observations here as `kind:"statement"/"event"`, `source:"conversation"`. Already synced, already capped, already schema-ready.
2. **`mind.hypotheses[]`** — when an observation recurs, form/revise a **behavioral** hypothesis using the *existing* lifecycle, feeding it observation-evidence instead of (or alongside) metric findings.
3. **`principles` / `mind-shifts`** — when a behavioral hypothesis is confirmed, graduate it to a durable principle ("you commit fast once a step is concrete; you stall on ambiguity"), which is *already injected into every conversation* via `principlesContextBlock`.

## 10. New subsystem, or extend? → **Extend.**
No new personality engine. The gap is not intelligence; it's **plumbing**: (a) a capture channel from conversation into the atomic evidence log, and (b) generalizing the hypothesis loop's *input* to accept behavioral observations, not just metric findings. Everything downstream (revision, confidence ceilings, mind-shifts, context injection, epistemic views) already exists.

## 11. The smallest architecture that would enable learning-from-behavior
Four small pieces, each reusing an existing pattern — **for your approval, not yet built:**
1. **Capture:** an invisible model tag mirroring the existing tag pattern — e.g. `[[observe: <pattern-key> | <plain note>]]` — emitted when Synapse notices a behavioral signal. Parsed client-side (like `[[rec:]]`) into an `Evidence{kind:"statement", source:"conversation", captureConfidence}` appended to `mind.evidence`. *(Optionally a tiny deterministic detector for the most unambiguous signals — e.g. same decision reopened N times — so capture doesn't depend solely on the model noticing.)*
2. **Accumulate → hypothesize:** group conversational observations by `pattern-key`; on recurrence, form/strengthen a **behavioral** `TrackedHypothesis` through the *existing* `lib/hypotheses` revision logic (generalize its input beyond `SurprisingFinding`).
3. **Graduate:** a confirmed behavioral hypothesis proposes a `principle` (already user-visible + editable, already injected everywhere).
4. **Persist correctly:** keep all of this in the **synced `mind`**, not a new local key.
No dashboard, no score, no quiz, no clinical layer.

## 12. How that learning should influence the rest of the system
It flows through **injection points that already exist**, so no surface needs rebuilding:
- **Allocation / decisions:** behavioral principles + the PFT-determinant sharpen the "expected return / execution" factor already in the charter's allocation loop and `allocationContextBlock` (e.g., "Goal B keeps triggering avoidance at an ambiguous step → the fix is the *plan*, not the ranking").
- **Goal planning:** `GOAL_PLAN_PROMPT` already picks the next move; a known determinant ("stalls on ambiguity") tells it to make the step concrete.
- **Coaching:** `principlesContextBlock` already rides in every chat/orb turn.
- **Clarity / doubt:** a "circling vs useful uncertainty" read becomes another observation + a charter directive to name it.
- **PFT upgrade:** from a scalar to a scalar **+ a most-likely bottleneck** (clarity / accountability / ambiguity / ambition / emotional resistance / no-reward), derived from accumulated observations.

## 13. Privacy / epistemic safeguards (must ship *with* any build)
- **Inference ≠ fact:** everything enters as OBSERVED or HYPOTHESIS, never asserted — the KNOWN/OBSERVED/HYPOTHESIS rule and confidence ceilings already exist; extend them to behavioral claims.
- **Recurrence gate:** never surface a behavioral read on one data point; require the same demote-fast-on-contradiction discipline the metric loop already uses.
- **Humility scales with depth:** the deeper the inference, the more tentative the language (your point 6).
- **No clinical/psych labeling:** the charter boundary already forbids diagnosis; reinforce "no subconscious claims, no personality determinations."
- **User-visible + editable:** graduated principles already appear under "Who you're becoming" and are editable — keep inferred patterns inspectable and correctable, never hidden profiling.
- **Specificity over profundity:** capture concrete observations ("reopened this decision 4×"), not adjectives ("fear of failure").

## 14. What must remain **frozen**
The FDR-controlled correlation/statistics engine and its metric→SurprisingFinding path; the REASONING/report JSON schemas; the invisible tag tokens and their client parsers; the health check-in measurement pipeline; the allocation contract just shipped; goal decomposition (`goal-plan`) as *action* selection (not allocation). Additive only.

---

## The one-line north for implementation (when approved)
Add a **conversational-observation → atomic-evidence → behavioral-hypothesis → principle** path on top of the machinery that already exists, store it in the **synced mind**, and let it flow through the **context blocks already injected everywhere** — so Synapse learns *how you operate* by paying attention, with the same epistemic humility it already applies to health patterns. Extend; don't rebuild.

*No code written. Awaiting your direction on whether the smallest architecture in §11 is the next milestone, or whether to narrow it further (e.g., capture-only first, before the hypothesis-loop generalization).*
