import { NextResponse } from "next/server";
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
  let body: ReasoningInput & { tier?: PlanId };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body?.series?.length) return NextResponse.json({ reasoning: null });

  const result = await generateReasoning({
    profile: body.profile ?? {},
    series: body.series,
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
