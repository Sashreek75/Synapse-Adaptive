import { NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "@/env";
import { rateLimited } from "@/lib/rate-limit";

/** Constant-time string compare so the password can't be timing-attacked. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * POST /api/admin/stats — { password }
 *
 * Founder-only overview of the whole user base. Because row-level security stops any
 * browser from reading another user's data, the aggregation MUST happen server-side with
 * the Supabase service-role key. The password is verified here (not just in the UI), so the
 * endpoint can't be scraped by hitting it directly.
 *
 * Note on scope: only the cloud-synced snapshot is visible here (profile, check-ins, chat,
 * the mind model, spaces). Goals/commitments currently live in each device's localStorage and
 * are NOT synced, so per-goal counts can't be reported until that's added to the sync payload.
 */

export const runtime = "nodejs";

type Row = { user_id: string; data: Record<string, unknown>; updated_at: string | null };
type AuthUser = { id: string; email?: string; created_at?: string; last_sign_in_at?: string };

async function fetchRows(url: string, key: string): Promise<Row[]> {
  try {
    const res = await fetch(`${url}/rest/v1/synapse_state?select=user_id,data,updated_at`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as Row[];
  } catch { return []; }
}

async function fetchAuthUsers(url: string, key: string): Promise<AuthUser[]> {
  try {
    const res = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const j = await res.json();
    return (Array.isArray(j) ? j : j.users ?? []) as AuthUser[];
  } catch { return []; }
}

export async function POST(req: Request) {
  // Brute-force protection: this endpoint returns all-user PII, so throttle hard, server-side.
  if (rateLimited(req, "admin-stats", 5, 10 * 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
  }
  // Fail CLOSED if no admin password is configured — never fall back to a guessable default.
  if (!env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
  }
  let body: unknown = null;
  try { body = await req.json(); } catch {}
  const password = typeof (body as { password?: unknown })?.password === "string" ? (body as { password: string }).password : "";

  if (!safeEqual(password, env.ADMIN_PASSWORD)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: true, configured: false });
  }

  const [rows, authUsers] = await Promise.all([fetchRows(url, key), fetchAuthUsers(url, key)]);
  const emailById = new Map<string, AuthUser>();
  for (const u of authUsers) emailById.set(u.id, u);

  const now = Date.now();
  const DAY = 864e5;
  let onboarded = 0, active7 = 0, active30 = 0, totalCheckIns = 0, totalChat = 0, totalSpaces = 0, withAspiration = 0;
  const areaCounts: Record<string, number> = {};
  const users: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const d = (row.data ?? {}) as Record<string, unknown>;
    const profile = (d.profile ?? {}) as Record<string, unknown>;
    const mind = (d.mind ?? {}) as { trajectory?: { statement?: string } };
    const checkIns = Array.isArray(d.checkIns) ? d.checkIns.length : 0;
    const chat = Array.isArray(d.chat) ? d.chat.length : 0;
    const spaces = Array.isArray(d.spaces) ? d.spaces.length : 0;
    const aspiration = mind.trajectory?.statement || (typeof profile.definitionOfBetter === "string" ? profile.definitionOfBetter : "") || "";
    const updated = row.updated_at ? new Date(row.updated_at).getTime() : 0;

    if (profile.onboardedAt) onboarded++;
    if (updated && now - updated < 7 * DAY) active7++;
    if (updated && now - updated < 30 * DAY) active30++;
    totalCheckIns += checkIns; totalChat += chat; totalSpaces += spaces;
    if (aspiration) withAspiration++;

    const areas = (Array.isArray(profile.focusAreas) ? profile.focusAreas : Array.isArray(profile.goals) ? profile.goals : []) as string[];
    for (const a of areas) if (typeof a === "string") areaCounts[a] = (areaCounts[a] ?? 0) + 1;

    const au = emailById.get(row.user_id);
    users.push({
      id: row.user_id,
      name: (typeof profile.displayName === "string" && profile.displayName) || "—",
      email: au?.email || "—",
      onboardedAt: profile.onboardedAt ?? null,
      checkIns, chat,
      aspiration,
      lastActive: row.updated_at ?? null,
      joined: au?.created_at ?? null,
    });
  }

  users.sort((a, b) => String(b.lastActive ?? "").localeCompare(String(a.lastActive ?? "")));

  return NextResponse.json({
    ok: true,
    configured: true,
    generatedAt: new Date().toISOString(),
    totals: {
      accounts: authUsers.length || rows.length,
      withData: rows.length,
      onboarded,
      active7,
      active30,
      totalCheckIns,
      avgCheckIns: rows.length ? Math.round((totalCheckIns / rows.length) * 10) / 10 : 0,
      totalChat,
      totalSpaces,
      withAspiration,
      authListable: authUsers.length > 0,
    },
    focusAreas: Object.entries(areaCounts).sort((a, b) => b[1] - a[1]),
    users: users.slice(0, 1000),
  });
}
