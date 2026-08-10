import { NextResponse } from "next/server";
import { callModel, extractJson } from "@/ai/client";
import { GOAL_FOCUS_PROMPT } from "@/ai/prompts";
import { postGate } from "@/ai/safety";

export const runtime = "nodejs";

/**
 * Pick this week's "needle" — the 1–3 goals that deserve the user's energy — with a short reasoned
 * note in Synapse's voice. Model authors it; on any failure the client falls back to a deterministic
 * pick so the page still works. No new storage; the client caches the result per week.
 */
interface FocusReq {
  goals?: { id: string; title: string; priority?: string; momentum?: string; daysSince?: number | null }[];
  context?: string;
}

export async function POST(req: Request) {
  let body: FocusReq;
  try { body = await req.json(); } catch { return NextResponse.json({ focus: null }); }
  const goals = Array.isArray(body.goals) ? body.goals.slice(0, 12) : [];
  if (goals.length < 2) return NextResponse.json({ focus: null }); // nothing to prioritise

  const user = [
    "GOALS:",
    ...goals.map((g) => `- [id:${g.id}] ${g.title} (priority ${g.priority || "?"}, momentum ${g.momentum || "?"}${g.daysSince != null ? `, last moved ${g.daysSince}d ago` : ""})`),
    body.context ? `About them: ${body.context}` : "",
    "",
    "Choose the 1-3 that deserve this week, as JSON now.",
  ].filter(Boolean).join("\n");

  try {
    const raw = await callModel({ system: GOAL_FOCUS_PROMPT.system, user, maxTokens: 400, temperature: 0.6 });
    const j = raw ? (extractJson(raw) as { focus?: unknown; note?: unknown } | null) : null;
    if (!j || !Array.isArray(j.focus)) return NextResponse.json({ focus: null });
    const ids = (j.focus as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 3);
    const note = typeof j.note === "string" ? j.note : "";
    if (!ids.length) return NextResponse.json({ focus: null });
    if (note && !postGate(note).ok) return NextResponse.json({ focus: ids, note: "" });
    return NextResponse.json({ focus: ids, note });
  } catch {
    return NextResponse.json({ focus: null });
  }
}
