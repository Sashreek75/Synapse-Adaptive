# Synapse Adaptive — Final MVP Audit & Founder Review

*Walked every journey by inspecting the implementation, not assuming. tsc passes. Honest status below — "Complete" only where it truly exists in the product.*

---

## Journey walkthrough (new user → daily use)

- **Landing → sign up → onboarding.** Value prop is now clear ("The AI partner that learns how you work and helps you become who you want to be"). Onboarding is 2 steps (name + a focus path) — deliberately light, but still built on health-condition *paths* under the hood (engine-coupled). **Gap:** it doesn't yet capture cross-domain goals/coaching-style, so day-1 personalization is thin.
- **First conversation.** Strong. Request-first, roles in the charter, warm identity. Real.
- **First focus session.** Now enterable from conversation ("start a work session on X" → inline start → timer with the goal). This is the behavioral win of this pass.
- **First daily reflection.** Works, but the check-in is still health sliders (sleep/energy/stress/mood). Feeds the engine; not yet broadened to work/study/habits.
- **Returning morning open.** Home speaks first (sessionOpener + first-week + the living-voice on You). It remembers and references history. Feels alive **once there's data**; day-1 it's necessarily thin.
- **Weekly review.** Pulls from the reasoning engine (biggest win/concern, mindShift, the surprise, the experiment) — genuinely connects behavior → patterns → one decision. It's a real coaching sit-down, not a relabeled health report.
- **You.** Opens with "Who you're becoming," then theories by lifecycle, habits, questions, evolution. Feels like a mind, not a profile form — the strongest surface.

---

## Product-principle audit

| Product Principle | Status | Evidence | Remaining Work |
|---|---|---|---|
| **Manifesto: adaptive partner, not health app** | ✅ Complete | Identity/charter (v5), nav (Talk/Focus/You), copy sweep done | — |
| **Manifesto: one presence, not a page collection** | 🟡 Partial | 3 surfaces + quiet menu; conversation-first | Focus still routes to /tools rather than living inside the conversation |
| **North star: close intention→action gap** | 🟡 Partial | Charter north star; conversational focus entry; experiment→habit loop | Behavior-change loop only measures *health* metrics; other domains are talk-only |
| **Core loop: understand→role→act→observe→learn** | ✅ (engine) 🟡 (surfaced) | Engine intact; loop runs; You reveals it | "Act/observe" for non-health goals isn't instrumented |
| **Adaptive Roles** | 🟡 Partial | Charter defines all 8; intervention gate; **Focus now entered from language** | Coach/Planner/Advisor/etc. are *voice*, not distinct mechanics; not obvious to the user which role is active |
| **Person Model: Identity** | 🟡 Partial | goals surfaced in You + onboarding | No values/aspirations capture; thin |
| **Person Model: Behavior** | ✅ Complete | correlations + surprise + hypotheses over check-ins | Health-metric-shaped only |
| **Person Model: Preferences** | ❌ Missing | — | Coaching-style/comms prefs not captured or adapted |
| **Person Model: Decision patterns** | ❌ Missing | — | Not modeled; would emerge from Advisor use over time |
| **Person Model: Progress** | ✅ Complete | experiments, habits, streaks, weekly review | — |
| **Confidence + evidence + changing hypotheses** | ✅ Complete | FDR stats, confidence ceilings, "I've changed my mind," rejected theories kept | — |
| **Focus Companion (persistent presence)** | 🟡 Minimal | timer + tab-title + conversational entry | No ambient orb / activity signals (deferred, correctly) |
| **Daily utility (ordinary Tuesday)** | 🟡 Partial | Talk + focus timer + checklist are day-usable | Reflection is still health-only; non-health daily value leans on chat quality |
| **Legacy removed** | ✅ Complete | provider-prep retired, profile/timeline→You, stats/assessments de-navved, dead redirects repointed | `/stats` + `/assessments` routes still exist (reachable, not primary) — intentional |
| **Memory persists & is never lost** | ⛔ **Not done — blocker** | localStorage-first; Supabase optional/unconfigured by default | **Harden before beta.** This is the core promise; losing months of model = fatal |
| **Safety boundaries** | ✅ Complete | pre-gate, post-gate, confidence ceilings, disclaimers intact | — |

---

## "If I were shipping Synapse to 100 beta users tomorrow…"

**1. What would most impress them?**
The conversation once it has ~2 weeks of data: a *non-obvious* pattern about themselves, stated with honest confidence, and Synapse visibly changing its mind. Nothing else on the market does that. The "You" page is the wow surface.

**2. Where would they become confused?**
Day 1 feels quiet — they're told it "learns how you work" but it can't show much yet. The gap between the promise and the empty early state is the #1 confusion. Also: the daily check-in is still health sliders, which clashes with the "work/study/habits" positioning they just read on the landing page.

**3. What would they probably ignore?**
The `/stats` numbers page and the standalone assessments — correctly demoted, but still present. Some will never open them, which is fine.

**4. What would make them return tomorrow?**
The focus timer + "start a work session" flow (immediate, daily), and the first-week "here's what tomorrow's check-in unlocks" hook. The intelligence earns week-2 retention; the tools earn day-2.

**5. What is still not good enough?**
- **Persistence.** localStorage-first means a cleared cache or second device can wipe the very thing they're paying in patience for. This is the one true blocker.
- **Roles are mostly voice.** Only Focus is a felt mode; Coach/Planner/Advisor differ in tone, not in what the product *does*. Honest but not yet the "it becomes the right thing" experience.
- **"Become who you want to be" is still mostly health-shaped** underneath. The vision is broader than the mechanics.

**6. If I had one more week before launch, what would I improve?**
1. **Harden memory** (make cloud sync the default for signed-in users; guarantee no silent loss). Non-negotiable.
2. **Broaden the daily reflection** beyond health sliders to "how did today go / what did you move forward" so non-health goals actually feed the model.
3. **Make the active role visible** — a one-line "I'm coaching / planning / just listening" cue so adaptability is felt, not just claimed.

---

## Completion statement

**Would I hand this to 100 beta users for two weeks today? — Yes, as a *limited* beta, with one fix first: persistence.** Everything else is genuinely ready or honestly scoped:

- **Ready:** the conversation, the intelligence engine (frozen, trustworthy), the You surface, the focus tools + conversational entry, the weekly review, the simplified IA, the identity/copy.
- **Deferred, and I'd defend it:** the ambient orb, domain-agnostic quantitative tracking, deeper onboarding, Preference/Decision layers. None are required to test the core thesis; adding them now would delay learning.
- **Blocker I would not ship without:** memory durability. "I don't want to lose what it's learned about me" is the whole product — shipping that on fragile local storage risks disproving the thesis for reasons that have nothing to do with whether the idea works.

**The one question the MVP can honestly test:** *will people repeatedly use Synapse because it helps them become who they want to become?* — Yes for the **helps-me-act-today** half (tools + conversation, day one) and the **understands-me** half (weeks two–four). The **cross-domain becoming** half is still promise more than mechanic, and that's the honest thing to watch in beta.

*Recommendation: fix persistence this week, ship to a small cohort, and instrument two things above all — daily-open rate on ordinary days, and whether the model visibly deepens over the two weeks. Those answer the thesis; nothing else does.*
