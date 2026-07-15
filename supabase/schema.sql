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
