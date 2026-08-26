import { NextResponse } from "next/server";
import { env } from "@/env";
import { duePending, markReachout, sendToUser, pushConfigured } from "@/lib/push/server";

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
  if (!env.CRON_SECRET) return true; // no secret configured → allow (dev)
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === env.CRON_SECRET) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${env.CRON_SECRET}`;
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 503 });

  const due = await duePending(new Date().toISOString(), 200);
  let sent = 0, failed = 0;
  for (const r of due) {
    const delivered = await sendToUser(r.user_id, {
      title: r.title,
      body: r.body,
      url: r.url || "/dashboard",
      tag: `synapse-ro-${r.id}`,
    });
    if (delivered > 0) { await markReachout(r.id, "sent"); sent++; }
    else { await markReachout(r.id, "failed"); failed++; } // no live device — don't retry forever
  }
  return NextResponse.json({ ok: true, processed: due.length, sent, failed });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
