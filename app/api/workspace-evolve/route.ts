import { NextResponse } from "next/server";
import { callModel, extractJson } from "@/ai/client";
import { WORKSPACE_EVOLVE_PROMPT } from "@/ai/prompts";
import { postGate } from "@/ai/safety";
import { workspaceEvolveSchema, type WorkspaceEvolveOutput } from "@/ai/schemas";

export const runtime = "nodejs";

/**
 * A living workspace evolves: refresh its summary and, only if warranted, propose ONE earned change
 * (a new block or a note) for the user to approve. Never applies changes itself. Falls back to null.
 */
interface EvolveRequest { title?: string; purpose?: string; goal?: string; summary?: string; blocks?: { kind: string; title: string }[]; journal?: string[] }

function clamp(raw: unknown): WorkspaceEvolveOutput | null {
  const parsed = workspaceEvolveSchema.safeParse(raw);
  if (!parsed.success) return null;
  const e = parsed.data;
  const texts: string[] = [e.summary ?? ""];
  const s = e.suggestion;
  if (s) {
    texts.push(s.label, s.rationale ?? "");
    if (s.action.type === "note") texts.push(s.action.text);
    else {
      const b = s.action.block;
      texts.push(b.title);
      if (b.kind === "checklist") texts.push(...b.items);
      else if (b.kind === "tracker") texts.push(...b.columns, b.addLabel ?? "");
      else if (b.kind === "notes") texts.push(b.placeholder ?? "");
      else if (b.kind === "prompts") texts.push(...b.questions);
    }
  }
  if (texts.some((t) => t && !postGate(t).ok)) return null;
  return e;
}

export async function POST(req: Request) {
  let body: EvolveRequest;
  try { body = await req.json(); } catch { return NextResponse.json({ evolve: null }); }
  const title = (body.title || "").slice(0, 200);
  if (!title) return NextResponse.json({ evolve: null });

  const user = [
    `Workspace: "${title}"`,
    body.purpose ? `Purpose: ${body.purpose}` : "",
    body.goal ? `Serves the goal: ${body.goal}` : "",
    body.summary ? `Your last summary: ${body.summary}` : "",
    body.blocks && body.blocks.length ? `Current sections: ${body.blocks.map((b) => `${b.title} [${b.kind}]`).join("; ")}` : "",
    body.journal && body.journal.length ? `Recent history:\n${body.journal.map((j) => `- ${j}`).join("\n")}` : "",
    "",
    "Update the summary and, only if warranted, propose one earned improvement. JSON now.",
  ].filter(Boolean).join("\n");

  try {
    const raw = await callModel({ system: WORKSPACE_EVOLVE_PROMPT.system, user, maxTokens: 900, temperature: 0.6 });
    const evolve = raw ? clamp(extractJson(raw)) : null;
    return NextResponse.json({ evolve });
  } catch {
    return NextResponse.json({ evolve: null });
  }
}
