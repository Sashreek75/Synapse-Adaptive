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
  goals?: { id: string; title: string; priority?: string; kind?: string; momentum?: string; daysSince?: number | null; dueInDays?: number | null }[];
  context?: string;
}

type Conf = "low" | "moderate" | "high";
const CONF = new Set(["low", "moderate", "high"]);
type Alloc = { protect: string[]; maintain: string[]; park: string[]; watch: string[] };

/** Keep only ids that are real, unique across roles (protect wins ties), and known. */
function cleanAllocation(raw: unknown, valid: Set<string>): Alloc | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const pick = (key: string): string[] => {
    const arr = Array.isArray(r[key]) ? (r[key] as unknown[]) : [];
    const out: string[] = [];
    for (const x of arr) {
      if (typeof x === "string" && valid.has(x) && !seen.has(x)) { seen.add(x); out.push(x); }
    }
    return out;
  };
  const protect = pick("protect");   // order matters: protect claims an id first
  const maintain = pick("maintain");
  const park = pick("park");
  const watch = pick("watch");
  if (!protect.length && !maintain.length && !park.length && !watch.length) return undefined;
  return { protect, maintain, park, watch };
}

export async function POST(req: Request) {
  let body: FocusReq;
  try { body = await req.json(); } catch { return NextResponse.json({ focus: null }); }
  const goals = Array.isArray(body.goals) ? body.goals.slice(0, 12) : [];
  if (goals.length < 2) return NextResponse.json({ focus: null }); // nothing to allocate
  const validIds = new Set(goals.map((g) => g.id));

  const user = [
    "GOALS:",
    ...goals.map((g) => `- [id:${g.id}] ${g.title} (priority ${g.priority || "?"}${g.kind && g.kind !== "milestone" ? `, ${g.kind} goal` : ""}, momentum ${g.momentum || "?"}${g.daysSince != null ? `, last moved ${g.daysSince}d ago` : ""}${g.dueInDays != null ? `, DUE IN ${g.dueInDays}d` : ""})`),
    body.context ? `About them: ${body.context}` : "",
    "",
    "Allocate this week across these goals, as JSON now.",
  ].filter(Boolean).join("\n");

  try {
    const raw = await callModel({ system: GOAL_FOCUS_PROMPT.system, user, maxTokens: 500, temperature: 0.6 });
    const j = raw ? (extractJson(raw) as { focus?: unknown; allocation?: unknown; note?: unknown; confidence?: unknown; reversal?: unknown } | null) : null;
    if (!j || !Array.isArray(j.focus)) return NextResponse.json({ focus: null });
    const ids = (j.focus as unknown[]).filter((x): x is string => typeof x === "string" && validIds.has(x)).slice(0, 3);
    if (!ids.length) return NextResponse.json({ focus: null });

    const allocation = cleanAllocation(j.allocation, validIds);
    const confidence: Conf | undefined = typeof j.confidence === "string" && CONF.has(j.confidence) ? (j.confidence as Conf) : undefined;
    // Post-gate the two free-text fields; drop only the offending field, keep the decision.
    const note = typeof j.note === "string" && postGate(j.note).ok ? j.note : "";
    const reversal = typeof j.reversal === "string" && j.reversal.trim() && postGate(j.reversal).ok ? j.reversal.trim() : "";

    return NextResponse.json({ focus: ids, allocation, note, confidence, reversal });
  } catch {
    return NextResponse.json({ focus: null });
  }
}
