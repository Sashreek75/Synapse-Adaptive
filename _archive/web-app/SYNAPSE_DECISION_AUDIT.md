# Synapse — Decision-Making Audit

*The question that matters now is not "can Synapse give good advice or sound relational?" It's: **when Synapse says "this is the most important thing," can it defend that decision?** This audit traces the actual code. No changes were made.*

## Verdict

**Partially.** Synapse has genuinely good judgment *heuristics* scattered across the charter, context blocks, and a couple of deterministic scorers — but it does **not** have a single coherent decision *procedure*. In the happy path the prioritization decision is made by the model as a black box (given rich context + charter principles, "figure it out"); in the fallback it's a crude linear score with arbitrary weights and missing factors. It can usually *narrate* a defense after the fact, but three structural gaps mean the defense often isn't grounded in real, weighed factors. So: good instincts, no defined methodology, and the one factor a user most expects ("the closest deadline") isn't even computable today.

## How a decision actually gets made right now

The chain the request named — person → goals → constraints → deadlines → progress → evidence → bottlenecks → opportunity cost → impact → confidence → decision → action — maps onto real code like this:

- **The weekly "needle" (which goals matter this week):** `/api/goal-focus` + `GOAL_FOCUS_PROMPT`. Inputs: each goal's `title, priority, momentum, daysSinceProgress`, plus a person-context string (trajectory, primary challenge, AI summary). The **model** picks 1–3 and writes a note. Fallback if the model is unavailable: `score(g) = priority×10 + momentum×2 + recency`.
- **In-conversation prioritization:** `goalsContextBlock()` lists goals with priority/momentum/bottleneck/last-outcome/days-since, plus a "force a choice when they compete" instruction. The model decides ad hoc.
- **Next action for one goal:** `decomposeGoal → /api/goal-plan` picks a bottleneck + one move.
- **Supporting signals:** PFT (follow-through likelihood → coaching mode), the Evidence Engine (L1–L5 + known/observed/hypothesis), the decision ledger (records *advice* and whether it "worked").

The reasoning *rules* live in the charter (diagnose → decide what matters → highest-leverage → coach-to-PFT → evidence-as-hypothesis). They're good rules. But they're instructions to a black box, not a procedure with defined inputs and weights.

## The 10-area audit

1. **Goal prioritization.** No explicit weighing model. The model is handed priority label, momentum, recency, and prose principles and told to choose. Ties are resolved by the LLM's discretion, not a rule. It *can* say "not now"/"drop this" (charter permits it), but there's no criterion that triggers it. **Weak: no defined factor set or tie-break.**
2. **Next-action selection.** `GOAL_PLAN_PROMPT` is strong here — it explicitly demands the move be specific, high-leverage (advances the goal, not prep around it), and aimed at the bottleneck. **Solid, and the best-defined decision in the system.**
3. **Trade-offs / opportunity cost.** Instructed in the charter ("reason about opportunity cost," "what's being parked") but never *computed* — nothing represents "pushing A costs B." It's whatever the model asserts. **Instructed, not grounded.**
4. **Time horizon.** The needle is framed "this week," and the charter separates long-term overhead from short-term goals — but there's **no structured deadline** (`timeline` is free text, never parsed into urgency). So "a low-urgency but extremely important goal beats an urgent noisy task" can only happen by the model's feel, and "closest meaningful deadline" is literally not a number the system has. **Major gap.**
5. **Evidence.** The Evidence Engine is real and good: leveled L1–L5, separates known/observed/hypothesis, correlation-held-as-hypothesis. But it feeds *advice*, and isn't wired into the *prioritization* decision specifically. **Good engine, not connected to the ranking call.**
6. **Uncertainty.** Confidence is graded for evidence and enforced in language ("say how sure you are"). But the **decision itself carries no confidence** — the needle output has no confidence field and no "what would change this." So uncertainty is mostly linguistic at the decision layer. **Present for advice, absent for decisions.**
7. **Personalization.** Real: decisions draw on the person's goals, momentum, history, trajectory, PFT, and (now) what they told Synapse. A generic user would get a different answer. **Strong.**
8. **Decision quality over time.** The ledger records *recommendations/strategies* and whether they "worked" — but the **prioritization decision is never recorded** ("I chose A over B as the week's needle" is not logged), so Synapse cannot learn whether its *prioritization calls* were right, only whether individual advice helped. **The biggest missing loop.**
9. **Failure modes.** (a) A goal with a real deadline the user described in prose loses to a higher-`priority`-labelled goal, because the deadline isn't parsed. (b) A high-impact, low-momentum goal gets dropped by the fallback scorer (momentum-weighted) exactly when it most needs rescuing. (c) The model asserts a confident "this matters most" with thin evidence because nothing forces confidence to track evidence at the decision layer. (d) Two near-tied goals get an arbitrary winner with a confident-sounding note — indistinguishable to the user from a well-grounded call.
10. **Trust.** A user should trust the judgment when Synapse can name *the two factors that made this win, the runner-up and why it lost, its confidence, and what would reverse the call* — and when, over weeks, its past calls demonstrably worked. Today it can produce the first sentence of that (the note) but not reliably the rest, and not the track record.

## The three structural gaps (why the defense breaks)

1. **Deadlines are unstructured.** `timeline` is free text, never parsed. Urgency — the most intuitive prioritization factor, and the first one in your own trust example — cannot be computed. Everything "time-sensitive" is currently vibes.
2. **The prioritization decision is never recorded or reviewed.** The ledger tracks advice, not "A over B." So there's no feedback loop on whether Synapse's *calls about what matters* are any good — the exact thing that would make its judgment earn trust over time.
3. **Confidence isn't derived or attached to the decision.** It's language, not a value tied to evidence strength or to how close the top two candidates were. So "I'm confident" and "I'm guessing" look identical to the user.

## The Decision Quality Model (proposed — not built)

The smallest coherent framework that should govern every "what matters most" call, across all surfaces. It is a *reasoning contract*, not an engine or a UI.

**Factors weighed (the same seven, everywhere):**
1. **Importance** — long-term leverage toward who they're becoming (not just the `priority` label).
2. **Urgency** — real time-sensitivity: a dated deadline, a dependency, a closing window.
3. **Momentum** — traction (building/steady) vs stalled/slipping.
4. **Bottleneck** — is this the current constraint on the whole system?
5. **Opportunity cost** — what pushing this sacrifices, given a finite week.
6. **Expected return** — impact × probability they'll actually follow through (PFT). A high-impact goal they won't touch loses to a medium one they will.
7. **Confidence** — how much real evidence backs it, and how close the top candidates are.

**Procedure:** gather the factors per candidate → rank on Importance × Expected-return as the spine, with Urgency as the tie-breaker/promoter and Momentum + Bottleneck shaping the *move* more than the *pick* → choose one (or 1–3), keep the runner-up → produce the defense → **record the decision** → next cycle, check whether the chosen thing actually moved, and update.

**The defensibility contract (the trust bar):** a "most important" claim is only allowed to be *asserted* if Synapse can state (a) the top two factors that made it win, (b) the runner-up and why it lost, (c) its confidence and what specifically would reverse the call. If it can't, it must **hedge, not assert.** This is the operational form of your instruction: *optimise for defensible, not decisive.* Your example answer is exactly the output this contract produces.

## Smallest changes that would close the gap (for your review — not implemented)

1. **Give deadlines structure.** One optional due-date on a goal (not a matrix, not required), quietly parsed into days-until so Urgency becomes a real factor. Highest leverage: it unlocks the most-expected prioritization dimension. *(lib + a tiny optional field.)*
2. **Record and review the prioritization decision.** Log the weekly needle as a decision (chosen vs. parked), and next week check whether the chosen goal actually moved — feeding the ledger you already have. This is what lets judgment *earn* trust over time. *(reuses decisions.ts.)*
3. **Attach confidence + "what would flip it" to the decision, and align the fallback.** Add a confidence and a reversal-condition to the needle output and the charter's decision contract, and rebuild the fallback scorer around the seven factors so it's defensible when the model is down. *(prompt + lib.)*

All three are prompt/lib-level. None adds a user-facing scoring system, dashboard, or priority matrix; none touches the frozen correlation/intelligence machinery.

## The one-line answer

Can Synapse defend "this is the most important thing you should do next"? **Today: it can start the sentence, not finish it.** It has the instincts and most of the inputs, but no defined weighing, no computed urgency, no confidence on the decision, and no memory of whether its past calls were right. Close those three gaps and the defense your example describes becomes the *default* output — which is the point where the user can challenge the reasoning instead of just trusting the tone.
