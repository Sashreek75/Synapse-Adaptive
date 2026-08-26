-- ============================================================================
--  Synapse Adaptive — account sync schema
--
--  Run this ONCE in your Supabase project so a user's data follows them across
--  devices. Without this table, the app still works but only stores data on the
--  current device (which is why signing in on a second device re-runs onboarding).
--
--  How to run:
--    1. Supabase dashboard  →  your project  →  SQL Editor  →  New query
--    2. Paste this whole file and click "Run"
--    3. Reopen Synapse on the device that already has your data (so it uploads),
--       then open it on your other device — it will pull your account down.
-- ============================================================================

create table if not exists public.synapse_state (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row-level security: each user can only ever read/write their own row.
alter table public.synapse_state enable row level security;

-- Recreate the policy idempotently so re-running this file is safe.
drop policy if exists "own row" on public.synapse_state;
create policy "own row" on public.synapse_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
--  WEB PUSH — lets Synapse reach out first with an OS notification even when its
--  tab is closed. Two tables:
--    push_subscriptions  — each browser/device the user allowed notifications on
--    scheduled_reachouts — a queue of "message X to user Y at time T" the cron sends
--  Writes happen server-side with the service-role key, so RLS just protects reads.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  ua         text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own subs" on public.push_subscriptions;
create policy "own subs" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.scheduled_reachouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  fire_at     timestamptz not null,
  title       text not null,
  body        text not null,
  url         text,
  kind        text not null default 'reachout',
  status      text not null default 'pending',   -- pending | sent | canceled | failed
  dedupe_key  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists reachouts_due_idx on public.scheduled_reachouts (status, fire_at);
create unique index if not exists reachouts_dedupe_idx
  on public.scheduled_reachouts (user_id, dedupe_key) where dedupe_key is not null;
alter table public.scheduled_reachouts enable row level security;
drop policy if exists "own reachouts" on public.scheduled_reachouts;
create policy "own reachouts" on public.scheduled_reachouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
