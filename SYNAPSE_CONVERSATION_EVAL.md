# Synapse — Conversation Evaluation Kit

*Stop scoring the charter. Start scoring the conversations. This is the test that matters now: can a stranger tell Synapse knows the person?*

Use this on **real transcripts** (yours or a tester's), not on the code. Run each prompt, paste the reply, score it 1–5 on the five questions, and total. The bottleneck this exposes isn't the charter anymore — it's **memory/context quality** and the **model's ability to turn context into natural language**. Where scores are low, that's what to fix.

## The five questions (score each 1–5)

| # | Question | 1 (fails) | 5 (nails it) |
|---|---|---|---|
| Q1 | **Did it remember something relevant about me?** | Generic; no use of my goals/history/commitments | Naturally uses a specific real thing I told it or did |
| Q2 | **Did it take a position?** | Neutral options list / "it depends" | Makes a clear call and owns it ("honestly, I'd…") |
| Q3 | **Did it understand what I was struggling with beneath my words?** | Answers the literal words only | Names the real bottleneck I didn't say out loud |
| Q4 | **Did it tell me what matters without making me manage a system?** | Hands me a framework/plan/matrix to maintain | Compresses to the one thing + a next move |
| Q5 | **Could this plausibly come from someone who's worked with me for months?** | Reads like ChatGPT with a nice tone | Reads like a partner who's been paying attention |

**Scoring:** 22–25 = the product is real. 16–21 = good coach, relationship thin — usually a *context* gap (it didn't have the memory, or wasn't given it). ≤15 = still generic; check whether real history exists and reached the model before blaming the reply.

Two automatic **fails**, regardless of score:
- **Fake intimacy** — "we've got this," "I'm proud of you," "I'm right here with you," "I know you better than you know yourself." (v40 forbids these; catch any that slip through.)
- **Announcing the relationship** — "as someone who's gotten to know you…"

## Test prompts (run these)

**Overwhelm / prioritization**
1. "I have school, SAT prep, research, my startup, and college apps. I don't know what to do."
2. "Everything feels equally urgent and I'm frozen."

**Avoidance / procrastination**
3. "I've been planning this for three weeks."
4. "I think tonight I'll reorganize the whole project." *(should push back if reorganizing is the avoidance)*

**Ambition (evidence-calibrated, don't reflexively shrink)**
5. "I want to study four hours tonight." *(supports it if history earns it; redesigns only if evidence says it collapses)*
6. "I'm going to launch in two weeks." *(calibrate to what they've actually shipped before)*

**Uncertainty / direction**
7. "I've been working really hard but I don't know if it's the right thing."
8. "I don't know what I actually want here."

**Discouragement (specific, not a pep talk)**
9. "Maybe I'm just not good enough for this."
10. "I keep failing at this."

**Teaching (role shift — become the tutor)**
11. "I don't understand how derivatives work." *(should teach cleanly, not coach)*

**Success (learning, not praise)**
12. "I finally finished it." *(should name what specifically worked, from memory)*

**Direction change (drop attachment to old plans)**
13. "I don't think I care about the startup anymore." *(should adapt, not defend the old goal)*

**Low need (get out of the way)**
14. "Things are going well, I've been consistent for a month." *(should NOT invent an intervention)*

**Continuity (the real test — run in a SECOND session after leaving a thread open)**
15. First session: "I'll test this with five users this week." → Next session, open Synapse and say "hey." *(should pick up the promise: "you said you'd talk to five users — how'd it go?" — unprompted)*
16. First session: name a goal and get a next move. → Next session: "I did it." *(should remember what "it" was and what it means, not ask "did what?")*

## How to read the results

- **Q1/Q5 low across the board** → the *context* isn't rich or isn't reaching the model. Check that goals, commitments, decisions, and outcomes are actually injected (they are wired into chat + the orb) and that real history exists yet — a brand-new account will legitimately score lower here, and that's honest, not a bug.
- **Q2 low** → the model is hedging; it's the one thing more charter *won't* fix — it's model behavior under the existing "have a point of view" instruction. Note the pattern; it's a model/temperature/eval question, not a philosophy one.
- **Q3 low** → diagnosis isn't landing; usually means the goal's bottleneck/why wasn't in context.
- **Q4 low** → it's reverting to plan-dumps; check the specific surface (weekly review vs. chat).
- **Fake-intimacy fails** → tighten the phrase list, but first confirm it's actually happening in transcripts rather than in fear.

## The rule this enforces

If Synapse scores 22+ consistently, **stop adding philosophy and stop building features.** The next breakthrough is not another engine — it's the moment a real user reads a reply and thinks *"it actually knows me."* That's a data-and-language problem now, and this sheet is how you find where it breaks.
