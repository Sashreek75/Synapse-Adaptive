import { NextResponse } from "next/server";
import { verifyUserId, recentDueForUser, pushConfigured } from "@/lib/push/server";

export const runtime = "nodejs";

/**
 * POST — reach-outs for the signed-in user whose time has already passed in the last 24h. The client
 * uses this on load to "catch up": show a reminder that came due while the computer was off.
 */
export async function POST(req: Request) {
  if (!pushConfigured()) return NextResponse.json({ reachouts: [] });
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const uid = await verifyUserId(body?.token);
  if (!uid) return NextResponse.json({ reachouts: [] });

  const now = new Date();
  const since = new Date(now.getTime() - 48 * 3600_000); // still deliver a reach-out missed while the laptop was closed for a day+
  const rows = await recentDueForUser(uid, since.toISOString(), now.toISOString());
  return NextResponse.json({
    reachouts: rows.map((r) => ({ id: r.id, title: r.title, body: r.body, url: r.url, fireAt: r.fire_at })),
  });
}
