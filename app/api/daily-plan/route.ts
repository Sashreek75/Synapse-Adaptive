import { NextResponse } from "next/server";
import { callModel, extractJson } from "@/ai/client";
import { DAILY_PROMPT } from "@/ai/prompts";
import { postGate } from "@/ai/safety";
import { dailyPlanSchema, DAILY_SLIDER_METRICS, type DailyPlanOutput } from "@/ai/schemas";

export const runtime = "nodejs";

/**
 * Synapse composes today's DAILY check-in for this specific person. The model
 * authors the phrasing (greeting, slider questions, one sharp context
 * question); code validates the shape, clamps metrics to the allowed set,
 * dedupes, enforces the sleep_quality + fatigue requirement, and post-gates
 * every text field. On ANY failure we return { plan: null } and the client
 * falls back to its deterministic variant system — the check-in always works.
 */

interface DailyPlanRequest {
  path?: string;
  pathLabel?: string;
  focusNoun?: string;
  goals?: string[];
  trends?: { metric: string; label: string; improving: boolean; delta: number }[];
  notes?: { prompt: string; answer: string }[];
  dayOfWeek?: string;
}

const ALLOWED = new Set<string>(DAILY_SLIDER_METRICS);

/** Validate + clamp the model's plan. Null means "use the deterministic fallback". */
function clampDailyPlan(raw: unknown): DailyPlanOutput | null {
  const parsed = dailyPlanSchema.safeParse(raw);
  if (!parsed.success) return null;

  // Clamp to the allowed metric set and dedupe (first occurrence wins).
  const seen = new Set<string>();
  const sliders = parsed.data.sliders
    .filter((s) => {
      if (!ALLOWED.has(s.metric) || seen.has(s.metric)) return false;
      seen.add(s.metric);
      return true;
    })
    .slice(0, 5);

  if (sliders.length < 3 || !seen.has("sleep_quality") || !seen.has("fatigue")) return null;

  const chips = parsed.data.contextQuestion.chips.slice(0, 5);
  if (chips.length < 3) return null;

  // Safety post-gate on every text field the user will read.
  const texts = [
    parsed.data.greeting,
    parsed.data.contextQuestion.prompt,
    ...chips,
    ...sliders.flatMap((s) => [s.question, s.lowLabel, s.highLabel]),
  ];
  if (texts.some((t) => !postGate(t).ok)) return null;

  return {
    greeting: parsed.data.greeting.trim(),
    sliders,
    contextQuestion: { prompt: parsed.data.contextQuestion.prompt.trim(), chips },
  };
}

export async function POST(req: Request) {
  let body: DailyPlanRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ plan: null });
  }

  const trends = (body.trends ?? []).slice(0, 6);
  const notes = (body.notes ?? []).slice(-3);
  const user = [
    `Path focus: ${body.focusNoun || body.pathLabel || body.path || "general wellness"}`,
    `Day of week: ${body.dayOfWeek || new Date().toLocaleDateString("en-US", { weekday: "long" })}`,
    `Goals: ${(body.goals ?? []).slice(0, 5).join("; ") || "none stated yet"}`,
    "Recent trends:",
    ...(trends.length
      ? trends.map((t) => `- ${t.label} (${t.metric}): ${t.improving ? "improving" : "dipping"} (${t.delta > 0 ? "+" : ""}${Math.round(t.delta)})`)
      : ["- no clear movement yet (data still thin)"]),
    "What they told me recently:",
    ...(notes.length
      ? notes.map((n) => `- Q: "${n.prompt}" → "${n.answer}"`)
      : ["- nothing yet"]),
    "",
    "Compose today's daily check-in as JSON.",
  ].join("\n");

  try {
    const raw = await callModel({ system: DAILY_PROMPT.system, user, fast: true, maxTokens: 500 });
    const plan = raw ? clampDailyPlan(extractJson(raw)) : null;
    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ plan: null });
  }
}
