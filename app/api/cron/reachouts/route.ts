import { NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "@/env";
import { duePending, markReachout, sendToUser, pushConfigured } from "@/lib/push/server";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The heartbeat. A scheduler (Vercel Cron, or any external pinger every minute) hits this; it finds
 * reach-outs whose time has come and pushes them to the user's devices — this is what makes "I'll
 * check in in an hour" actually happen when Synapse's tab is closed.
 *
 * Secure it with CRON_SECRET: Vercel Cron sends it as `Authorization: Bearer <secret>`; an external
 * pinger can pass `?secret=<secret>`.
 */
function authorized(req: Request): boolean {
  // Fail CLOSED: with no secret configured, only allow in development. In production an unset secret
  // must NOT leave the send loop open to the public.
  if (!env.CRON_SECRET) return process.env.NODE_ENV !== "production";
  const url = new URL(req.url);
  const q = url.searchParams.get("secret");
  if (q && safeEqual(q, env.CRON_SECRET)) return true;
  const auth = req.headers.get("authorization") || "";
  return safeEqual(auth, `Bearer ${env.CRON_SECRET}`);
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 503 });

  const due = await duePending(new Date().toISOString(), 200);
  let delivered = 0, queued = 0;
  for (const r of due) {
    const n = await sendToUser(r.user_id, {
      title: r.title,
      body: r.body,
      url: r.url || "/dashboard",
      tag: `synapse-ro-${r.id}`,
    });
    // Always resolve it so the cron doesn't re-fire it every minute. It is NOT lost if the device was
    // offline: Web Push holds it (24h TTL) and delivers when the browser reconnects, AND the in-app
    // catch-up shows any missed reach-out the moment they next open Synapse. A closed laptop delays a
    // reach-out; it never cancels it.
    await markReachout(r.id, "sent");
    if (n > 0) delivered++; else queued++;
  }
  return NextResponse.json({ ok: true, processed: due.length, delivered, queued });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
