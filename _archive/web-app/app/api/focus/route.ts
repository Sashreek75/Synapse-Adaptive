import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/rate-limit";
import { generateReasoning, type ReasoningInput } from "@/ai/reasoning";
import type { PlanId } from "@/lib/billing/plans";

export const runtime = "nodejs";

/**
 * Synapse's weekly reasoning pass — produces an OPINION (one focus) with its
 * working shown (the Reasoning Summary + hypotheses), plus belief/conclusion
 * updates. Falls back to the deterministic focus engine if the model is
 * unavailable, so the loop is never empty.
 */
export async function POST(req: Request) {
  if (rateLimited(req, "focus", 30, 60_000)) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  let body: ReasoningInput & { tier?: PlanId };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !Array.isArray(body.series) || !body.series.length) {
    return NextResponse.json({ reasoning: null });
  }
  const series = body.series.length > 500 ? body.series.slice(-500) : body.series;

  const result = await generateReasoning({
    profile: body.profile ?? {},
    series,
    recentChanges: body.recentChanges ?? [],
    experiments: body.experiments ?? [],
    beliefs: body.beliefs ?? [],
    conclusions: body.conclusions ?? [],
    openQuestions: body.openQuestions ?? [],
    notes: body.notes ?? [],
    tier: body.tier ?? "pro",
  });
  return NextResponse.json(result);
}
