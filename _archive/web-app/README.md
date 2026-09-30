# Synapse Adaptive

An AI partner in follow-through — it gives you clarity, direction, accountability, and support to
consistently reach the goals that matter. Built with Next.js 14 (App Router), TypeScript, Tailwind,
Supabase (auth + sync), Google Gemini (AI), Stripe (billing), Resend (email), and Web Push.

The app is designed to run **fully without keys** (on-device mode + deterministic AI fallback). Each
integration turns on simply by adding its environment variable — no code changes.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the keys you want (all optional to start)
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (run before every deploy) |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` — the source of truth for correctness |
| `npm run eval:understanding` | Run the conversation-understanding eval suite |
| `npm run lint` | Next.js lint |

> Type safety is enforced via `tsc`; lint is not allowed to block production builds.

---

## Environment variables

All are optional; a feature simply switches on when its keys are present (see `env.ts`). **Anything
without the `NEXT_PUBLIC_` prefix is server-only and must never be exposed to the browser.**

**Core AI**
- `GEMINI_API_KEY` — Google Gemini key. Without it, the app uses a deterministic fallback voice.
- `GEMINI_MODEL` / `GEMINI_FAST_MODEL` — model names (defaults are sensible flash models).

**Auth + database (Supabase)**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — enable accounts + cross-device sync.
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only.** Used by the waitlist + admin aggregation. Full DB access — guard it.
- `NEXT_PUBLIC_FOUNDER_EMAILS` — comma-separated emails treated as founders.

**Admin**
- `ADMIN_PASSWORD` — **required in production** to open `/admin`. There is no default; if unset, the admin API fails closed.

**Billing (Stripe)** — optional; without these, billing runs in a local mock.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_MAX`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

**Email (Resend)**
- `RESEND_API_KEY`, `EMAIL_FROM`.

**Web Push (reach-outs)** — generate with `npx web-push generate-vapid-keys`.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (public), `VAPID_PRIVATE_KEY` (server-only), `VAPID_SUBJECT`.
- `CRON_SECRET` — required if you use the cron backstop; without it the cron fails closed.

**QStash (exact-time background reach-outs)** — the primary scheduler (see below).
- `QSTASH_TOKEN` (publish), `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` (verify the callback). All from the Upstash console.

**App URL**
- `NEXT_PUBLIC_APP_URL` — your deployed origin (used for canonical URLs, sitemap, emails).

---

## Deploying (Vercel)

1. Push to your Git remote and import the repo in Vercel.
2. Add the environment variables above in **Project → Settings → Environment Variables**.
3. Deploy. `npm run build` runs automatically.

### Reach-outs (background notifications)

Background delivery — a reach-out that arrives with the browser **fully closed** — needs a server-side
timer. This app uses **QStash (Upstash)** as the primary scheduler, so there is nothing to poll.

**How it works:** when a reach-out is scheduled (`/api/push/schedule`), the row is saved AND handed to
QStash with an exact fire time. At that moment QStash calls `/api/push/deliver` (verified by signature),
which sends the Web Push. No cron, no per-minute pinger, delivers to the minute even when closed.

**Setup (once):**
1. Create a free account at [upstash.com](https://upstash.com) → QStash.
2. Copy the **Token** and the **Current** + **Next** signing keys.
3. In Vercel → Environment Variables, set `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`,
   `QSTASH_NEXT_SIGNING_KEY`, and make sure `NEXT_PUBLIC_APP_URL` is your real https domain (QStash must
   be able to reach `/api/push/deliver`).
4. Redeploy. That's it — scheduled reach-outs now fire in the background.

**Layers of reliability (all automatic):**
- QStash → `/api/push/deliver` — exact-time background delivery (browser closed). Primary.
- `/api/cron/reachouts` — optional backstop (Vercel daily cron, or an external `?secret=<CRON_SECRET>`
  pinger) that sweeps any row QStash didn't deliver. Deduped by id, so no double-sends.
- In-app catch-up — while a tab is open (even unfocused) it delivers anything still due; it stays quiet
  when the tab is focused (you don't need a notification for a page you're already looking at).

### Supabase setup

- Create the `synapse_state` table with row-level security scoping each row to `auth.uid() = user_id`.
- (Optional) Create the `waitlist` table (SQL is documented in `app/api/waitlist/route.ts`).
- Enable the auth providers you want (Email, Google) and add your deployed URL to the redirect allow-list.

---

## Project layout

```
app/                  Routes (App Router). Public marketing at app/page.tsx; the signed-in app under app/(app)/.
  api/                Route handlers (chat, push, billing, cron, admin, …). Model routes are rate-limited.
ai/                   The AI pipeline: comprehension → mode-scoped generation → grounding; prompts, schemas, safety.
components/           UI. marketing/* (landing), shell/* (app frame), synapse/* (orb), companion-presence.tsx (orb chat).
lib/                  Domain logic: goals, commitments, planner, presence, push, situation, rate-limit, etc.
public/sw.js          Service worker for Web Push.
env.ts                Validated environment (never read process.env elsewhere).
```

## How to make common changes

- **Copy / marketing:** `app/page.tsx` and `components/marketing/*`.
- **Assistant behavior / persona:** `ai/personality.ts` (charter) and `ai/prompts/index.ts` (per-task prompts).
- **Chat reasoning:** `ai/comprehend.ts` (intent + mode), `ai/modes.ts` (per-mode rules), `ai/pipeline.ts` (flow), `ai/grounding.ts` (guardrails).
- **SEO:** metadata in `app/layout.tsx` (+ per-page `metadata`), `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`.
- **Legal:** `app/privacy/page.tsx`, `app/terms/page.tsx`.

## Security notes

- Keep secrets in `.env.local` only; never commit it. Rotate any key that has been shared or exposed.
- Model + waitlist + checkout endpoints are rate-limited (`lib/rate-limit.ts`); `/admin` is password-gated
  and throttled server-side; the cron and admin fail closed without their secrets.
- Before any release: run `npm run typecheck` and `npm run build`, and confirm `ADMIN_PASSWORD` and
  `CRON_SECRET` are set in production.
