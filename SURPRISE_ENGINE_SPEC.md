# Synapse — The Surprise Engine (Implementation Spec)

*Scope of this pass: the surprise-engine **core** — a novelty/surprise ranking, a persistent hypothesis lifecycle, and rewritten reasoning/chat prompts that hunt for "I never realized that." Reuses your existing `Association`, `Belief`, `Mind`, and `OpenQuestion` machinery. **Plan only — no code written until you approve.***

---

## 0. The one thing this optimizes for

> An insight is good **only if the user could not have known it without Synapse having watched them for weeks.**

Everything below is a mechanism for producing and ranking that. The internal objective function changes from *"is this an accurate, well-written summary?"* to *"how surprised and how correct will this make the user, and does it depend on longitudinal, single-person data?"*

We make that testable with a single instrument (see §10): a one-tap **"Did this surprise you?"** on every insight. That number becomes the product's north-star metric.

---

## 1. Why your current code is 70% of the way there (and where the 30% is)

You already have the hard part built:

- `lib/correlations.ts` — real Pearson + next-day **lag** + best/worst-day **contrast**, ranked by a `strength` salience score. This is the substrate of non-obvious findings.
- `Mind` (`types/index.ts`) — already holds `beliefs`, `conclusions`, `openQuestions`, `playbook`. The skeleton of a "world model of one person" exists.
- `REASONING_PROMPT` — already asks the model to weigh multiple hypotheses and revise beliefs (`mindShift`).

What's missing is exactly the 30% that turns "accurate summary" into "I never realized that":

1. **Nothing measures surprise.** `strength` rewards *strong* relationships (high `|r|` + goal-relevance). But sleep↔fatigue is strong *and obvious* — it will win the ranking and bore the user. There is no notion of **how non-obvious** a finding is.
2. **Hypotheses are disposable.** `Hypothesis` (`types/index.ts:20`) is a per-week scratchpad, thrown away after each report. The manifesto's "I'm becoming increasingly confident… / I've changed my mind" requires hypotheses that **persist across weeks and accumulate supporting/contradicting evidence**. `Belief` is close but too thin (just `statement` + `strength`).
3. **Recurrence is invisible.** "You've repeated this for four consecutive weeks / this is the strongest recurring relationship I've found" — the single most valuable sentence in your manifesto — is not computable today, because associations aren't compared week over week.
4. **The prompts still reward summarizing.** `CHAT_PROMPT` mandates a rigid template (emojis, "Also worth knowing", "make ONE offer"). It optimizes polish and length, not discovery.

The plan closes those four gaps and nothing else this pass.

---

## 2. Architecture of the core (data flow)

```
                        ┌─────────────────────── NEW ───────────────────────┐
check-ins → Associations → surprise scoring → Hypothesis lifecycle → surprise-ranked evidence
 (existing)  (existing)     lib/surprise.ts     lib/hypotheses.ts        │
                              (novelty prior)    (persist + confidence)   ▼
                                                              reasoning.ts / pipeline.ts
                                                              buildEvidence(+hypotheses,+surprises)
                                                                          │
                                                                          ▼
                                        REASONING_PROMPT / CHAT_PROMPT (rewritten to hunt surprise)
                                                                          │
                                                              ┌───────────┴───────────┐
                                                              ▼                       ▼
                                                     model output (JSON)     deterministic fallback
                                                     w/ `surprise` field      render.ts (surprise-led)
```

Two new deterministic modules, three touched, two prompt rewrites, one type extension, two schema extensions. No UI work in this pass (that's the "whole manifesto" scope you deferred).

---

## 3. The heart: a surprise score (`lib/surprise.ts`, NEW)

Surprise = *strong* × *non-obvious* × *recurring* × *newly-changed*. We compute each factor deterministically and blend them. The model never invents this; it only voices the top-ranked result.

### 3a. The obviousness prior (the key idea)

A static table encoding how much a lay person would *expect* each relationship. Deviation from expectation is surprise. Illustrative:

| Relationship | Prior expectedness | Surprise potential |
|---|---|---|
| sleep_quality ↔ fatigue (same-day) | very high | low — everyone knows this |
| sleep_quality → next-day focus/attention (lag) | medium | **high** — direction + one-day delay is non-obvious |
| stress → next-day working_memory (lag) | low | **very high** |
| mood ↔ symptoms | medium | medium |
| exercise/activity context → next-day reaction_time | low | **very high** |

Implementation: `EXPECTEDNESS: Partial<Record<pairKey, number>>` (0–1), defaulting to `0.3` (mildly novel) for any pair not listed. **Lag relationships get a novelty bonus** — a time-delayed effect is inherently something a dashboard can't show. `contrast` findings ("the single biggest thing separating your best and worst days") are also inherently novel.

```
surprisePotential = 1 - expectedness(pair, kind)
```

### 3b. Recurrence & stability (double duty)

We keep a rolling history of each week's top associations (`Mind.associationHistory`, new — a compact `{weekKey, key, r, n}[]`). For a candidate association we compute:

```
recurrence = number of recent weeks this same relationship appeared (capped, e.g. /4)
```

This does two jobs at once:
1. It powers the manifesto's most valuable sentence: *"you've repeated this for four straight weeks."*
2. **It is also the cheapest possible guard against the spurious-correlation risk flagged in the MVP review.** A relationship that only shows up once at n=5 is noise; one that recurs for a month is real. We surface "discoveries" only once `recurrence ≥ 2` OR confidence is already `high`. This lets us chase surprise *without* chasing false positives — recurrence is the referee.

### 3c. Novelty-of-*change* (the "what surprised me this week")

Compare this week's associations to last week's:
- a relationship that **newly appeared** or **flipped sign** or **jumped a confidence tier** = high change-novelty. This feeds "This week doesn't match your normal behavior" / "I found a trend I didn't expect."

### 3d. The blended score

```
surprise = w1·surprisePotential + w2·min(strength,1) + w3·recurrenceWeight + w4·changeNovelty
```
(start with w ≈ [0.4, 0.25, 0.2, 0.15]; tunable). `computeSurprises(serieses, goals, associationHistory)` returns associations re-ranked by `surprise` instead of `strength`, each annotated with a machine-readable `whySurprising` string the prompt can lean on ("non-obvious lag; recurred 4 wks; new this week").

**Net effect:** sleep↔fatigue (strong but obvious, expectedness ~0.9) drops down the ranking; "your stress two days into a heavy workload predicts next-day memory dips, and it's held for a month" rises to the top. That reordering *is* the product.

---

## 4. The hypothesis lifecycle (`lib/hypotheses.ts` + type, NEW)

The manifesto asks Synapse to "constantly form hypotheses" with confidence, supporting/contradicting evidence, observation counts, and a path to confirm/reject. Today's `Hypothesis` type is ephemeral. We add a persistent one.

### 4a. New type (add to `types/index.ts`)

```ts
export type HypothesisStatus =
  | "forming"     // just noticed, weak evidence
  | "testing"     // actively being probed via an experiment/open question
  | "supported"   // evidence accumulating, confidence rising
  | "confirmed"   // strong, recurring, survived contradiction attempts
  | "weakened"    // contradicting evidence appeared
  | "rejected"    // evidence killed it (we keep it — "I was wrong about X" is trust gold)
  | "dormant";    // no fresh evidence in a while

export interface TrackedHypothesis {
  id: string;                       // stable slug, e.g. "hyp_sleep-leads-focus"
  statement: string;                // "Your sleep quality predicts next-day focus"
  metrics: MetricKey[];             // metrics involved
  status: HypothesisStatus;
  confidence: Confidence;           // clamped to data ceiling, same rule as everywhere
  supportingObservations: number;   // count of weeks/points that agreed
  contradictingObservations: number;
  firstFormedAt: string;
  updatedAt: string;
  prediction?: string;              // "next low-sleep night → focus down ~10 next day"
  howToConfirm?: string;            // what future data would settle it
  originAssociationKey?: string;    // links back to the correlation that spawned it
  evidenceLog: { weekKey: string; direction: "support" | "contradict"; note: string }[];
}
```

Extend `Mind`:
```ts
export interface Mind {
  // ...existing...
  hypotheses: TrackedHypothesis[];      // NEW — the investigator's working theories
  associationHistory: { weekKey: string; key: string; r: number; n: number }[]; // NEW — for recurrence
}
```

### 4b. Deterministic lifecycle engine (`lib/hypotheses.ts`)

Pure functions over the user's own data, so it works with no AI key:

- `deriveCandidates(surprises)` — turn top surprising associations into `forming` hypotheses (if not already tracked).
- `updateHypotheses(existing, thisWeekAssociations, experimentOutcomes)` — for each tracked hypothesis, check whether this week's data **agrees or disagrees**, increment the right counter, append to `evidenceLog`, and transition status:
  - support arrives + recurrence ≥ 3 + high confidence → `confirmed`
  - contradiction arrives → `weakened`; sustained contradiction → `rejected`
  - no evidence N weeks → `dormant`
- `confidenceFromEvidence(support, contradict, ceiling)` — monotonic, **clamped to the same data-driven ceiling** used in `lib/stats` and `lib/correlations` (never exceed what the data supports; the model can only lower it further).

The model's job (in `REASONING_PROMPT`) becomes: read the tracked hypotheses + this week's evidence, and **narrate the shifts in plain language** ("I'm now fairly confident sleep leads your focus — that's four weeks running") — it does not compute the counts or confidence. Same golden rule you already follow: code owns the numbers, model owns the words.

---

## 5. File-by-file change list

| File | Change | Type |
|---|---|---|
| `lib/surprise.ts` | **NEW.** Obviousness prior, recurrence, change-novelty, blended `computeSurprises()`. | new module |
| `lib/hypotheses.ts` | **NEW.** `deriveCandidates`, `updateHypotheses`, `confidenceFromEvidence`, status transitions. | new module |
| `types/index.ts` | Add `TrackedHypothesis`, `HypothesisStatus`; extend `Mind` with `hypotheses` + `associationHistory`. | type |
| `ai/schemas.ts` | `reasoningSchema`: add required `surprise` object + optional `hypothesisUpdates[]`. `reportSchema`: add `mostSurprising` string. | schema |
| `ai/prompts/index.ts` | Rewrite `REASONING_PROMPT` + `CHAT_PROMPT` (see §6). Minor add to `REPORT_PROMPT`. | prompt |
| `ai/reasoning.ts` | `buildEvidence()` → include `surprises`, tracked `hypotheses`, recurrence. Persist hypothesis + associationHistory updates in `ReasoningResult`. | wiring |
| `ai/pipeline.ts` | `buildEvidence()` for reports → feed surprise-ranked associations (replace raw `computeAssociations` ordering). Surface `mostSurprising`. | wiring |
| `ai/render.ts` | Deterministic fallback leads with the top **surprise** (not top strength) and can voice a hypothesis-confidence shift offline. | fallback |
| `components/providers/health-store.tsx` | Persist `mind.hypotheses` + `mind.associationHistory` in the existing store blob (localStorage/Supabase — no schema change, it's JSONB). | persistence |

No changes to `lib/stats`, billing, auth, or any UI component this pass.

### The single most important line-level change
In `ai/pipeline.ts` `buildEvidence` and `ai/reasoning.ts` `buildEvidence`, the `associations` array handed to the model is currently ordered by `strength`. **Re-order it by `surprise`** and attach `whySurprising`. That one change, plus the prompt rewrite, flips the whole system from "lead with the strongest signal" to "lead with the most eye-opening one." Everything else supports it.

---

## 6. Prompt rewrites (the behavioral change)

### `REASONING_PROMPT` — add an explicit discovery step + surprise output

Insert into the internal reasoning order (after step 5 "commit to the strongest explanation"):

> **5b. THE SURPRISE PASS.** Look at the ranked `surprises` and your tracked `hypotheses`. Ask: *what here would make this person stop and say "I never realized that"?* Prefer a non-obvious lag or a best-vs-worst contrast over any single-metric up/down. If the strongest finding is something they obviously already know (sleep makes them tired), do NOT lead with it — dig for the second-order pattern. If, honestly, nothing this week is surprising, say so plainly ("nothing jumped out this week — I'm still watching X") rather than manufacturing a fake revelation.

New required output field:
```
"surprise": {
  "observation": string,   // the one "I never realized that" — non-obvious, from THEIR data
  "whyNonObvious": string, // why a dashboard / ChatGPT / Apple Health could NOT show this
  "confidence": "low"|"moderate"|"high",
  "recurrence": string     // "first time I've seen this" | "fourth week running", drawn from evidence
}
```
And `"hypothesisUpdates"`: array of `{ id, statement, status, movement: "formed"|"strengthened"|"weakened"|"confirmed"|"rejected", inPlainWords }` so the model narrates the lifecycle the code computed.

Add the manifesto's **final test** as a hard rule:
> Before you output an insight, apply THE FINAL TEST: would ChatGPT already say this without your data? Would a spreadsheet or Apple Health already show it? If yes, it is not an insight — replace it. Only surface observations that exist *because* you have watched this one person over time.

### `CHAT_PROMPT` — de-template, re-point at discovery

Keep: answer the actual question first, grounding rules, safety, one next step. **Cut/loosen:** the rigid mandatory scaffold (forced emojis, mandatory "Also worth knowing", mandatory "make ONE offer", the copy-this-rhythm block). It's currently optimizing polish and length — the exact thing the manifesto says to stop doing. Replace the "GO ABOVE AND BEYOND" section with:

> When you have genuinely earned it from their data, offer ONE thing they likely have not noticed — a connection across time, a recurring pattern, or a hypothesis you're forming ("I'm starting to think your Tuesday dips trace back to Sunday nights — three weeks in a row now"). Frame it with honest confidence. If you have nothing non-obvious to add, add nothing — do not pad. A short reply that answers them plus one real discovery beats a long structured one that restates their dashboard.

Net: chat stops being formulaic, starts sounding like an investigator who occasionally says "here's something I noticed that you probably haven't."

### `REPORT_PROMPT` — small add
Add a `mostSurprising` lead: the report should open the insight section with the single most eye-opening pattern (from the surprise ranking), explicitly labeled with its recurrence.

---

## 7. Deterministic fallback (must stay true offline)

`ai/render.ts` currently leads reports with the highest-`strength` association. Change it to lead with the highest-`surprise` association and, when a tracked hypothesis crossed a threshold this week, emit a plain-language confidence-shift line ("This is now the strongest recurring pattern I've found — four weeks running"). This keeps the *feeling* of an investigator even with no model/quota, which matters given the free-tier Gemini dependency flagged in the review.

---

## 8. The guardrail I'm building in (surprise ≠ recklessness)

A pure surprise-maximizer is dangerous in health: the most "surprising" correlation is often the most spurious, and a confidently-wrong "aha" destroys trust faster than a boring-but-right one. This spec defends against that **without** the full statistics rework you deferred, using two cheap mechanisms already in the design:

1. **Recurrence gate (§3b):** a finding isn't called a "discovery" until it recurs (≥2 weeks) or already clears the high-confidence bar. One-week flukes stay as `forming` hypotheses, phrased tentatively ("early sign, worth watching"), never as revelations.
2. **Contradiction tracking (§4):** hypotheses that stop holding get visibly `weakened`/`rejected`. "I was wrong about that" is a feature, not a bug — it's the most credible thing an investigator can say.

I still recommend the n-threshold + multiple-comparison fix from the MVP review as the *next* pass — surprise-hunting raises the cost of a false positive, so the statistical floor matters more now, not less. Flagging it here so it's a conscious deferral, not an oversight.

---

## 9. Explicitly OUT of scope this pass (per your scoping choice)

- UI surfaces: a hypothesis board, "I changed my mind" event cards, a surprise feed. (The engine will *emit* all the data for these; nothing renders it yet beyond existing report/chat text.)
- Correlation statistics rigor (n-thresholds, multiple-comparison correction).
- Persistence hardening (localStorage→Supabase default), billing, onboarding depth.
- Calendar/wearable event ingestion (the `event` association kind exists in the type but has no producer — left as-is).

---

## 10. How we'll know it worked

Add one lightweight tap on each surfaced insight — **"Did this surprise you? 👍 / 😐"** — stored in the same blob. Target: a rising share of 👍 over a user's first month, and at least one 👍-worthy insight per active week. This operationalizes the manifesto's "at least ONE genuinely surprising observation per week" into a number we can watch. (This is the only UI touch I'd add in the core pass; if you'd rather zero UI, we log surprise server-side from the model's own `surprise.confidence` instead.)

---

## 11. Build order once approved (est. within the core scope)

1. `types` + `Mind` extension, `lib/surprise.ts`, `lib/hypotheses.ts` (pure, unit-testable — no AI).
2. Wire `buildEvidence` in `reasoning.ts` + `pipeline.ts`; persist in `health-store`.
3. Rewrite `REASONING_PROMPT`, `CHAT_PROMPT`; extend schemas; update `render.ts` fallback.
4. Verification: seed a synthetic 8-week user with a *planted* non-obvious lag pattern + an obvious one, and confirm the engine surfaces the non-obvious one first, forms a hypothesis, raises its confidence as weeks accrue, and that the deterministic fallback does the same with the key off.

---

## Open decisions for you

1. **Surprise instrument (§10):** ship the one-tap "did this surprise you?" (tiny UI), or keep this pass zero-UI and infer surprise server-side? *(Recommend: ship the tap — it's your north-star metric and ~20 lines.)*
2. **Rejected hypotheses:** keep visible ("I was wrong about X") or hide them? *(Recommend: keep — highest-trust signal there is.)*
3. **Obviousness prior:** hand-author the initial table (fast, opinionated) — confirm that's fine vs. wanting it data-derived later.
