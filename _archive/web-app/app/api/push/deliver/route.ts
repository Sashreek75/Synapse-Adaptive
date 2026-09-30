import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { env } from "@/env";
import { getReachoutById, markReachout, sendToUser, pushConfigured } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * QStash delivery callback. QStash calls this at the reach-out's exact fire time (even with the user's
 * browser fully closed). We VERIFY the request is genuinely from QStash (signed with our signing keys),
 * then look the reach-out up by id, send the web push, and mark it sent. Idempotent: if it's already
 * been handled (e.g. by the cron backstop or a retry), we no-op.
 */
export async function POST(req: Request) {
  const cur = env.QSTASH_CURRENT_SIGNING_KEY;
  const nxt = env.QSTASH_NEXT_SIGNING_KEY;
  if (!cur || !nxt || !pushConfigured()) {
    return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 503 });
  }

  const signature = req.headers.get("upstash-signature") || "";
  const body = await req.text(); // raw body is required for signature verification

  const receiver = new Receiver({ currentSigningKey: cur, nextSigningKey: nxt });
  let valid = false;
  try { valid = await receiver.verify({ signature, body }); } catch { valid = false; }
  if (!valid) return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });

  let id = "";
  try { id = String((JSON.parse(body) as { id?: string }).id || ""); } catch {}
  if (!id) return NextResponse.json({ ok: true, skipped: "no id" });

  const r = await getReachoutById(id);
  if (!r) return NextResponse.json({ ok: true, skipped: "gone" });
  if (r.status !== "pending") return NextResponse.json({ ok: true, skipped: "already handled" });

  const delivered = await sendToUser(r.user_id, {
    title: r.title,
    body: r.body,
    url: r.url || "/dashboard",
    tag: `synapse-ro-${r.id}`,
  });
  // Mark sent regardless of device reachability — Web Push holds it (24h TTL) and the in-app catch-up
  // covers a closed laptop. A missed device delays a reach-out; it never re-fires or gets lost.
  await markReachout(r.id, "sent");
  return NextResponse.json({ ok: true, delivered });
}
