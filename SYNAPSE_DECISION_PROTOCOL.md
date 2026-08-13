# Synapse — Decision Protocol (design only)

*Turning the seven-factor model into a reasoning procedure, not a score. The output of a decision is an **argument the user can challenge**, not a number. No code here.*

## The correction to the audit

The audit said "rank on Importance × Expected-Return as the spine." **Reject that.** A weighted score would replace one black box with a more sophisticated-looking one, and it can't be argued with. The factors are not addends — they do **different jobs**, and a decision is the *resolution of a tension between them*, stated out loud. Synapse's job is to reason, name the conflict, compare the top candidates, and make a defensible call — not to compute a winner.

## The factors, sorted by the job they do

- **Constraints** (they *gate* the options; never traded against, never scored): a real external deadline, a dependency (X blocks Y), finite capacity for the week, wellbeing/safety.
- **Evidence** (what we actually know; carries reliability + recency + known/observed/hypothesis): momentum, recent outcomes, history of what's worked/failed, days-since-progress, the deadline-as-fact, the PFT estimate.
- **Judgment** (where Synapse forms a view): importance (leverage toward who they're becoming), bottleneck (what unlocks the most), opportunity cost (what we give up).
- **Meta**: confidence — how well the evidence supports the judgment, and how close the top two candidates are.

A decision moves through those jobs in order: constraints filter → evidence informs → judgment decides → confidence qualifies.

## The 14 questions, answered

**1. When does Synapse actually need to decide?** Only when attention is genuinely contested — two or more live goals/actions competing for the same finite time — or the person is stuck ("what should I do?"), or it's a scheduled prioritization moment (the weekly needle), or a fork with real opportunity cost. When there's one obvious thing, or nothing is contested, there is no decision — just help. Do not manufacture decisions to look smart.

**2. What are the candidates?** The live goals (active, not achieved, not deliberately parked); at the action layer, the candidate next moves for the chosen goal. Always include two implicit candidates so the choice isn't falsely forced: **"protect what's already working / add nothing"** and **"recover."** The long-term trajectory is never a candidate — it's the overhead the candidates ladder up to.

**3. Which factors are evidence vs constraints vs judgment?** As sorted above. The discipline: **constraints are respected, evidence is weighed, judgment is owned.** Synapse should never present a judgment (importance) as if it were a fact, nor treat a hypothesis as evidence.

**4. How are conflicts resolved?** By an ordered argument, not a sum:
   1. **Constraints first.** A real, near deadline or a blocking dependency forces a candidate up — not because it "scores" more, but because ignoring it forecloses options.
   2. **Then importance.** Among what's left, what most advances who they're becoming?
   3. **Then feasibility** shapes the *step*, not the pick (see #8).
   4. **Name the conflict to the user.** "X matters more long-term, but Y is due Friday" is said out loud, and the call is made with a reason. The tension is the content of the decision, not something to hide behind a number.

**5. When does urgency override importance?** When the deadline is **real, external, and close enough that not acting now removes the option** or causes irreversible loss — a test date, an application window, a shipping deadline. Urgency wins when delay is *foreclosing*, not merely uncomfortable. It does **not** win for self-imposed or soft urgency with no external cost.

**6. When does trajectory override urgency?** When the urgent thing is low-leverage noise wearing an urgent mask, or — critically — when *serving urgency is itself the reason the important goal never moves* (the tyranny of the urgent). If the urgent task is neither irreversible nor high-leverage, and the important goal is the one that defines who they're becoming, Synapse should be willing to say: "that's urgent, but it isn't important — let it slip."

**7. How does opportunity cost enter?** Never as subtraction. As an **explicit named sacrifice**: choosing X means Y and Z get maintenance-or-nothing this week, *and Synapse says which.* Opportunity cost is what keeps the decision honest and forces real compression — you cannot pick everything, so the decision must state what it's spending its "no" on.

**8. How does PFT affect the choice without rewarding easy goals?** PFT is a **feasibility floor and a step-shaper, never a factor that ranks a goal up.** It must never demote importance. For the goal that *matters*, low follow-through likelihood doesn't drop it — it shrinks the *step* until it's doable, or attacks the friction. PFT changes the **move (how)**, not the **pick (what)**. The hard important goal stays the pick; PFT makes this week's version of it executable. (This directly closes failure mode (b) from the audit.)

**9. "Important but not now" vs "not important"?** The tell is a **return condition.** *Important but not now* = high leverage, but a constraint means this isn't its week — so it's parked **with an explicit trigger to come back** ("after the SAT, this leads"). *Not important* = low leverage toward the trajectory — dropped or left at maintenance, with no return date. Synapse must say which it's doing, so parking never reads as abandonment.

**10. Two nearly-equal choices?** Say the tie out loud — a near-tie is information, not something to paper over with false confidence. Then break it on the **cheapest, most reversible** dimension: the nearer real deadline, or whichever **unlocks the other** (bottleneck/dependency), or whichever **preserves optionality**. If genuinely symmetric, commit to one for a **bounded window** and make the reversibility explicit ("let's give it this week and reassess"). A near-tie must produce **low stated confidence** — never a confident-sounding coin flip.

**11. When to refuse a strong call?** When the decision rests on a **hypothesis rather than observed fact** ("mornings work better" with no data), when candidates are near-tied on thin evidence, or for a brand-new user with only stated (known) info. Then make a **provisional** call, flag it as provisional, and name what would resolve it ("I'd lean X, but I've never seen you work under a deadline — let's treat this as a test, not a verdict"). Refusing to over-assert is a trust move, not a failure.

**12. How is a decision recorded so it can be evaluated later?** Record the **decision, not just the advice**: what was chosen, what was parked, the argument (the 1–2 factors that carried it, the runner-up + its losing factor, the named opportunity cost), the confidence, the reversal condition, and the horizon it was made for. Then at the end of that horizon, evaluate the **decision's own prediction**: did the chosen thing actually move? did the parked thing suffer as little as expected? was the reversal condition hit? This evaluates the *call*, not merely whether the person followed instructions.

**13. Learning from a wrong decision without overcorrecting?** Separate a **bad decision** (the reasoning was flawed given what was known) from a **bad outcome** (the reasoning was sound; variance went against it). A single bad outcome updates **nothing structurally** — it's noise. Only a **repeated pattern** of the same decision-type failing updates the priors ("every time I let momentum beat a real deadline, the deadline goal slipped — I'll respect deadlines harder"). Learn from L4/L5 patterns, never from one event. This is the same evidence discipline already in the product, applied to Synapse's own judgment.

**14. What does a defensible decision look like in conversation?** Your example, produced naturally and only as deep as the moment needs (progressive disclosure): the **call** first; the **argument** on "why?". Something like — *"I'd put this week into the SAT. It's the nearest real deadline and it's your current bottleneck; the startup has healthy momentum so it can hold. The startup was the close call — it loses only because nothing forces it this week. That means the gym and research get maintenance, on purpose. I'm about 70% on this; if your SAT date moved or your practice scores stalled, I'd switch to the startup."* Never a scorecard, never a percentage with no reason behind it.

## What makes this trustworthy (not just decisive)

Every strong ("this is the most important thing") claim must be able to state: **the 1–2 factors that carried it, the runner-up and its losing factor, the confidence, and the reversal condition.** If it can't, it **hedges instead of asserting.** That is the operational meaning of *earn the right to decide.* The user's power isn't that Synapse is confident — it's that they can see the argument, push on factor C, and watch the recommendation change. A partner reasons in the open; a productivity calculator hands down a number.

## The minimum data structure this implies (surprisingly small)

Notably, this protocol needs almost no new storage:

- **One optional field per goal: a real due date.** The only new input — and only so *Urgency* is a fact, not a vibe. Everything else (importance ≈ leverage toward the existing trajectory, bottleneck, momentum/recency, PFT, opportunity cost) is **derived at decision time from data that already exists.** No importance score, no user-maintained ranking.
- **One lightweight decision-log record** (extending the existing ledger, not a new engine): `{ chosen[], parked[], carriedBy: [factor tags], runnerUp + losingFactor, confidence, reversalCondition, horizon, at }`. This is what turns a decision into something reviewable — the missing loop from the audit.

That's the whole footprint: **one optional date + one decision record.** No score, no matrix, no dashboard, no change to the frozen machinery. The protocol is reasoning; the storage is a diary of the calls made and how they turned out.

## Recommended sequence (still for your approval — nothing built)

1. Encode this **decision protocol as reasoning** (the argument shape + the defensibility contract + the constraint/evidence/judgment sorting) into the charter and the prioritization prompt. This alone changes behavior with zero new data.
2. Add the **one optional due date** so Urgency stops being a guess.
3. Add the **decision-log record + horizon-end review** so Synapse can finally judge its own calls and learn from patterns (not single outcomes).

Settle the protocol first (this document); then #1 is a prompt change, and #2/#3 are the two tiny structures above.
