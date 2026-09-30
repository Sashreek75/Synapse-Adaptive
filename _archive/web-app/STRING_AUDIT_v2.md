# Visible-String Audit — old identity → manifesto (proposed, not yet applied)

*Wording only. No behavior, routes, component names, engine ids, or medical/safety disclaimers change. Every rewrite makes the string answer "how does this help me become who I want to become?" instead of "how do I inspect my health data?"*

---

## Browser / SEO — `app/layout.tsx`
- **title** "Synapse Adaptive — AI Health Intelligence" → **"Synapse Adaptive — your adaptive partner"**
- **keywords** ["health intelligence","recovery","AI health","cognitive performance","wellness","rehabilitation"] → **["adaptive coach","self-understanding","habits","focus","personal growth","AI companion"]**

## Landing page — `app/page.tsx`
- eyebrow "An AI health companion that learns you" → **"An AI partner that learns how you work"**
- hero H1 "A health companion / that actually knows you." → **"A partner that / actually knows how you work."**
- features subhead "Does this help you make a better-informed health decision between appointments? If not, it isn't here." → **"Does this help you become who you're trying to become? If not, it isn't here."**
- feature "Your numbers, on demand — A clean dashboard whenever you want to see the trends — but the coaching is the point, not the charts." → **"The picture, on demand — See how you actually work whenever you want; the understanding is the point, not the charts."**
- roadmap Now "…proactive insights, and your numbers on demand." → **"…proactive insights, and a picture of how you work that deepens every week."**
- roadmap Later "Shareable provider summaries and, eventually, clinician tools." → **"Working alongside the people and tools you already rely on."**
- big CTA H2 "Meet a health companion that learns you." → **"Meet a partner that learns how you work."**
- footer "An AI health companion that learns you and helps you decide what to do next." → **"An AI partner that learns how you work and helps you become who you want to be."**
- pricing "…proactively, on your dashboard — plus the ability…" → **"…proactively, right in the conversation — plus the ability…"**
- *(Kept verbatim: all "general wellness & education — never diagnosis or treatment" disclaimers, and the FAQ medical-device answer — safety/legal.)*

## Login — `app/login/page.tsx`
- subtitle "Your health intelligence companion — accessible anywhere you sign in." → **"Your adaptive partner — with you anywhere you sign in."**
- button "Go to dashboard" → **"Continue"** *(route unchanged)*

## Conversation — `components/agent/agent-console.tsx`
- cold intro "Hi {name} — I'm **Synapse**, your health companion. 👋 I get more useful the more I learn about you. Do a quick check-in and I'll start reasoning over your real patterns…" → **"Hi {name} — I'm **Synapse**, your adaptive partner. 👋 I get more useful the more I learn about how you work. Tell me what you're working on, or do a quick check-in, and I'll start finding your patterns."**
- model-context capability line about "Your numbers" / "dashboard" → reworded to: **"They can still see the underlying numbers (a stats view exists), but lead with what it means for them and where they're headed, never the charts."** *(context guidance only; keeps the /stats reference so the model can still point there)*
- *(Kept: the two wellness disclaimers under the composer.)*

## Chat fallback greeting — `app/api/chat/route.ts`
- "I'm Synapse — your health intelligence companion… connecting the dots in your health over time… complete a check-in…" → **"I'm Synapse — your adaptive partner. I'm fond of the name: a synapse is where signals connect, which is exactly my job — connecting the dots in how you work over time so you can act on them. Good to meet you. Tell me what you're working on, or do a quick check-in, and I'll start learning how you tick."**

## Onboarding — `components/onboarding/onboarding-flow.tsx`
- subtitle "I'm here to help you make better everyday health decisions, and I get sharper the longer we work together." → **"I'm here to help you become who you're working to become — and I get sharper the longer we work together."**
- footer note "…you can see it grow under Health profile." → **"…you can watch it grow under You."**
- *(Optional, flag for your call — domain option labels still map to health paths; light de-clinicalizing only:)* "My recovery after an injury or surgery" → **"Recovering from an injury or surgery"**; "My athletic readiness and recovery" → **"Training & athletic performance"**. I'd leave the rest and keep all `path` ids identical.

## Settings — `app/(app)/settings/page.tsx`
- row label "Recovery" → **"Focus"** *(value unchanged)*
- row label "Stage" → **"Phase"** *(value unchanged)*
- toggle "Assessment is ready / A gentle nudge when your next assessment opens." → **"Weekly review is ready / A gentle nudge when your weekly review is ready."**

## Tour — `components/tour/feature-tour.tsx`
- step "Tap the menu… your health profile, playbook, weekly session, an assessment…" → **"Tap the menu — Talk, Focus, and You, plus your weekly review."**
- step title "Your numbers, when you want them" + "Open 'Your numbers' from the menu for the visual dashboard…" → **"You — how Synapse sees you"** + **"Open You any time to see what Synapse has learned about how you work — your patterns, what's helping, and what it's still figuring out."**

## Microcopy — `lib/copy.ts`
- milestone body "Steady, consistent effort is exactly what moves recovery forward." → **"Steady, consistent effort is exactly what moves you forward."**

## Orphaned-but-visible-if-reached — `components/dashboard/health-narrative.tsx`
- section label "Your Health Profile" → **"How Synapse sees you"** *(component now only reachable via legacy paths; updated for consistency)*

## Stats (secondary surface) — `app/(app)/stats/page.tsx`
- empty-state H1 "Your dashboard lives here" → **"Your numbers live here"** *(kept as an honest secondary "numbers" view; not re-elevated)*

---

## Intentionally NOT changed
- **Routes & component/function names** (`/dashboard`, `/stats`, `GeneratedDashboard`, etc.) — behavior/architecture must not move.
- **Medical & safety disclaimers** — kept verbatim (legal + safety layer).
- **Engine-coupled ids & values** — `path: "recovery_injury"`, metric keys, `recoveryStage` values — wording of *labels* only, never the stored ids.
- **Code comments** — not user-visible, out of scope.

*Approve (whole list or line items) and I'll apply, then run tsc + a visible-string re-scan to confirm no old-identity language remains on the primary surfaces.*
