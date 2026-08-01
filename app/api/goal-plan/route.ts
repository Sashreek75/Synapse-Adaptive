import { NextResponse } from "next/server";
import { callModel, extractJson } from "@/ai/client";
import { GOAL_PLAN_PROMPT } from "@/ai/prompts";
import { postGate } from "@/ai/safety";
import { goalPlanSchema, type GoalPlanOutput } from "@/ai/schemas";

export const runtime = "nodejs";

/**
 * Decompose one goal into a campaign: the fronts to win, the current bottleneck, the next move.
 * Model authors it; code validates + post-gates; on ANY failure the client composes a
 * deterministic fallback (lib/goals campaignFallback) so a goal always becomes executable.
 */
interface GoalPlanRequest { title?: string; why?: string; timeline?: string; context?: string; fronts?: { title: string; status?: string }[]; outcomes?: { move: string; result: string; worked?: string }[] }

function clampPlan(raw: unknown): GoalPlanOutput | null {
  const parsed = goalPlanSchema.safeParse(raw);
  if (!parsed.success) return null;
  const plan = parsed.data;
  const texts: string[] = [plan.bottleneck ?? "", plan.nextMove?.title ?? "", plan.nextMove?.why ?? "", plan.mission ?? "", plan.greatestRisk ?? "", plan.belief ?? "", plan.counterBelief ?? "", plan.openQuestion ?? "", ...(plan.evidence ?? [])];
  for (const f of plan.fronts) texts.push(f.title, f.bottleneck ?? "", f.nextMove ?? "");
  if (texts.some((t) => t && !postGate(t).ok)) return null;
  return plan;
}

export async function POST(req: Request) {
  let body: GoalPlanRequest;
  try { body = await req.json(); } catch { return NextResponse.json({ plan: null }); }
  const title = (body.title || "").slice(0, 200);
  if (!title) return NextResponse.json({ plan: null });

  const user = [
    `Goal: ${title}`,
    body.why ? `Why it matters: ${body.why}` : "",
    body.timeline ? `Timeline: ${body.timeline}` : "",
    body.context ? `About them: ${body.context}` : "",
    body.fronts && body.fronts.length ? `PRIOR FRONTS: ${body.fronts.map((f) => `${f.title} [${f.status || "open"}]`).join("; ")}` : "",
    body.outcomes && body.outcomes.length ? `OUTCOMES so far (reassess the bottleneck from these):\n${body.outcomes.map((o) => `- did "${o.move}" -> ${o.worked || "logged"}: ${o.result}`).join("\n")}` : "",
    "",
    body.outcomes && body.outcomes.length ? "REASSESS the campaign from what actually happened, as JSON now." : "Decompose it into a campaign as JSON now.",
  ].filter(Boolean).join("\n");

  try {
    const raw = await callModel({ system: GOAL_PLAN_PROMPT.system, user, maxTokens: 1000, temperature: 0.7 });
    const plan = raw ? clampPlan(extractJson(raw)) : null;
    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ plan: null });
  }
}
