# Synapse Adaptive — Brutal MVP Review

*Reviewed from the actual codebase (AI pipeline, stats, correlations, assessments, persistence, landing page, onboarding), not the marketing description. Perspective: a brand-new user who found this today, plus a PM/investor who will not be flattered.*

---

## Headline verdict

This is **not** a ChatGPT wrapper. There is a real deterministic reasoning layer underneath the model — least-squares trends, Pearson correlations with next-day lag, confidence ceilings the model can only lower, Zod-validated output, a crisis pre-gate, and a full deterministic fallback so the product works with no AI key. That is genuinely more product insight than 90% of "AI health companion" MVPs.

But you asked me to break it, so: **the product's entire value is deferred by weeks, its core promise ("remembers you over months") runs on localStorage by default, its "scientifically grounded" scores are invented constants, and a new user's first session is a near-empty screen and a chat box.** You get one first impression, and right now the first impression is a promise, not a payoff.

**Readiness: ⚠️ Limited beta. Not a public launch.**

---

## Scores

| # | Category | Score |
|---|----------|-------|
| 1 | First Impression | 7/10 |
| 2 | Onboarding | 5/10 |
| 3 | AI Intelligence | 7/10 |
| 4 | Health Profile | 6/10 |
| 5 | Assessments | 6/10 |
| 6 | Insights | 7/10 |
| 7 | Personalization | 6/10 |
| 8 | Conversation Quality | 7/10 |
| 9 | Trust | 8/10 |
| 10 | User Experience | 7/10 |
| 11 | Retention | 4/10 |
| 12 | Magic Moment | 4/10 |
| 13 | Competitive Advantage | 6/10 |

---

## 1. First Impression — 7/10

The landing page is good and, rarer, honest. Hero: *"A health companion that actually knows you… Talk to Synapse like a coach who remembers everything."* A visitor understands the pitch in under 30 seconds, and the "Apple Health vs. Synapse" comparison sharpens *why it exists*. The testimonials section even refuses to fake quotes ("We're early, so instead of putting words in users' mouths, here's what the product commits to"). That builds trust.

The problem: **there is no demo.** Both the "Meet Synapse" CTA and the footer "Demo" link route straight to `/login`. The hero's "demo" is faux — hardcoded floating cards with static bars `[62,78,70,84,88,92]`. So the single most differentiating thing you have — the reasoning — is invisible until someone signs up, onboards, and logs data for weeks. You're asking for a leap of faith at the exact moment you could show the goods.

## 2. Onboarding — 5/10

Two steps: first name, then pick goal(s) from eight options, plus an optional free-text box. The code header states this is deliberate: *"The health profile is NOT built here; it emerges over weeks."* Philosophically defensible, and the low friction is nice.

But brutally: it collects almost nothing. No age, sex, medications, baseline sleep, work schedule, or condition detail. So on day one Synapse cannot say anything specific about *you* — only about your chosen lens. "Believable health profile"? No — it's a category label, not a profile. The free-text field is your one shot at real signal and it's optional and easy to skip. You've optimized for "no long forms" so hard that the AI starts nearly blind.

## 3. AI Intelligence — 7/10

Real, and the best-engineered part. `computeTrend` does an actual least-squares slope, population-std volatility, and a data-only confidence ceiling (`n<5 → low; n<10 or volatile → moderate; else high`). `computeAssociations` computes real Pearson correlations including a **next-day lag** (correctly requiring consecutive calendar days) and best/worst-third contrasts. The pipeline clamps model confidence to the ceiling — *"you may only go lower"* — and the prompts are unusually disciplined: *"NEVER claim the user told you or did something unless it appears in recentNotes… Fabrication is the worst thing you can do."*

It does **remember** and reference history: the context builder assembles trends, streaks, correlations, beliefs, open questions, playbook, and past experiment outcomes; the reasoning engine even revises its own beliefs ("I've changed my mind") and maintains open questions. This is architecturally a proper agent, not a prompt.

Where it's thin: it runs on **Gemini free tier**, so under load or quota it silently degrades to the deterministic fallback — the "intelligence" a paying user sees may not be the model at all. And the statistics are rigor-light: surfacing correlations at **n≥5 with r≥0.5 and no multiple-comparison correction** across dozens of metric pairs will manufacture spurious "patterns." Several thresholds are magic numbers, and the fatigue-vs-reaction divergence detector is hardcoded rather than general.

## 4. Health Profile — 6/10

The concept — a "Personal Playbook" of beliefs, open questions, and experiment track record that grows over time — is genuinely differentiated and mostly real in code. It updates logically (experiment outcomes feed track-record entries; open questions get reconciled and capped).

Two hits. First, it's empty and generic until weeks of data accumulate, so a new user can't tell it apart from a static settings page. Second, and worse, it lives in **localStorage by default** (see §9) — so the profile that's supposed to deepen "over months" can vanish on a cache clear or a second device. The thing you're asking users to invest in is the thing most likely to disappear.

## 5. Assessments — 6/10

Five cognitive tasks are genuinely implemented as working interactive tests — reaction time (random 800–2600ms delay, median of trials, early-tap detection), go/no-go, an adaptive memory-span staircase, visual search, and pattern recognition — plus self-report sliders and a daily check-in that the AI composes fresh each day with a deterministic fallback. Instructions are clear and human. That's real work and it functions.

But "scientifically grounded" is overclaimed. Scoring is invented: `normReactionMs = 100 - (ms-220)/6`, `normSpan = span/9*100`, self-report `level*20`. No age/sex norms, no percentiles, **no validated instruments** (no PSQI for sleep, no PHQ for mood). The scores are internally consistent but scientifically unvalidated, and a health product implying clinical grounding it doesn't have is a trust and liability risk. Separately, there's dead legacy code: an older `ASSESSMENTS` catalog that's been superseded by the engine but still ships.

Would users do these weekly? The tasks are engaging enough for a few weeks; sustaining it depends on the payoff arriving (see §11–12).

## 6. Insights — 7/10

Your most important category, and the design is right. Insights follow Observation → Reasoning → Why it matters → Suggested focus → Question for provider, each carrying `confidenceRationale`, `alternativeExplanation`, `wouldChange`, and `uncertaintyFlags` pulled from real stats. It connects multiple metrics (the lag correlations), cites its evidence, and frames everything as association not causation. When it fires with real data, a user *will* learn something they couldn't see in a graph. This is the moat.

The caveat is upstream: the insight is only as good as the correlation feeding it, and the weak statistical gating (§3) means some "insights" will be noise dressed as signal. In a health context, a confident-sounding spurious correlation is actively harmful to trust. Tighten the math before you tighten the prose.

## 7. Personalization — 6/10

Genuinely history-driven where data exists: focus selection scores your declining goal metrics, experiments are reviewed against *your* post-start check-ins, and memory ties your onboarding goal to your currently-improving metrics with real dates. But the per-metric explanatory prose comes from a hardcoded `REC_COPY`/`PLAYBOOK` map, so **two users with the same focus metric get identical "alternative explanation" sentences.** The scaffolding adapts; the words often don't. And day one, before data, everyone gets the same path-based copy.

## 8. Conversation Quality — 7/10

The chat is the real centerpiece and it's wired up: deep context injection, a crisis pre-gate with a dedicated response, structured answer sections, suggestion chips, typing indicator. The persona charter is strong ("the smartest person in the room who is also the calmest," admit uncertainty plainly). It should feel thoughtful and human.

Risk: the chat prompt is over-engineered for *format* — mandatory emojis, a required "Also worth knowing," always "make ONE offer." That machinery tends to produce a formulaic rhythm and can manufacture confident-sounding extras when the data is thin. The instinct to always converge on "ONE thing" is good coaching but can feel scripted after a week.

## 9. Trust — 8/10 (your strongest category)

Genuinely well done: no fabricated testimonials, explicit uncertainty language, confidence ceilings enforced in code, hard boundaries against diagnosing/prescribing, a crisis pre-gate, and "discuss with your provider" routing. The tone is calm and non-alarmist by design.

Two things undercut it, and they're serious. (1) **Persistence.** By default data is localStorage-only under `synapse.recovery.v3`; Supabase sync exists only if env keys are set, the user signs in, *and* the operator manually ran `schema.sql` — and even then it's a last-write-wins JSONB blob that swallows errors. The schema comment itself admits "signing in on a second device re-runs onboarding." A product whose one promise is "remembers you over months" cannot lose your history on a cache clear. (2) The unvalidated scores presented as scientific (§5). Fix these two and this is a 9.

## 10. User Experience — 7/10

High polish for an MVP: canvas neural background that pauses offscreen, scroll reveals, skeleton loaders, a "thinking" orb, and real accessibility care — `prefers-reduced-motion` respected, `aria` labels, focus-visible rings. Broad route surface (dashboard, report, playbook, profile, assessments, daily, billing, settings). The weak spot is the day-one home: `GeneratedDashboard` returns `null` when nothing has moved, so a new user sees a greeting, a check-in card, and a chat box floating in empty space. Framed as "if nothing moved, show nothing" — but to a newcomer it reads as "unfinished."

## 11. Retention — 4/10

This is where the MVP is weakest. Tomorrow, a new user has one reason to return: do another check-in on faith. There's no streak reward that matters yet, no insight yet, no "come back and see what I noticed." The free tier also caps chat at 5 messages/day, which throttles the one surface that *is* engaging on day one. You're asking for three weeks of unrewarded logging before the product pays out. Most users churn in three days.

## 12. Magic Moment — 4/10

The magic moment is real and well-designed — it's the first insight that connects two things you didn't consciously link ("your focus dips the week after your sleep gets inconsistent"). The problem is purely timing: it arrives around **week 2–4**, and your onboarding collects nothing that would let you fake or accelerate it on day one. For a product living or dying on first impressions, the payoff is on the wrong side of the churn cliff.

## 13. Competitive Advantage — 6/10

If a user survives to week 3, they can articulate the edge over Apple Health/Fitbit/ChatGPT: those show data or forget you; Synapse reasons over *your* history and remembers. That's a real, defensible story. On day one, they cannot — it looks like a wellness journal with a chatbot. Your advantage is entirely back-loaded, and today nothing on the landing page or in the first session *demonstrates* it (no demo, no sample report).

---

## 14. MVP Readiness: ⚠️ Release to limited beta

Not a public launch. The engineering quality is real and the trust posture is admirable, but three things make a public one-shot launch reckless: (1) default localStorage persistence can silently destroy the core promise; (2) the value payoff lands weeks after the churn point with nothing to bridge the gap; (3) "scientifically grounded" scoring that isn't. A limited, hand-held beta — where you can watch retention, confirm persistence works, and see whether the week-3 magic moment actually lands — is exactly the right move. A public launch today burns your one first impression on a product that can't prove itself in the first session.

---

## Biggest Strengths (top 5)

1. **A genuine reasoning architecture, not a prompt.** Deterministic stats own the numbers; the model only voices them; confidence is clamped to a data-driven ceiling. This is the real thing.
2. **Trust posture.** No fake testimonials, enforced uncertainty, crisis gate, no-diagnosis boundaries, honest early-stage tone.
3. **The insight format.** Observation → reasoning → why → focus → provider question, with alternative explanations and confidence rationale attached. This is the differentiator.
4. **Real, working assessments and an AI-composed daily check-in** with graceful deterministic fallbacks throughout.
5. **Polish and accessibility** well beyond typical MVP standard (reduced-motion, aria, skeletons, thoughtful empty states).

## Biggest Weaknesses (worst first)

1. **Persistence is localStorage by default** — the "remembers you for months" promise can be wiped by a cache clear or a second device. Existential for this product.
2. **Value is deferred weeks past the churn cliff** — day one has no payoff and nothing bridges the gap.
3. **No demo anywhere** — every CTA dead-ends at login; the one differentiator is invisible until you commit and wait.
4. **"Scientifically grounded" scoring is invented constants** — no norms, no validated instruments; a trust/liability risk in a health product.
5. **Weak statistical gating** — correlations surface at n≥5, r≥0.5, no multiple-comparison correction → spurious "insights" likely.
6. **Runs on Gemini free tier** — silently falls back to non-AI templates under quota/load; paying users may not get the model.
7. **Onboarding collects almost nothing** — no age/sex/meds/baseline, so day-one personalization is a category label.
8. **Billing not persisted** — `webhook/route.ts` has `TODO(persistence)`; plan upgrades aren't stored server-side.
9. **Canned per-metric prose** — two users with the same focus metric get identical "insight" sentences; personalization is thinner than it looks.
10. **Empty day-one dashboard** — home renders near-nothing before data, reading as unfinished; plus shipped dead legacy assessment code.

## High-Impact Improvements by Timeline

**If 1 day:** Add a synthetic "meet Synapse with a demo user" — a pre-seeded example account or read-only sample weekly report reachable from the landing page, so the reasoning is *visible* before signup. This alone fixes the biggest first-impression gap. Also add a persistence warning banner if Supabase isn't configured.

**If 1 week:** Make cloud persistence the default and non-optional for signed-in users (fix silent sync failures, verify schema is applied). Kill the "scientifically grounded" framing or scope it honestly ("relative to your own baseline, not clinical norms"). Add a day-one "first insight preview" using onboarding answers so the payoff starts on session one.

**If 1 month:** Tighten the statistics (raise n thresholds, add a multiple-comparison correction, generalize the divergence detector) so surfaced insights are trustworthy. Enrich onboarding with a few high-value optional questions (baseline sleep, work rhythm, meds context). Move off free-tier Gemini for paid users so tiers actually differ. Build a real retention loop (a reason to return tomorrow, not just in three weeks).

## Deal Breakers (would make me delay launch)

1. **Default localStorage-only persistence** for a product promising long-term memory. Data loss here isn't a bug, it's a broken promise.
2. **Scoring presented as scientific but based on unvalidated constants** in a health context — fix the framing or the framing will get you in trouble.
3. **Billing persistence TODO** — do not take money through a path that doesn't reliably record what the user bought.
4. **Silent AI degradation on free-tier quota** — users can't tell when they're getting the model vs. templates; at minimum this must be observable to you.

## Hidden Opportunities (max perceived intelligence, minimal engineering)

- **Fake-nothing "cold read" on onboarding finish.** You already call `/api/profile-summary`. Have Synapse ask one sharp follow-up based on the chosen goal and reflect it back immediately ("You picked recovery *and* mentioned poor sleep — I'll watch how those move together"). Instant sense of being understood, zero new infra.
- **Surface the open questions and beliefs you already track.** Showing "Here's what I'm still trying to figure out about you" makes the AI feel like it's actively thinking. The data structure exists; just render it prominently.
- **"I changed my mind" moments.** You already model belief revision — make it a visible, celebrated event in the UI. Nothing signals real intelligence like an AI that visibly updates.
- **A sample weekly report on the marketing site.** The deterministic renderer can generate a realistic one from synthetic data — put it behind "See a real Synapse report." Converts skeptics without a live account.
- **Day-one "prediction" framing.** Let Synapse state a hypothesis it will test ("My guess: your focus tracks your sleep — let's find out in two weeks"). Turns the empty-data period into a story the user wants to see resolved, directly attacking the retention gap.

## Final Verdict (as an investor)

Yes — this demonstrates real product insight, and I'd want a second meeting. The separation of "code owns the numbers, the model owns the language," the confidence ceilings, the belief revision, the crisis gate, and the refusal to fake testimonials are the fingerprints of someone who has thought hard about what an *honest* health AI should be. This is not an AI wrapper.

But it's a strong engine wrapped in a weak first five minutes. The intelligence is real and largely invisible; the promise is long-term but the storage is fragile; the science is claimed but not validated. Right now it reads as an excellent architecture in search of a first-session payoff. Fix the demo, the persistence, and the science framing, and you have something genuinely differentiated. Launch it publicly today and most people will bounce before they ever see why it's good — and you'll have spent your one first impression proving nothing.
