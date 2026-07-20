import { NextResponse } from "next/server";
import { callModel, extractJson } from "@/ai/client";
import { DAILY_PROMPT } from "@/ai/prompts";
import { postGate } from "@/ai/safety";
import { dailyCheckinSchema, type DailyCheckinOutput } from "@/ai/schemas";

export const runtime = "nodejs";

/**
 * Synapse composes the WHOLE daily check-in for this person, fresh each day, from
 * their playbook, beliefs, open questions, trends, and recent notes. The model
 * authors every item (sliders, multiple-choice, open notes, an occasional
 * reaction game); code validates the shape, post-gates every text field, and
 * guarantees enough data is captured (>=2 scale items). On ANY failure we return
 * { plan: null } and the client falls back to its deterministic check-in.
 */

interface DailyPlanRequest {
  path?: string;
  pathLabel?: string;
  focusNoun?: string;
  goals?: string[];
  trends?: { metric: string; label: string; improving: boolean; delta: number }[];
  notes?: { prompt: string; answer: string }[];
  playbook?: string[];
  beliefs?: string[];
  openQuestions?: string[];
  checkInCount?: number;
  dayOfWeek?: string;
}

const CORE = new Set(["sleep_quality", "fatigue", "stress", "mood", "symptoms"]);

/** Validate + guard the model's plan. Null means "use the deterministic fallback". */
function clampCheckin(raw: unknown): DailyCheckinOutput | null {
  const parsed = dailyCheckinSchema.safeParse(raw);
  if (!parsed.success) return null;
  const plan = parsed.data;

  // Need at least two scale items on core self-report metrics for data continuity.
  const coreScales = plan.items.filter((i) => i.type === "scale" && CORE.has(i.metric));
  if (coreScales.length < 2) return null;

  // Post-gate every string the user will read.
  const texts: string[] = [plan.greeting, plan.closing ?? ""];
  for (const it of plan.items) {
    texts.push(it.question);
    if (it.type === "scale") texts.push(it.lowLabel, it.highLabel);
    if (it.type === "choice") texts.push(...it.options.map((o) => o.label));
    if (it.type === "note" && it.chips) texts.push(...it.chips);
  }
  if (texts.some((t) => t && !postGate(t).ok)) return null;

  return plan;
}

export async function POST(req: Request) {
  let body: DailyPlanRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ plan: null });
  }

  const trends = (body.trends ?? []).slice(0, 6);
  const notes = (body.notes ?? []).slice(-4);
  const playbook = (body.playbook ?? []).slice(-8);
  const beliefs = (body.beliefs ?? []).slice(-6);
  const openQs = (body.openQuestions ?? []).slice(0, 5);

  const user = [
    `Path focus: ${body.focusNoun || body.pathLabel || body.path || "personal growth"}`,
    `Day of week: ${body.dayOfWeek || new Date().toLocaleDateString("en-US", { weekday: "long" })}`,
    `Check-ins so far: ${body.checkInCount ?? 0}`,
    `Goals: ${(body.goals ?? []).slice(0, 5).join("; ") || "none stated yet"}`,
    "",
    "Recent trends:",
    ...(trends.length
      ? trends.map((t) => `- ${t.label} (${t.metric}): ${t.improving ? "improving" : "dipping"} (${t.delta > 0 ? "+" : ""}${Math.round(t.delta)})`)
      : ["- no clear movement yet (data still thin)"]),
    "",
    "Your Playbook (durable things you've learned about how they work):",
    ...(playbook.length ? playbook.map((p) => `- ${p}`) : ["- nothing durable yet"]),
    "",
    "Your current beliefs about them:",
    ...(beliefs.length ? beliefs.map((b) => `- ${b}`) : ["- still forming"]),
    "",
    "Open questions you're trying to answer about them (design an item to help close one):",
    ...(openQs.length ? openQs.map((q) => `- ${q}`) : ["- none yet — feel free to open one"]),
    "",
    "What they told you recently:",
    ...(notes.length ? notes.map((n) => `- Q: "${n.prompt}" → "${n.answer}"`) : ["- nothing yet"]),
    "",
    "Compose today's check-in as JSON. Make it clearly different from a generic template, and from what you'd have asked on a different day.",
  ].join("\n");

  try {
    const raw = await callModel({ system: DAILY_PROMPT.system, user, maxTokens: 800, temperature: 0.85 });
    const plan = raw ? clampCheckin(extractJson(raw)) : null;
    return NextResponse.json({ plan });
  } catch {
    return NextResponse.json({ plan: null });
  }
}
