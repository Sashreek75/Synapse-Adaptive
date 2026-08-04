# Synapse — Coherence Audit

*A consolidation pass, not an expansion one. The question is no longer "what's missing?" but "does this feel like one product, or ten good ideas?"*

## Verdict in one line

After the last several passes (goal redesign, subtraction, presence, evidence, correlation-vs-causation), Synapse is **substantially coherent** — one philosophy, expressed consistently, with the machinery hidden. The audit found **no missing capability worth adding** and **two genuine off-philosophy artifacts** to retire. The largest remaining risk is not a broken surface; it's one point of redundancy on Home and some invisible dead code from the health era.

---

## The one philosophy — does everything serve it?

> **Synapse exists to help people consistently follow through on what matters most, until they become the kind of person who follows through without needing Synapse.**

Every live surface was checked against this. The results:

- Goals, Goal detail, Home, Daily Snapshot, Weekly Review, Progress, Presence, Who You're Becoming — **all reinforce it directly.**
- Spaces — reinforces it *indirectly* (tools exist only to increase follow-through) and is correctly demoted to a quiet, secondary surface.
- Assessments (health-era form flow) — **did not reinforce it.** Retired this pass.

The philosophy holds. Nothing live actively contradicts it after the two fixes below.

---

## Scorecard

Each surface scored 1–10 on: **Clarity** (do I instantly know what to do?), **Focus** (does it keep me moving toward my goals?), **Trust** (would I believe this?), **Effort** (how little thought/clicks?), **Coach-like** (does it feel like a person?), **Delight** (would I come back?). Anything **below 8** is flagged.

| Surface | Clarity | Focus | Trust | Effort | Coach | Delight | Notes |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| **Goal detail** (one action) | 10 | 10 | 9 | 9 | 9 | 8 | The strongest screen in the product. One thing, earned reasoning on demand. |
| **Goals list** | 9 | 9 | 8 | 10 | 8 | 8 | Dead-simple capture; "Next:" line carries it. |
| **Home** | 9 | 9 | 8 | **7** | 9 | 8 | Two conversation entry points (see Finding 3). |
| **Weekly Review** | 9 | 9 | 9 | 8 | 9 | 9 | Intentionally deep; the "what we learned" framing lands. |
| **Progress** | 9 | 9 | 8 | 9 | 8 | 8 | Verdict-first; one chart. |
| **Presence / orb** | 8 | 9 | 9 | 9 | 10 | 9 | Earned, restrained, learns from being ignored. |
| **Who You're Becoming** | 8 | 8 | 8 | 9 | 9 | 9 | Emotional, not analytical. Correct. |
| **Daily Snapshot** | 9 | 8 | 8 | 9 | 8 | 8 | Lightweight; two ways in. |
| **Onboarding** | 9 | 9 | 8 | 8 | 8 | 8 | Person-first; health is one area among many. |
| **Sidebar / menu** | 8 | 8 | 8 | 8 | **7** | **7** | "Quick conversations" reads slightly app-like; acceptable behind a drawer. |
| **Spaces** | 8 | **7** | 8 | 9 | **7** | **7** | Weakest live surface — but correctly demoted to "an implementation detail that occasionally becomes visible." Keep quiet; do not promote. |
| **Assessments** (health-era) | 3 | 2 | 5 | 4 | 2 | 3 | **Off-philosophy. Retired this pass.** |

Everything live now sits at 8+ on the dimensions that matter for its role. The sub-8 cells on Spaces and Sidebar are on *Delight/Coach-like* for surfaces that are deliberately utilitarian and secondary — acceptable by design, not defects to redesign.

---

## Findings & actions

### Fixed this pass

**1. Retired the Assessments surface.** `/assessments` was the last live health-era screen — a form runner, orphaned from navigation but reachable by URL. Filling out forms is the opposite of the product's promise (Synapse learns by talking and by watching follow-through). Converted to a redirect to the conversation, matching the other retired surfaces (`agent`, `appointment-prep`, `timeline`, `profile`).

**2. `.fuse_hidden` files — no action needed.** The four `.fuse_hidden*` files are transient artifacts of the live filesystem mount (ghosts of already-deleted files held open by a process). They are **not committed source** and will not appear in git or the build. They resolve themselves; nothing to remove.

### Recommended (not done — your call)

**3. Two conversation entry points on Home.** Home renders the immersive `AgentConsole` *and* the floating companion orb sits on top of it. Everywhere else the orb is the single, obvious way to talk; on Home there are two. This is the one place the product asks "which chat do I use?" — a small coherence tax (why Home's Effort is a 7). Options: (a) hide the floating orb specifically on Home, since the immersive console already *is* the conversation there; or (b) keep the orb but drop the immersive console and let the orb be the only entry everywhere. **Caveat:** the orb is also where proactive presence bubbles appear, so hiding it on Home would move those bubbles off Home. Worth a deliberate decision rather than a reflex — flagging, not changing.

**4. Dead health-era code tree.** With Assessments retired, `components/assessments/*`, `lib/assessments/*`, and `/api/assessment-plan` are orphaned. They don't break anything (self-contained), but they're weight. Recommend a follow-up removal once you've confirmed nothing else imports them — deliberately not ripped out this pass to avoid a build break without a fuller check.

**5. Vestigial `providerQuestions` state.** The health store still fetches/persists `providerQuestions`; its UI was removed from the Weekly Review. Harmless internal cruft, not user-facing. Clean up when convenient.

---

## The six-month test

Does the product get *better by getting quieter*? Checked against how it behaves as evidence accumulates:

- **Does it get simpler over time?** Yes — the machinery (bottlenecks, fronts, hypotheses, confidence chips) was moved behind the curtain; the user sees one next action.
- **Does the relationship deepen?** Yes — the Evidence Ladder climbs L1→L5, so coaching moves from "try mornings" to "every session you've finished started before 9:30."
- **Does Synapse need to say less because it understands more?** Yes — restraint is now law, and Presence *learns to go quieter* on reach-outs that get ignored.
- **Does the user feel understood rather than managed?** Trending yes — recommendations are now justified from the person's own history, and causes are held as hypotheses ("I have a theory"), not verdicts.
- **Does the product disappear while the coaching remains?** This is the direction of travel and the north star. The one thing still slightly in the way is Finding 3.

---

## Bottom line

Stop adding intelligence — the judgment is now the product, and it's strong. The consolidation is essentially done: retire the one off-philosophy surface (done), make one deliberate decision about Home (Finding 3), and sweep the dead health-era code when convenient. Nothing else needs building. The next gains come from the product feeling *inevitable*, not from it doing more.
