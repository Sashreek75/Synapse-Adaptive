# Synapse Adaptive — Product Audit & Migration Plan (v2)

*First-principles audit against the new North Star: **help people consistently become who they said they want to become.** The one reusable asset is the adaptive understanding engine; everything else must defend itself. No implementation here — this is the map we build from.*

---

## The test every feature had to pass

1. Does it directly serve the core loop — **goal → understanding → role → execution → observe → learn**?
2. Would someone open Synapse *today* specifically for it (daily utility)?
3. Does it deepen the engine's understanding of the person, or just display data?

"It exists because Synapse started as a health app" is no longer a reason to keep anything.

---

## One hard truth up front

The understanding engine is real and worth preserving — but it is **built entirely on health check-in metrics** (sleep, energy, stress, mood, focus, reaction time…). The correlation/surprise/hypothesis machinery reasons over `MetricSeries`. The new vision (work, study, habits, career) implies understanding *those* domains too.

So there are two honest paths:
- **Near term (recommended):** keep the quantitative engine as-is (health is its measurable core), and capture other domains *qualitatively* — goals, routines, context notes, reflections — which the model already reasons over. Ships now, no engine rewrite.
- **Later:** extend the engine to domain-agnostic metrics ("deep-work hours," "study minutes," "habit streaks"). That's a real engine investment, not a copy change.

This audit assumes the near-term path. Flagged again in the migration plan.

---

## 1. Features that PERFECTLY align — keep and center

| Feature | Why it's core |
|---|---|
| **The understanding engine** (memory/`mind`, reasoning, surprise, hypotheses, intervention gate, safety) | The reusable asset. It IS the moat. Untouched. |
| **The conversation (Home)** | The adaptive companion where roles live and execution happens. This is 90% of the product — the "one continuous relationship." |
| **Adaptive Roles + "request comes first"** (charter v5) | The behavioral spine of the new product. Already live. |
| **Focus tools** (timer, checklist) | Pure daily utility, Executor role, reason to open the app on a normal workday. New and exactly on-mission. |
| **"What I've learned about you"** (the understanding, made visible) | The mirror — theories, habits, changed-my-mind, questions. Only makes sense because of weeks of learning. Keep; broaden language beyond health. |

## 2. Features that PARTIALLY align — keep but evolve

| Feature | Gap | Evolution |
|---|---|---|
| **Daily check-in** | It's the "observe" step, but narrowly health sliders. | Broaden into "how did today go / what are you working on" — capture goal-progress and context, not just health metrics. Health becomes a subset. |
| **Weekly report** | Right idea (Strategist role: connect behavior → goals), wrong framing (a clinical "health report" layout). | Reframe into a conversational **Weekly Review** oriented to goals and momentum, not metrics. |
| **Onboarding** | Too thin and health-condition-shaped (recovery/concussion/provider paths). | Redesign into a deeper, cross-domain capture: goals, values, working rhythm, preferred coaching style. Feeds roles from day one. |
| **First-week experience** | Excellent, but framed around "how your {health focus} moves." | Keep; reframe to the person's chosen goal in any domain. |

## 3. Features that need REDESIGN

| Feature | Problem | Recommendation |
|---|---|---|
| **"Your numbers" dashboard (`/stats`)** | It's a health dashboard — the philosophy explicitly says *not dashboards*. It competes with "feel alive, one relationship." | Don't keep it as a primary destination. Fold the one irreplaceable part — **"connections I've found in your data"** — into the "You" surface as a drill-down. Retire the standalone charts page. |
| **Assessments (cognitive tests)** | Genuinely differentiating signal, but as a standing top-level tab they read as "health platform," and few people open an app *to take a reaction test*. | Demote from a menu destination to a **contextual invitation** the companion offers when relevant ("want to actually test your focus right now?"). Keep the engine; remove the standing tab. |
| **Profile (health profile)** | Overlaps heavily with Playbook + the timeline redirect + understanding-evolution. Multiple surfaces for "what Synapse knows." | Consolidate: one **"You"** surface = the learned model (Playbook) + the editable facts/goals (Profile) + evolution timeline. |
| **Weekly report layout** | (see Partial) | Merge into Weekly Review. |

## 4. Features that should be REMOVED

| Feature | Why |
|---|---|
| **Redirect stubs: `/agent`, `/appointment-prep`, `/spaces`, `/timeline`** | Dead legacy routes that only redirect. Pure clutter — delete them (fold `timeline` into "You"). |
| **Appointment-prep / "questions for your provider" as a feature** | This frames Synapse as a health-clinic companion — the exact old identity we're leaving. Keep the *safety* behavior ("this is worth discussing with a provider") as a line in conversation; remove the tracked provider-questions list and prep surface. |
| **Standalone `/stats` charts page** | Redesign target above — as its own page it should go. |
| **"Symptoms" as a default check-in axis + clinical condition onboarding** | Health-platform residue. Make symptom tracking optional/contextual, not a default prompt. |

**Not removed (infrastructure, exempt from the daily-utility test):** Billing and Settings. They don't need to earn daily opens; they just stay quiet in a menu.

---

## 5. Proposed information architecture

The product should feel like **one presence with three ways in**, not a directory of pages.

```
Synapse (one continuous relationship)
│
├─ TALK        Home = the conversation. The companion, the roles, execution.
│              Where the day starts and most value happens.
│
├─ FOCUS       "Work with me now": the focus timer, checklist, and (next)
│              the persistent Focus Companion orb. Daily utility.
│
└─ YOU         The living understanding — what Synapse has learned about how you
               work: patterns, theories, habits, open questions, progress, and
               the editable facts/goals it's built on. (Absorbs Playbook +
               Profile + timeline + the "connections" from stats.)

Quiet menu (not primary):
   • Weekly Review   (the Strategist sit-down — reframed report)
   • Settings        (coaching style, data & privacy, plan & billing)

Contextual, never a standing tab:
   • Daily check-in  (invited from Talk/Focus; broadened beyond health)
   • Assessments     (offered by the companion when a real test would help)
```

Nav shrinks from **8 destinations + 4 dead redirects** to **3 primary + a small menu**. Health stops being a section and becomes data living inside "You."

Everything maps to the loop: **Talk/Focus = execute**, **check-in = observe**, **engine = understand + learn**, **You/Weekly Review = reflect the growth back**.

---

## 6. Migration plan (preserve the engine, simplify the product)

Non-destructive and phased. The engine (`ai/*`), deterministic logic (`lib/*`), memory (`mind` / health-store), and safety are **untouched**; storage keys and schemas stay, so no user data is lost. We relabel and reorganize surfaces, not the brain.

**Phase 0 — Cleanup (low risk, do first)**
- Delete the four redirect stub routes (`/agent`, `/appointment-prep`, `/spaces`, `/timeline`).
- Remove the provider-questions surface and appointment-prep; keep the safety "see a provider" line.
- Pull `/stats` and `/assessments` out of the primary nav.
- *Outcome:* instantly simpler, nothing rebuilt.

**Phase 1 — Consolidate "You"**
- Merge Profile + Playbook + understanding-evolution into one `/you` surface.
- Fold the "connections I've found" block (the only irreplaceable part of stats) into it as a drill-down; retire standalone charts.
- Redirect `/profile` and `/stats` to `/you` during transition, then drop.

**Phase 2 — Collapse the nav + reframe**
- Nav becomes Talk / Focus / You + quiet menu.
- Rebuild the report as a conversational **Weekly Review** (Strategist role), goal-framed not metric-framed.

**Phase 3 — Broaden the inputs (qualitative, no engine rewrite)**
- Evolve onboarding + daily check-in to capture cross-domain goals, routines, and context (via the existing notes/goals paths the model already reasons over). Symptoms/health metrics become one optional axis.
- Assessments become contextual invitations from the companion.

**Phase 4 — Focus Companion**
- Build the persistent orb on top of the existing focus timer (the flagship, already de-risked by the tools work).

**Deferred (explicit):** domain-agnostic quantitative metrics (deep-work hours, study minutes, habit streaks). This is the one genuine engine extension; everything above ships without it.

---

## Recommended first move

Phase 0 + Phase 1 together are the highest-impact, lowest-risk step: they remove ~6 surfaces, collapse the "what Synapse knows" sprawl into one "You," and make the product visibly feel like one relationship — all without touching the engine. I'd start there on your go-ahead.
