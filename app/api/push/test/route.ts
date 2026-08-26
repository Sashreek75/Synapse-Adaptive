import { NextResponse } from "next/server";
import { verifyUserId, sendToUser, pushConfigured } from "@/lib/push/server";

export const runtime = "nodejs";

/** POST — send the signed-in user a test reach-out so they can see it works. */
export async function POST(req: Request) {
  if (!pushConfigured()) return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const uid = await verifyUserId(body?.token);
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const delivered = await sendToUser(uid, {
    title: "Synapse",
    body: "This is what a reach-out looks like. I'll use these to keep you on track — not to nag.",
    url: "/dashboard",
    tag: "synapse-test",
  });
  return NextResponse.json({ ok: delivered > 0, delivered });
}
