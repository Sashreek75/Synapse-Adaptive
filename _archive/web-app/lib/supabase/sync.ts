import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ACCOUNT SYNC — persists the user's whole private record to their account so it
 * follows them across devices. One row per user in `synapse_state`:
 *
 *   create table synapse_state (
 *     user_id uuid primary key references auth.users on delete cascade,
 *     data jsonb not null default '{}'::jsonb,
 *     updated_at timestamptz not null default now()
 *   );
 *   alter table synapse_state enable row level security;
 *   create policy "own row" on synapse_state
 *     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 *
 * Everything degrades gracefully: if the table is missing or the user is signed
 * out, the app keeps working entirely on-device (localStorage).
 */

const TABLE = "synapse_state";

export interface CloudState {
  data: Record<string, unknown>;
  updatedAt: string;
}

/** Point at the setup file when the cause is a missing/blocked table. */
function warnSync(where: string, msg?: string) {
  const hint = /relation .* does not exist|could not find the table|schema cache/i.test(msg || "")
    ? " → the 'synapse_state' table is missing. Run supabase/schema.sql in your Supabase SQL Editor to enable cross-device sync."
    : "";
  console.warn(`[synapse-sync] ${where} failed: ${msg || "unknown error"}${hint}`);
}

export async function loadCloud(sb: SupabaseClient, userId: string): Promise<CloudState | null> {
  try {
    const { data, error } = await sb.from(TABLE).select("data, updated_at").eq("user_id", userId).maybeSingle();
    if (error) { warnSync("load", error.message); return null; }
    if (!data) return null;
    const row = data as { data?: Record<string, unknown>; updated_at?: string };
    return { data: row.data ?? {}, updatedAt: row.updated_at ?? "" };
  } catch (e) {
    warnSync("load", e instanceof Error ? e.message : String(e));
    return null;
  }
}

export async function saveCloud(sb: SupabaseClient, userId: string, data: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await sb.from(TABLE).upsert(
      { user_id: userId, data, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) warnSync("save", error.message);
  } catch (e) {
    // offline / table missing — localStorage remains the source of truth
    warnSync("save", e instanceof Error ? e.message : String(e));
  }
}
