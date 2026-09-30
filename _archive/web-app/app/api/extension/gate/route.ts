import { NextResponse } from "next/server";
import { judgeGate, type GateInput } from "@/ai/gatekeeper";
import { preGate, CRISIS_RESPONSE } from "@/ai/safety";
import { rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Browser orb → gatekeeper. Called from the extension's background worker (not the page), so no
 * CORS is involved. Returns 503 when the model can't answer; the extension then applies its own
 * strict offline rules instead of opening the gate.
 */
export async function POST(req: Request) {
  if (rateLimited(req, "ext-gate", 30, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  let body: GateInput;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid" }, { status: 400 }); }
  if (!body?.argument?.trim() || !body.site) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // If what they wrote reads as a crisis, the gate stops mattering — respond with care, don't judge.
  if (preGate(body.argument).triggered) {
    return NextResponse.json({ decision: "crisis", minutes: null, reply: CRISIS_RESPONSE });
  }

  const verdict = await judgeGate(body);
  if (!verdict) return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  return NextResponse.json({ ...verdict, source: "model" });
}
