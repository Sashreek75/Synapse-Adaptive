# Synapse Adaptive — Architecture Reorientation (v2)

*Translating the manifesto into product architecture. Organized around the person, not a domain. Preserves the four foundations — understanding engine, memory, reasoning, safety — and challenges everything else. No code yet.*

---

## 1. Synapse's true core

**Synapse is a personal operating partner: an ongoing relationship that keeps a living model of one person and converts it, in the moment, into the right kind of help — so the gap between what they intend and what they do keeps shrinking.**

The core is not a surface or a feature. It's a loop, embodied as one presence:

> **understand the person → choose the role → help them act → observe → learn → help better.**

Everything else (chat, tools, check-ins, reviews, the orb) is just where that loop touches the day. Health is one domain the loop runs on, not the thing the product is about.

The durable asset — the reason this can't be cloned by a prompt — is the accumulated, evidence-weighted **understanding of one specific human** and the discipline with which it's used.

---

## 2. New information architecture

Three ways into one presence. Not a directory of pages.

```
SYNAPSE  (one continuous relationship; the orb is present across all of it)
│
├─ TALK  ....... PRIMARY. The conversation. The companion adopts whatever role the
│                moment needs and helps you act. Where the day starts and most value lands.
│
├─ FOCUS ....... "Work with me now." Execution: the timer, checklist, quick tools, and
│                the persistent Focus Companion during a work session.
│
└─ YOU  ........ The living understanding — who you're becoming, how you work, what's
                 helping, what you're figuring out, and your progress. The mirror.

Quiet menu (not primary tabs):
   • Weekly Review   — the Strategist sit-down (reframed from the health report)
   • Settings        — coaching style, permissions, data & privacy, plan

Contextual, summoned in-flow (never standing tabs):
   • Check-in / reflection   (morning intention, evening reflection — broadened past health)
   • Assessments             (offered only when a real test would sharpen understanding)
   • Execution tools         (also live in Focus; can be invoked from Talk)
```

What **disappears**: the health "dashboard" as a destination, the provider-prep surface, the four dead redirect routes, standalone profile-vs-playbook-vs-timeline duplication. What becomes **contextual**: assessments, check-ins, individual tools.

---

## 3. The human understanding model

The old "health profile" becomes a **Person Model** — five layers, each cutting across domains (work, education, fitness, habits, career, growth, health, life). Domains are *tags* on evidence, not sections.

| Layer | Question it answers | Examples | Where it lives today |
|---|---|---|---|
| **Identity** | Who are they trying to become? | goals, values, aspirations, the "why" | *New* — thin today (only a goal path). Needs real capture. |
| **Behavior** | How do they actually operate? | rhythms, focus/energy patterns, procrastination & failure modes, what reliably works | **Rich** — this is what the engine already learns (playbook, hypotheses, patterns), today via health signals. |
| **Preference** | How should Synapse help them? | coaching style, directness, intervention/accountability appetite, quiet vs. proactive | *New* — mostly absent; add to onboarding + let it adapt. |
| **Decision** | How do they choose? | priorities, tradeoffs, risk tolerance, recurring decision traps | *Emergent* — captured over time from reflections/conversations, not yet modeled. |
| **Progress** | Are they moving? | commitments, habits, goals, wins, setbacks, momentum | **Present** — experiments, habits, streaks already exist. |

**Honest read:** Behavior and Progress are genuinely strong today (the frozen engine). Identity, Preference, and Decision are thin or new — and critically, the engine's *quantitative* substrate is health metrics. So the near-term model is: keep Behavior/Progress quantitative (health as the measurable core), and capture Identity/Preference/Decision **qualitatively** (goals, stated preferences, reflections — which memory already stores and the model already reasons over). Domain-agnostic *numeric* tracking is a later investment (see risks).

---

## 4. Adaptive Roles framework

Synapse has one consistent voice (the charter) but shifts **stance**. Roles are the interaction spine.

| Role | Activates when… | Lead behavior |
|---|---|---|
| **Coach** | a commitment is slipping; they want accountability | hold the line kindly, celebrate real progress |
| **Planner** | a goal is vague or overwhelming | break it into realistic next actions |
| **Advisor** | they face a decision | lay out tradeoffs, recommend, leave the choice with them |
| **Focus Companion** | they're about to / are working | quiet presence, execution support, rare nudges |
| **Teacher** | they want to learn/understand | explain, give examples — don't redirect to accountability |
| **Executor** | they ask for a concrete thing | just deliver it (timer, checklist, draft, summary, plan) |
| **Reflector** | discouraged, stuck, burned out | listen, reflect, sometimes prescribe recovery |
| **Strategist** | reviews, long-horizon direction | connect short-term behavior to long-term goals |

**How Synapse decides (arbitration, in priority order):**
1. **Safety first** — distress/crisis overrides everything (existing safety gate).
2. **Explicit request wins** — if they asked for a timer or a draft, that's Executor, full stop.
3. **Emotional need** — if they're clearly struggling, Reflector before optimization.
4. **Highest-leverage decision** — otherwise, the role that best moves them forward now.
5. **Default** — when nothing's pressing, observe/reflect quietly; don't manufacture a task.

**How roles interact:** exactly **one lead role per response**; others may lightly support (a Coach can end with an Executor offer). Never blend so much that the reply loses a point of view.

**Manual override:** yes — the user can summon a role ("coach me on this," "just plan my day," "stop coaching, just help me write"). An explicit request always beats the system's guess, and a "just help, don't coach" request must stick for the session.

**Avoiding unpredictability:** the role is mostly invisible — consistent voice, so it never feels like different bots. Synapse only *names* a shift when it's meaningful ("want me to switch from thinking-it-through to just planning it?"). No role whiplash within a thread; no surprise accountability when they came to learn.

*(Implementation note: the existing `interventionType` gate — reassure/explain/encourage/advise/experiment/observe/ask — is the seed of this. Roles are the user-facing generalization of it.)*

---

## 5. Feature audit — keep / transform / remove

| Feature | Verdict | Note |
|---|---|---|
| Understanding engine, memory, reasoning, safety | **Keep** | The foundation. Untouched. |
| Conversation / Home | **Keep** → becomes **Talk** + roles | The primary product. |
| Focus tools (timer, checklist) | **Keep** | Daily utility; seed of Focus + orb. |
| "What I've learned about you" | **Keep** → becomes **You** | Absorbs profile + timeline. |
| Adaptive Roles + request-first (charter) | **Keep** | The behavioral spine. |
| Daily check-in | **Transform** | Broaden beyond health sliders → morning intention / evening reflection across domains. |
| Weekly report | **Transform** | Reframe into conversational **Weekly Review** (Strategist), goal-framed. |
| Onboarding | **Transform** | Deepen into Person-Model capture (Identity + Preference), drop clinical-condition framing. |
| Profile (health profile) | **Transform** → merge into **You** | Editable facts/goals living inside the understanding. |
| "Your numbers" dashboard | **Transform/Remove** | Keep only the "connections" as a drill-down inside You; retire the standalone charts page. |
| Assessments | **Transform** | Demote from a tab to a contextual invitation. |
| `/agent`, `/appointment-prep`, `/spaces`, `/timeline` redirects | **Remove** | Dead legacy routes. |
| Provider-questions / appointment prep | **Remove** | Health-clinic framing; keep only the safety "see a provider" line. |
| Symptoms + clinical onboarding as defaults | **Remove** | Make optional/contextual. |
| Billing, Settings | **Keep** (infra) | Quiet in the menu; exempt from the daily-open test. |

---

## 6. Daily use case — why someone opens Synapse

The loop must be legible in a normal day, across domains:

- **Morning:** "What actually matters today?" → Planner/Strategist frames 1–3 things.
- **Before work/study:** "Help me focus." → Focus Companion + timer.
- **During:** quiet presence; a rare, earned nudge (the orb).
- **Stuck on a call:** "Should I do X or Y?" → Advisor.
- **After a bad day:** "I blew it today." → Reflector (recovery, not a lecture).
- **Ad hoc:** "Draft this email / summarize this / make me a checklist." → Executor.
- **Night:** "How did today go?" → reflection that feeds the model.

If a normal Tuesday gives no reason to open Synapse, the architecture has failed — regardless of how smart the engine is.

---

## 7. Persistent presence (the orb) — presence, not surveillance

**What it is:** during a focus session (and later, ambiently), Synapse stays visible as a small, calm orb — a sense that it's *with* you — instead of vanishing after a chat.

- **Intervenes only when it clearly helps:** a genuinely notable moment (longest focus block this week; a run of rapid task-switching; a long stretch earning a break). Rare by design — target roughly one well-timed nudge per session, never a stream.
- **Stays silent** by default, during real flow, when unsure, and whenever the user has signaled "leave me be."
- **Avoids annoyance:** hard rate limits, easy mute/snooze, learns from dismissals (if you wave off break nudges, it stops), never guilt or streak-pressure.
- **Permissions:** explicit, opt-in, per-signal. Starts with only what the user grants — session start/stop and in-app activity (active vs. idle, tab switches) — nothing captured without consent, nothing about *content*.
- **Responsible information:** timing/rhythm signals only (how long, how fragmented, when), never what you're reading or typing. Presence is about cadence, not content.

The test: it should feel like a focused friend sitting nearby, not a manager watching your screen.

---

## 8. MVP scope — the smallest thing that proves the thesis

*Thesis: an adaptive AI that learns one person can help them consistently become better.*

**Must-have (proves the thesis):**
- **Talk** with adaptive roles + request-first (largely live).
- **Person-Model capture:** a deeper onboarding (Identity + Preference) and a broadened daily reflection feeding memory.
- **You:** the consolidated understanding surface (already strong).
- **Focus:** the timer/checklist tools (live) + a **minimal** persistent orb (session timing + one earned nudge).
- The engine, memory, and safety (already here).

**Nice-to-have (soon after):**
- Weekly Review reframed as the Strategist sit-down.
- Assessments as contextual invitations.
- Fuller orb signals (task-switching) with granular permissions.

**Future (explicitly deferred):**
- Domain-agnostic **quantitative** tracking (deep-work hours, study minutes, habit streaks as first-class metrics).
- Cross-device / OS-level persistent presence.
- Integrations (calendar, docs, wearables).

If it isn't required to feel *"it understands me and helps me act today,"* it's not MVP.

---

## 9. Recommended implementation phases

Non-destructive; engine/memory/safety untouched throughout.

- **Phase 0 — Prune.** Delete dead redirects; remove provider-prep; pull stats/assessments out of primary nav. *(Instant simplification, nothing rebuilt.)*
- **Phase 1 — Consolidate "You".** Merge profile + playbook + timeline; fold the useful "connections" in; retire standalone stats. Collapse nav to Talk / Focus / You + menu.
- **Phase 2 — Broaden the model.** Deepen onboarding (Identity/Preference); broaden the daily reflection past health; reframe the report as Weekly Review; make roles read the new preference layer.
- **Phase 3 — Presence.** Minimal Focus Companion orb on the existing timer (session + one earned nudge), opt-in permissions.
- **Phase 4 — Depth.** Assessments contextual; richer orb signals; begin the domain-agnostic metric layer.

Start with Phase 0 + 1 together: highest simplification, lowest risk.

---

## 10. Biggest risks & assumptions

1. **The engine is health-metric-shaped.** Its quantitative power comes from health check-ins. The multi-domain vision leans on qualitative capture until we build domain-agnostic metrics — the single largest real investment. *Assumption:* qualitative understanding + health as the numeric core is enough to prove the thesis. Validate before funding the metric layer.
2. **Retention depends on daily utility, not intelligence.** People return for "help me today," then stay for the understanding. If Talk/Focus aren't useful on an ordinary day, depth never accrues. *Risk:* over-investing in the mirror before the daily hook is sticky.
3. **Persistent presence is a trust knife-edge.** Done well it's magic; slightly wrong it's creepy or nagging. *Assumption:* strict opt-in, cadence-only signals, and dismissal-learning keep it on the right side. Must be tested with real users, conservatively.
4. **Role unpredictability.** If Synapse guesses the wrong stance (coaches when they wanted to vent), trust drops fast. *Mitigation:* request-first, emotional-need-before-optimization, easy manual override.
5. **Scope creep into an "AI operating system."** The vision invites endless surface area. *Mitigation:* the manifesto's tests + a hard MVP line; every feature earns a daily open or waits.
6. **Persistence fragility (pre-existing).** Long-term memory is the promised value, but it's localStorage-first unless cloud sync is fully configured. A person who loses months of understanding loses the product. *This should be hardened before scaling* — arguably a Phase 0 concern too.

---

*North star for every call in this architecture: not to make Synapse feel intelligent — to make the person more capable.*
