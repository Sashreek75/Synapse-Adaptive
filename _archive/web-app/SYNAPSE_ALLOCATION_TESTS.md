# Synapse — Allocation behavior tests (run conversationally)

The point isn't whether Synapse wins the argument. It's whether it **allocates** (not ranks), **shifts when circumstances change and says what changed**, **admits genuine uncertainty**, and **learns from a wrong call** rather than rationalizing it. Test in real conversation, then push back. Code passing ≠ behavior passing.

## The standard (apply to every answer)
A good Synapse allocation is:
- **Explainable** — it can say *why* attention goes here.
- **Revisable** — it can say *what would change it*.
- **Proportional** — this is what gets *more* attention, not *all* attention.
- **Survivable** — if the plan fails, it can tell whether the problem was the allocation, the execution, or the strategy.

If an answer misses any of the four, it hasn't passed, even if it "picked the goal you'd have picked."

## Setup (once)
Create these goals and, on the SAT, set a **deadline** (detail page → Deadline) ~2–3 weeks out. Without a real date there is no urgency to reason about — that's intentional.
- **SAT prep** — deadline ~18 days out
- **Startup** — no deadline
- **Gym / training** — no deadline
- (optional) **Research** and a low-value **side project** for the 5–7 goal case

Open the Goals page once so the week's needle is computed and recorded.

---

## B — SAT + startup + gym (allocation, not "highest priority")
**Ask (chat or orb):** "What should I focus on this week?"

**PASS:** names SAT as what to **protect** *because the exam is close and momentum is there*, and explicitly keeps the others alive — "startup gets one meaningful move, keep training twice." Mentions what it's setting aside and why.
**FAIL:** returns the single highest-priority goal and goes silent on the rest; or implies startup/gym should stop; or lists all three with no allocation.

**Then push:** "Why the SAT and not the startup?"
**PASS:** gives the 1–2 reasons it won (deadline, momentum), names the startup as the close alternative and why it loses *this week*, and says it isn't less important. **FAIL:** restates priority labels, or produces a score.

*Driven by:* charter Step 2 + `goalsContextBlock` (roles + DUE IN label). Needs the SAT dueDate set.

---

## C — startup suddenly becomes urgent (dynamic reallocation)
**Say:** "Update on the startup — we now have a launch demo committed for next Friday." *(optionally set a startup dueDate too)*

**PASS:** recognizes the constraint changed and **reallocates out loud** — "last week I'd have protected the SAT; the demo is now a hard, near deadline, so I'd shift the week to the startup and keep the SAT alive with steady reps." Explains *what changed*. **FAIL:** keeps protecting the SAT because that was the prior call; or switches with no acknowledgment that anything changed (silent flip).

**Then push:** "But the SAT is sooner." **PASS:** weighs both real deadlines and picks with a stated reason, possibly splitting protect across both. **FAIL:** picks by priority label.

*Driven by:* `allocationContextBlock` (prior call) + charter dynamic-focus. This is the shift test — it happens in conversation, not by the card recomputing.

---

## F — low-confidence tie (honest uncertainty)
**Setup:** two goals of equal priority, similar momentum, neither with a deadline.
**Ask:** "Between these two, where do I put this week?"

**PASS:** "I'm leaning toward A, but this is genuinely close — here's the thin reason. If X were true I'd pick B." Low confidence, no fake winner. Willing to protect both for a bounded week. **FAIL:** confident single pick with invented justification; or a numeric tiebreak.

*Driven by:* charter uncertainty rule; the offline fallback also protects both on a near-tie.

---

## J — previous call was wrong (does it LEARN, or just explain?)  ← the big one
**Setup:** last week protect one goal; this week it clearly should have been the other (e.g., you tell Synapse the protected goal stalled and the parked one turned out to have a hard dependency you'd both missed).
**Ask:** "Looking back, was protecting X last week the right call?"

**PASS:** keeps **three** questions separate and answers each — (1) *was the original call defensible given what we knew?* (2) *did you execute it?* (3) *with hindsight, is there something I should have reasoned about differently?* The strongest form: "Given what we knew the call was reasonable; separately, you didn't get to it; and in hindsight I underweighted the dependency neither of us saw — that's what I'd account for differently." No collapsing (1) into (2), and no rationalizing a wrong call as secretly right.
**FAIL:** conflates "you didn't do it" with "the call was wrong" (or vice versa); treats successful execution as proof the call was good; or generates a graceful explanation that commits to nothing changing.

**Then push:** "So will you actually weigh it differently next time, or is that just something you're saying now?"
**HONEST LIMITATION:** in-conversation, Synapse can engage and explain (the calibration block feeds it the prior call + auto-read execution). But **it does not yet persist that self-judgment across weeks** — no wiring records `decisionQuality`, so the aggregate calibration ("I've misjudged this kind of trade-off 3×") can't fire yet. If you want J to genuinely accumulate, that's the one small hook to add next: record the verdict from the conversation (an `[[assess: …]]` tag or a one-tap review), which unlocks the aggregate lines already built in `lib/allocations.ts`.

*Driven by:* `calibrationContextBlock` (invite + execution read) + charter decision-vs-execution rule. Persistence hook: not built (deliberate).

---

## Perturbation probes (run after a scenario passes)
Don't accept the first good answer — change one meaningful variable and see if the allocation **recomputes with a reason**. You're testing judgment, not a memorized answer. Each probes a distinct mechanic:

1. **"What if I can only spend three hours this week?"** — *capacity shrinks.*
   PASS: keeps the important goal as the pick but **shrinks the step** ("then the SAT is 3× 45-min blocks, and the startup holds"), never drops the important goal because time is tight. FAIL: abandons the important goal for an easier one, or ignores the constraint. *(Charter: low capacity/PFT changes the step, not the pick; allocation ≠ execution.)*

2. **"The startup demo is a big opportunity but isn't technically a deadline."** — *soft/opportunity urgency vs a hard date.*
   PASS: treats it as a **closing window** with real weight without pretending it's a fixed deadline — weighs the opportunity, may promote the startup to watch/protect, and says how sure it is. FAIL: either dismisses it because "no date," or inflates it into a hard deadline it isn't. *(Charter: urgency includes closing windows/opportunities; never invent urgency from a vibe.)*

3. **"SAT prep has been going great — I'm already ahead."** — *the constraint relaxes.*
   PASS: recognizes the reason it protected the SAT has weakened and **reallocates** — "if you're ahead, the SAT drops to maintain and the startup can take the week" — stating what changed. FAIL: keeps protecting the SAT out of consistency. *(Charter: focus is dynamic; a resolved constraint should move the needle.)*

4. **"I hate the current startup plan and have been avoiding it for two weeks."** — *avoidance, not priority.*
   PASS: separates **allocation from execution/strategy** — the startup may still deserve attention, but the fix is diagnosing the avoidance and **changing the plan/step**, not re-ranking the goal ("we've avoided this two weeks — that's a signal the plan's wrong, not that the goal is"). FAIL: demotes the goal because it isn't getting done, or pushes the same disliked plan harder. *(Charter Step 1: avoidance is a bottleneck; Step 6: change your coaching, not the person.)*

The through-line: a meaningful new variable should visibly change the reasoning, and Synapse should be able to name *which* variable moved and *why* it changed the call.

## What "good" feels like overall
Across all four: Synapse should reason like a partner who sees the whole board and moves attention as the board changes — protecting what matters now, keeping the rest alive, changing its mind with a reason, and being honest about what it doesn't know or got wrong. If B and C feel like allocation (not ranking), F like real humility, and J like engagement (with the persistence caveat above), the foundation is sound.
