"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, flags } from "@/env";

/**
 * Browser Supabase client for Google login. Returns null when Supabase isn't
 * configured, so the app gracefully runs in on-device mode without accounts.
 */
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!flags.authLive) return null;
  if (_client) return _client;
  _client = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}
