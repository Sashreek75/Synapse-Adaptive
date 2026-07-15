# Synapse Adaptive — Architecture Map

A guide to where everything lives and how data flows. The one promise the whole
codebase serves: **the longer you use Synapse, the better it understands you —
and the better you understand yourself.** Every layer below turns raw check-in
data into personalized understanding.

## The 30-second mental model

```
User check-ins ──► client store (health-store) ──► /api routes ──► ai/ pipeline ──► Gemini
                          │                              │
                          │                              └─► lib/ (deterministic fallback + stats)
                          ▼
                    dashboard / report / chat  (what the user sees)
```

Two golden rules the code follows everywhere:

1. **Code owns the numbers; the model owns the language.** Trends, deltas, and
   confidence ceilings are computed deterministically in `lib/`. Gemini only
   *voices* what the math already established — it never invents statistics.
2. **The product always works, even with no AI key.** Every model call has a
   deterministic fallback, so insights, reports, and chat degrade gracefully
   instead of breaking.

## Directory guide

### `app/` — routes (Next.js App Router)
- `app/(app)/` — the signed-in product, consolidated around the founding doc:
  `dashboard` (the conversation-first HOME: greeting → today's focus → one
  insight → current experiment → embedded chat), `report` (the weekly COACHING
  SESSION), `playbook` (accumulated understanding + open questions), `profile`,
  `assessments` (reason-driven only), `billing`, `settings`. `daily` remains as
  the check-in surface reached from Home. `agent`, `spaces`, `timeline`, and
  `appointment-prep` are now redirects — folded into Home, Playbook, Profile,
  and the coaching session respectively.
- `app/api/` — server endpoints. The important ones:
  - `chat/route.ts` — Synapse conversation. Applies the safety pre-gate, picks a
    per-tier depth directive, calls the pipeline.
  - `report/route.ts` — generates the weekly report + proactive notices.
  - `profile-summary/route.ts` — the Health Profile narrative.
  - `daily-plan/`, `assessment-plan/` — compose personalized check-ins.
  - `billing/` — Stripe checkout, portal, webhook.
- `app/page.tsx` — marketing landing page. `app/login/` — auth.

### `ai/` — the intelligence layer (server-only)
- `client.ts` — the Gemini transport. Lists available models, tries across them,
  **disables "thinking" tokens and sizes the output budget** so answers don't get
  clipped. Start here for any model-behavior issue.
- `pipeline.ts` — the agent pipeline: assemble evidence → call model → validate
  schema → clamp confidence to the data-driven ceiling → safety post-gate →
  deterministic fallback. `generateReport`, `answerChat`, `generateProfileSummary`
  all live here and take a `tier` (free / pro / max) that controls depth.
- `prompts/index.ts` — every system prompt, versioned by ID (traceable per
  generation). Report, chat, proactive, profile, assessment, daily.
- `personality.ts` — Synapse's voice charter (calm, curious, supportive).
- `safety/index.ts` — crisis pre-gate, content post-gate, safety constraints.
- `schemas.ts` — Zod schemas the model output must satisfy. The weekly
  reasoning output now includes `openQuestions`: Synapse maintains its list of
  unanswered questions about the user (max 5 open), marks one "answered" only
  with real evidence, and designs experiments to close them. They live in
  `Mind.openQuestions` (types/index.ts), surface in the Playbook, the Profile
  ("Questions still open"), the coaching session, and steer chat questions.
- `render.ts` — deterministic coach-voice renderers (the always-on fallback).

### `lib/` — deterministic domain logic (the "depth layer")
- `intelligence.ts` — **the heart of the felt product**: session opener,
  today's recommendation + "explain why", memory ("when we started, you told
  me…"), focus areas, evolving-understanding narration. All pure functions over
  the user's own data, so they work offline.
- `stats/index.ts` — `computeTrend`: latest vs baseline, slope, volatility, and
  the **confidence ceiling** (how much certainty the data can support).
- `metrics.ts` — metric definitions (labels, direction of "better").
- `paths.ts` — the user's chosen lens (recovery, cognition, stress, etc.) and the
  goal metrics + fallback copy for each.
- `assessments/` — the adaptive assessment engine, catalog, and planner.
- `billing/plans.ts` — **one source of truth for tiers** (free / pro / max),
  their features, and `planAllows()`. Change tier gating here, nowhere else.
- `email/`, `notifications.ts`, `founder.ts`, `copy.ts`, `utils.ts` — supporting.

### `components/` — UI, grouped by surface
- `providers/` — React context: `health-store` (all user data + derived series),
  `subscription-provider` (active plan; founder = Max), `auth-provider`.
- `synapse/` — Synapse's identity in the UI: the `orb`, `command-center`,
  `explain-why`, `insight-explain`.
- `dashboard/`, `agent/` (chat console), `assessments/`, `daily/`, `onboarding/`,
  `profile/`, `billing/`, `marketing/`, `shell/` (nav/theme), `ui/` (primitives).

### `types/`, `env.ts`, config
- `types/index.ts` — shared TypeScript types (MetricSeries, Insight, HealthReport…).
- `env.ts` — validated environment variables + feature `flags` (`aiLive`,
  `authLive`, `billingLive`). Read flags here, never `process.env` directly.

## How tiers create depth (free / pro / max)

Depth is enforced in two places, both keyed off the same `PlanId`:

- **Which features unlock** — `lib/billing/plans.ts` (`planAllows`).
- **How deeply Synapse reasons** — the `tier` passed into `answerChat` and
  `generateReport`. Free gets a genuine but concise read; Pro connects signals
  across weeks; Max reasons over full history with the largest token budget.
  See `CHAT_DEPTH` in `app/api/chat/route.ts` and `REPORT_DEPTH` in
  `ai/pipeline.ts`.

The founder email (set via `NEXT_PUBLIC_FOUNDER_EMAILS`) is treated as Max in
`subscription-provider.tsx`.

## Common "where do I change X?" answers

| I want to change… | Go to |
| --- | --- |
| How the model behaves / truncation / token limits | `ai/client.ts` |
| What Synapse says in chat / reports (the prompts) | `ai/prompts/index.ts` |
| Depth per tier | `app/api/chat/route.ts` + `ai/pipeline.ts` (`REPORT_DEPTH`) |
| Which tier unlocks a feature | `lib/billing/plans.ts` |
| The dashboard greeting / recommendation logic | `lib/intelligence.ts` |
| Trend math / confidence | `lib/stats/index.ts` |
| Safety / crisis handling | `ai/safety/index.ts` |
| Environment variables & flags | `env.ts` (+ `.env.local`, documented in `.env.example`) |

## Deploying (Vercel)

Secrets are **not** in the repo. Set every key from `.env.example` in the Vercel
project's Environment Variables, set `NEXT_PUBLIC_APP_URL` to the live domain, and
add that domain to Supabase → Authentication → URL Configuration. `NEXT_PUBLIC_*`
vars are baked at build time, so **redeploy after changing them**.
