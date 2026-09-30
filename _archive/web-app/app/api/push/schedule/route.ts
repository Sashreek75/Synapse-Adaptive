import { NextResponse } from "next/server";
import { verifyUserId, insertReachout, scheduleReachoutDelivery, pushConfigured } from "@/lib/push/server";

export const runtime = "nodejs";

/**
 * POST — schedule a future reach-out for the signed-in user. Called when Synapse promises to check
 * in "in an hour" / "tonight". Either `minutes` (from now) or an absolute ISO `fireAt` is accepted.
 */
export async function POST(req: Request) {
  if (!pushConfigured()) return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as
    | { token?: string; minutes?: number; fireAt?: string; title?: string; body?: string; url?: string; dedupeKey?: string }
    | null;

  const uid = await verifyUserId(body?.token);
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // Resolve the fire time: clamp minutes to 1 minute .. 14 days so a bad value can't schedule junk.
  let fireAtMs: number | null = null;
  if (typeof body?.minutes === "number" && Number.isFinite(body.minutes)) {
    const m = Math.min(Math.max(Math.round(body.minutes), 1), 14 * 24 * 60);
    fireAtMs = Date.now() + m * 60_000;
  } else if (typeof body?.fireAt === "string") {
    const t = new Date(body.fireAt).getTime();
    if (!Number.isNaN(t)) fireAtMs = Math.max(t, Date.now() + 60_000);
  }
  if (fireAtMs == null) return NextResponse.json({ ok: false, error: "no_time" }, { status: 400 });

  const title = (body?.title || "Synapse").toString().slice(0, 120);
  const text = (body?.body || "Checking in — how did it go?").toString().slice(0, 400);

  const id = await insertReachout({
    userId: uid,
    fireAt: new Date(fireAtMs).toISOString(),
    title,
    body: text,
    url: body?.url || "/dashboard",
    dedupeKey: body?.dedupeKey,
  });
  // Hand it to QStash for exact-time background delivery (fires with the browser closed). The DB row
  // stays as a backstop for the in-app catch-up. If QStash isn't configured this is a no-op.
  let scheduled = false;
  if (id) scheduled = await scheduleReachoutDelivery(id, fireAtMs);
  return NextResponse.json({ ok: !!id, scheduled, fireAt: new Date(fireAtMs).toISOString() });
}
