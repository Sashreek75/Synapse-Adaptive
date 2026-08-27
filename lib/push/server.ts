import "server-only";
import webpush from "web-push";
import { env } from "@/env";

/**
 * PUSH — server side. Everything here runs only in Node route handlers (never the client).
 * It talks to Supabase with the service-role key (RLS is bypassed intentionally, so the
 * cron can read every user's subscriptions), verifies a caller's identity from their auth
 * token, and sends Web Push notifications signed with our VAPID keys.
 */

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function pushConfigured(): boolean {
  return !!URL && !!SERVICE && !!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY;
}

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidReady = true;
  return true;
}

async function sb(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE!,
      Authorization: `Bearer ${SERVICE}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

/** Verify a Supabase access token and return the user id, or null if invalid. */
export async function verifyUserId(accessToken: string | null | undefined): Promise<string | null> {
  if (!URL || !ANON || !accessToken) return null;
  try {
    const res = await fetch(`${URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { id?: string };
    return typeof j.id === "string" ? j.id : null;
  } catch {
    return null;
  }
}

export interface PushSub { endpoint: string; p256dh: string; auth: string }

/** Insert or update a subscription (keyed by endpoint, so re-subscribing is idempotent). */
export async function saveSubscription(userId: string, sub: PushSub, ua?: string): Promise<boolean> {
  if (!pushConfigured()) return false;
  const res = await sb("push_subscriptions?on_conflict=endpoint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, ua: ua || null }),
  });
  return res.ok;
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  if (!URL || !SERVICE) return;
  try { await sb(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE" }); } catch {}
}

export async function getUserSubscriptions(userId: string): Promise<PushSub[]> {
  if (!URL || !SERVICE) return [];
  try {
    const res = await sb(`push_subscriptions?user_id=eq.${userId}&select=endpoint,p256dh,auth`);
    if (!res.ok) return [];
    return (await res.json()) as PushSub[];
  } catch {
    return [];
  }
}

export interface ReachoutInput {
  userId: string;
  fireAt: string;        // ISO
  title: string;
  body: string;
  url?: string;
  kind?: string;
  dedupeKey?: string;
}

export async function insertReachout(r: ReachoutInput): Promise<boolean> {
  if (!URL || !SERVICE) return false;
  const res = await sb("scheduled_reachouts?on_conflict=user_id,dedupe_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: r.userId, fire_at: r.fireAt, title: r.title, body: r.body,
      url: r.url || null, kind: r.kind || "reachout", dedupe_key: r.dedupeKey || null,
    }),
  });
  return res.ok;
}

export interface DueReachout { id: string; user_id: string; title: string; body: string; url: string | null }

/** Pending reach-outs whose time has come. */
export async function duePending(nowIso: string, limit = 100): Promise<DueReachout[]> {
  if (!URL || !SERVICE) return [];
  try {
    const res = await sb(
      `scheduled_reachouts?status=eq.pending&fire_at=lte.${encodeURIComponent(nowIso)}&select=id,user_id,title,body,url&order=fire_at.asc&limit=${limit}`,
    );
    if (!res.ok) return [];
    return (await res.json()) as DueReachout[];
  } catch {
    return [];
  }
}

export interface RecentReachout { id: string; title: string; body: string; url: string | null; fire_at: string }

/** Reach-outs for a user whose time has already passed within a recent window — used for the
 * client "catch-up" so a reminder that came due while the computer was off still shows on reopen. */
export async function recentDueForUser(userId: string, sinceIso: string, nowIso: string): Promise<RecentReachout[]> {
  if (!URL || !SERVICE) return [];
  try {
    const res = await sb(
      `scheduled_reachouts?user_id=eq.${userId}&fire_at=lte.${encodeURIComponent(nowIso)}&fire_at=gte.${encodeURIComponent(sinceIso)}&select=id,title,body,url,fire_at&order=fire_at.desc&limit=20`,
    );
    if (!res.ok) return [];
    return (await res.json()) as RecentReachout[];
  } catch {
    return [];
  }
}

export async function markReachout(id: string, status: "sent" | "failed" | "canceled"): Promise<void> {
  if (!URL || !SERVICE) return;
  const patch: Record<string, unknown> = { status };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  try {
    await sb(`scheduled_reachouts?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  } catch {}
}

export interface PushPayload { title: string; body: string; url?: string; tag?: string }

/** Send one notification. Returns { gone: true } when the subscription is dead (404/410) so the caller can prune it. */
export async function sendToSubscription(sub: PushSub, payload: PushPayload): Promise<{ ok: boolean; gone: boolean }> {
  if (!ensureVapid()) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 24 * 3600 }, // push service holds it up to 24h and delivers when the device reconnects
    );
    return { ok: true, gone: false };
  } catch (err) {
    const code = (err as { statusCode?: number }).statusCode;
    return { ok: false, gone: code === 404 || code === 410 };
  }
}

/** Send a payload to every device a user has, pruning dead subscriptions. Returns count delivered. */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  const subs = await getUserSubscriptions(userId);
  let delivered = 0;
  for (const s of subs) {
    const r = await sendToSubscription(s, payload);
    if (r.ok) delivered++;
    else if (r.gone) await deleteSubscription(s.endpoint);
  }
  return delivered;
}
