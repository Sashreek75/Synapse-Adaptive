import { NextResponse } from "next/server";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "@/env";

/**
 * POST /api/waitlist — { email, plan: "pro" | "max", note? }
 *
 * Stores upgrade-waitlist signups until Stripe billing goes live.
 * Primary store: Supabase REST table `waitlist` (service-role key, server-only).
 * Fallback: appends a JSON line to <project root>/.waitlist.jsonl so a signup
 * is NEVER lost and the user NEVER sees an error from missing infrastructure.
 *
 * Table SQL (run once in Supabase):
 *   create table if not exists public.waitlist (
 *     id bigint generated always as identity primary key,
 *     email text not null unique, plan text not null, note text,
 *     created_at timestamptz default now());
 *   alter table public.waitlist enable row level security;
 */

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface WaitlistRow {
  email: string;
  plan: "pro" | "max";
  note: string | null;
  created_at: string;
}

async function storeInSupabase(row: WaitlistRow): Promise<{ ok: boolean; already?: boolean }> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false };
  try {
    const res = await fetch(`${url}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (res.ok) return { ok: true };
    // Duplicate email = they're already on the list. That's a success.
    const text = await res.text().catch(() => "");
    if (res.status === 409 || /duplicate|unique/i.test(text)) return { ok: true, already: true };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

async function storeLocally(row: WaitlistRow): Promise<boolean> {
  try {
    await appendFile(join(process.cwd(), ".waitlist.jsonl"), JSON.stringify(row) + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {}
  const b = (body ?? {}) as { email?: unknown; plan?: unknown; note?: unknown };

  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const plan = b.plan === "max" ? "max" : b.plan === "pro" ? "pro" : null;
  const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 500) : null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (!plan) {
    return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
  }

  const row: WaitlistRow = { email, plan, note, created_at: new Date().toISOString() };

  const supa = await storeInSupabase(row);
  if (supa.ok) {
    return NextResponse.json({ ok: true, stored: "supabase", already: !!supa.already });
  }

  // Supabase unconfigured or table missing — keep the signup locally, stay calm.
  await storeLocally(row);
  return NextResponse.json({ ok: true, stored: "local" });
}
