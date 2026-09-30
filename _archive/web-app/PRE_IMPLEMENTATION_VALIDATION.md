# Synapse Adaptive — Final Pre-Implementation Validation

*Five product tests, answered before Phase 0 + Phase 1. No code.*

---

## 1. The Daily Open Test — a random Tuesday, first 60 seconds

**Why they open it:** a normal day has friction Synapse is positioned for — *what should I actually do first, help me focus, I have a decision, I had a rough one.* The bet: it's the one place that already knows them and turns "ugh, today" into a clear next move in seconds.

**The first 60 seconds — designed so there is no cold start. Synapse speaks first, from memory.**

- **0s** — It opens already talking, one line grounded in what it knows: *"Morning. You focus best before 10 — you've got ~90 minutes of it. Want to protect it for the deck?"* (Never a blank prompt or a dashboard.)
- **~5s** — Beneath it, at most **three** taps, ordered by what today likely needs: **Plan today · Focus now · Just talk.** No menu, no numbers.
- **~15s** — One tap resolves the day:
  - *Focus now* → a timer starts, the orb settles in, chat goes quiet. They're working inside 20 seconds.
  - *Plan today* → Synapse proposes 1–3 things (Planner), drawn from open commitments, not a blank list.
  - *Just talk* → straight into conversation; it adopts the role the message needs.
- **~60s** — They've either started working, have a plan, or are mid-conversation about the real thing. **Success = an action taken, not a page viewed.**

The design rule: the value is delivered *before* the user has to think. If the first line isn't useful and personal, nothing else matters.

---

## 2. The 90-Day Transformation Test

**What is measurably different about the person:**
- **1–2 habits actually built** — established (repeatedly reinforced), with the behavior visibly holding vs. their week-1 baseline.
- **A shorter recovery curve** — after a bad stretch they bounce back faster than they did in month one (measurable in their own trend data and their reflections).
- **Decisions made with less thrash** — recurring "should I push or rest / keep or change" questions resolved quickly, with the person later agreeing the call was right.
- **Consistency up** — more days acted-on, fewer intention→abandonment gaps.

**Outcomes that prove value (leading → lagging):**
- *Leading (weeks 1–3):* daily-open rate on ordinary days; focus sessions started/completed; check-in/reflection streak; "was this useful?" taps trending up.
- *Mid (weeks 3–8):* first **confirmed** theory about them; first habit reaching "building"; experiments run and reviewed with real outcomes.
- *Lagging (weeks 8–12):* habits **established**; goal-progress the person attributes to Synapse; the retention tell — *"I'd be annoyed to lose what it knows about me."*

**Honest caveat:** some of this is self-reported and hard to isolate from life. The one outcome we can measure cleanly and should treat as the north-star proxy: **do they keep opening it on ordinary days, and does the model visibly deepen (confirmed theories, established habits) over the 90?** If understanding grows but behavior/retention doesn't, we've built a clever mirror, not a product.

---

## 3. The Person Model — exact model of understanding

Five layers. For each: **what it learns · how · confidence semantics · how it changes future help.** Marked ✅ real today / 🟡 partial / 🆕 new.

**Identity — who they're becoming** 🆕
- *Learns:* goals, values, the "why," aspiration across domains.
- *How:* stated directly in onboarding + conversation; rarely inferred.
- *Confidence:* **stated = high** (they told us), but treated as revisable; decays if actions never align.
- *Affects:* the frame for every recommendation ("given you want X…"); what counts as progress; which role leads.

**Behavior — how they operate** ✅ (quantitative, health-derived) / 🟡 (other domains, qualitative)
- *Learns:* rhythms (when they're best), focus/energy patterns, failure modes, what reliably works.
- *How:* the engine — correlations, next-day lag, best/worst-day contrast over daily check-ins; qualitative patterns from notes.
- *Confidence:* **evidence-weighted** — FDR-controlled significance, recurrence, and the confidence ceiling; never exceeds what the data supports. Theories move forming → supported → confirmed, and get **rejected** when contradicted.
- *Affects:* the core of advice ("you focus after a steady morning, not long sleep"); what experiments to run; what to protect.

**Preference — how to help them** 🆕
- *Learns:* coaching style (gentle vs. direct), proactive vs. quiet, accountability appetite, communication length.
- *How:* asked lightly at onboarding; **learned from behavior** — dismissals, what they engage with, explicit "stop coaching."
- *Confidence:* starts low (stated), rises with consistent behavioral confirmation.
- *Affects:* HOW every role is delivered; orb frequency; whether to challenge or reassure.

**Decision — how they choose** 🟡 emergent
- *Learns:* priorities, tradeoffs, risk tolerance, recurring decision traps ("says yes then regrets it").
- *How:* observed across Advisor conversations and their retrospectives over time; not a form.
- *Confidence:* low until a pattern recurs several times; explicitly tentative.
- *Affects:* how decisions are framed back ("last two times you decided at night you regretted it — sleep on it?").

**Progress — are they moving** ✅
- *Learns:* commitments, habits, goal movement, wins, setbacks, momentum.
- *How:* experiment outcomes, habit reinforcement, streaks, trend deltas.
- *Confidence:* directly measured.
- *Affects:* what to reinforce, what to revisit, when to celebrate vs. challenge; the Weekly Review.

**Cross-cutting:** every piece of evidence is **domain-tagged** (work/edu/fitness/habits/health/…) and **time-stamped**, so the model can say "in your *work* focus, mornings win" without conflating domains. Confidence is a first-class field everywhere — the product's honesty depends on it.

---

## 4. The Differentiation Test — vs. ChatGPT with memory, proactivity, tools, calendar

Answered in mechanics, not branding. What Synapse does that a general assistant with those features still would not, by construction:

1. **A self-correcting, evidence-weighted model — not recall.** ChatGPT-memory stores facts and recalls them. Synapse maintains *theories with confidence that get falsified.* It says "I was wrong — I no longer think sleep is your lever." A general model optimizes for fluent agreement and rarely retracts. Retraction is a mechanic here, not a mood.

2. **Honest longitudinal statistics.** Synapse computes correlations, next-day lags, and best/worst-day contrasts over daily data with **false-discovery-rate control and confidence ceilings** — code owns the numbers, the model only voices them. A general assistant pattern-matches narrative and will confidently assert relationships that are noise. Our differentiator is *what we refuse to claim.*

3. **A surprise engine that suppresses the obvious.** An obviousness prior actively demotes "sleep makes you tired" and promotes the non-obvious second-order pattern that recurs. General assistants regress to generic, popular advice; Synapse is engineered to find the thing only *this* person's data shows.

4. **A closed behavior-change loop.** notice → one rare, gated experiment → observe outcome → confirm/reject → graduate to a tracked habit. Outcomes feed back and change confidence. A general assistant gives advice and forgets whether it worked; Synapse's help compounds because it measures itself.

5. **Restraint as a feature.** An intervention gate makes experiments rare, confidence-matched language prevents overclaiming, and the orb speaks ~once a session. General assistants optimize for helpful-sounding volume; Synapse's trust comes from *engineered silence.*

**The brutal caveat (product truth, not comfort):** a general assistant with perfect memory + proactivity + tools could *approximate* the conversational surface. Our moat is **only** the disciplined, self-correcting, confidence-bounded person-model and the loops built on it. If we ever let that discipline slip — overclaim, skip falsification, nag — we become a skin over ChatGPT and we deserve to lose. Differentiation is *conditional on keeping the rigor*, which is exactly why the engine was frozen.

---

## 5. The MVP Kill Test

**Three things that absolutely must work (kill the product if they don't):**
1. **The 60-second daily open delivers real value on an ordinary day.** Talk + Focus must be genuinely useful when nothing's wrong. This is the hook; without it, depth never accrues and no one returns.
2. **Memory persists and visibly compounds — and is never lost.** It must remember, reference the past unprompted, and demonstrably get sharper over weeks. This is the moat and the emotional lock-in. *(Implies hardening persistence beyond fragile local storage before scaling — losing months of a person's model is fatal.)*
3. **Role selection is right often enough.** Request-first, emotional-need-before-optimization, easy override. Getting the stance wrong (coaching when they wanted to vent) breaks trust faster than any feature builds it.

**Three things to intentionally ignore (for now):**
1. **Multi-domain quantitative tracking.** Keep health as the numeric core; capture work/study/habits qualitatively. Do not build a domain-agnostic metric engine yet.
2. **OS-level / cross-device persistent presence.** In-app, minimal orb only. No background daemon, no screen monitoring.
3. **Breadth of execution tools & integrations.** One timer + one checklist + chat-based drafting/summarizing is enough. No calendar sync, wearables, doc editing, or tool sprawl.

**The line:** if it isn't required to make a person feel *"it understands me and it helped me act today,"* it is out of the MVP.

---

*Validation stance: the concept is sound and the engine is real. The two things that will actually decide success are (a) the daily-open hook and (b) not losing the memory — both are product/mechanics problems, not intelligence problems. Build Phase 0 + 1 with those as the bar.*
