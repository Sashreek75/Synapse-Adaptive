import { NextResponse } from "next/server";
import { verifyUserId, saveSubscription, deleteSubscription, pushConfigured } from "@/lib/push/server";

export const runtime = "nodejs";

/** POST — register this device's push subscription for the signed-in user. */
export async function POST(req: Request) {
  if (!pushConfigured()) return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as
    | { token?: string; subscription?: { endpoint?: string; p256dh?: string; auth?: string }; ua?: string }
    | null;

  const uid = await verifyUserId(body?.token);
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const sub = body?.subscription;
  if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) {
    return NextResponse.json({ ok: false, error: "bad_subscription" }, { status: 400 });
  }

  const ok = await saveSubscription(uid, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, body?.ua);
  return NextResponse.json({ ok });
}

/** DELETE — forget this device (fired when the user turns reach-outs off). */
export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string; endpoint?: string } | null;
  if (body?.endpoint) await deleteSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
