import { NextResponse } from "next/server";
import { callModel, extractJson } from "@/ai/client";
import { ASSESSMENT_PROMPT } from "@/ai/prompts";
import { clampPlan, planAssessmentLocal, catalogForPrompt, type PlannerContext } from "@/lib/assessments/planner";
import { metricLabel } from "@/lib/metrics";

export const runtime = "nodejs";

/**
 * Synapse composes today's assessment. The model authors the plan in language;
 * code validates/clamps it (clampPlan) so it's always safe to run, and falls
 * back to the deterministic adaptive planner when the model is unavailable or
 * returns something unusable. No fixed scenarios — the Agent decides each time.
 * Negotiation preferences (preferMetric / excludeKinds / variantSeed) flow to
 * BOTH the model prompt and the local fallback, so a protest always lands.
 */
export async function POST(req: Request) {
  let ctx: PlannerContext;
  try { ctx = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!ctx || !Array.isArray(ctx.snapshots)) return NextResponse.json({ error: "Invalid context" }, { status: 400 });

  const fallback = planAssessmentLocal(ctx);

  const situation = [
    `Weeks tracked: ${ctx.weeksTracked}`,
    `Goal metrics: ${ctx.goalMetrics.join(", ") || "none yet"}`,
    "Per-metric status:",
    ...ctx.snapshots.map((s) =>
      `- ${metricLabel(s.metric)} (${s.metric}): ${s.n} data points, recent change ${Math.round(s.delta)}, ${s.watched ? "WATCHED" : "steady"}${s.lastScore != null ? `, last score ${Math.round(s.lastScore)}/100` : ""}`),
  ].join("\n");

  // Negotiation: the user protested or steered the set — tell the model.
  const prefs: string[] = [];
  if (Array.isArray(ctx.excludeKinds) && ctx.excludeKinds.length) {
    prefs.push(`User asked for a different set; avoid these kinds if at all possible: ${ctx.excludeKinds.join(", ")}.`);
  }
  if (ctx.preferMetric) {
    prefs.push(`They'd prefer to test ${metricLabel(ctx.preferMetric)} (${ctx.preferMetric}) today — lean the set toward it.`);
  }
  if (ctx.variantSeed) {
    prefs.push(`This is re-composition #${ctx.variantSeed} of today's session — make it feel genuinely different from a typical set.`);
  }

  const user = `CATALOG (use ONLY these kinds):\n${catalogForPrompt()}\n\nPERSON'S SITUATION:\n${situation}${prefs.length ? `\n\nUSER PREFERENCES (honor these):\n${prefs.join("\n")}` : ""}\n\nCompose today's check-in as JSON.`;

  try {
    const raw = await callModel({ system: ASSESSMENT_PROMPT.system, user, maxTokens: 700 });
    const plan = raw ? clampPlan(extractJson(raw)) : null;
    return NextResponse.json({ plan: plan ?? fallback });
  } catch {
    return NextResponse.json({ plan: fallback });
  }
}
