# Reach-outs (Web Push) — setup

This makes "I'll check in in an hour" real: Synapse sends an OS notification even when its tab is
closed (as long as the browser is running). Three things to configure once.

## 1. Environment variables

Generate a VAPID keypair with `npx web-push generate-vapid-keys`, then set these ONLY in your Vercel
project (Settings → Environment Variables) and your local `.env.local` — **never commit real values
to git**:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your-vapid-public-key>
VAPID_PRIVATE_KEY=<your-vapid-private-key>
VAPID_SUBJECT=mailto:support@compliancewatchdog.com
CRON_SECRET=<a-long-random-string-you-invent>
```

Also required (you already have these for auth): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Database

Run `supabase/schema.sql` in the Supabase SQL Editor. It now also creates `push_subscriptions`
and `scheduled_reachouts` (safe to re-run — everything is `if not exists`).

## 3. The scheduler (cron)

`vercel.json` already registers a cron that hits `/api/cron/reachouts` every minute. On Vercel this
requires a plan that allows minute-level crons; Vercel automatically sends your `CRON_SECRET` as a
Bearer token so only it can trigger sends.

No Vercel? Point any external pinger (e.g. cron-job.org) at:
`https://YOUR_DOMAIN/api/cron/reachouts?secret=YOUR_CRON_SECRET` every 1–5 minutes.

## How it works

- A user turns on reach-outs in **Settings → Notifications → "Let Synapse reach out first"** (grants
  notification permission, registers the service worker at `/sw.js`, saves the device server-side).
- When Synapse commits to a later check-in, it emits a hidden `[[reachout: <minutes> | <message>]]`
  tag; the client schedules it via `/api/push/schedule`. The tag never shows to the user.
- Every minute the cron finds due reach-outs and pushes them to the user's devices. Dead devices are
  pruned automatically.
- "Send a test" in Settings fires one immediately so you can confirm the whole loop.

## Notes / next steps

- **Desktop** (Chrome/Edge/Firefox): works whenever the browser is running, tab open or not.
- **Mobile**: to reach phones, add a web app manifest + "Add to Home Screen" (iOS 16.4+ delivers web
  push to installed PWAs). That's the recommended next step — it keeps mobile without a native app.
- **Email/SMS fallback** was intentionally deferred per your call; the code path is isolated so it can
  be added later without touching this.
