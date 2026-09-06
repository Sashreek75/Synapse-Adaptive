import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/rate-limit";
import { callModel, extractJson } from "@/ai/client";
import { WORKSPACE_PROMPT } from "@/ai/prompts";
import { postGate } from "@/ai/safety";
import { workspaceSchema, type WorkspaceSpecOutput } from "@/ai/schemas";

export const runtime = "nodejs";

/**
 * Synapse composes a persistent WORKSPACE from the user's request ("build me an SAT mistake
 * tracker", "a mock interview", "a planning board"). The model authors the spec from a bounded
 * block vocabulary; code validates the shape and post-gates every string. On ANY failure we
 * return { workspace: null } and the client composes a deterministic fallback — never a refusal.
 */
interface WorkspaceRequest { request?: string; goal?: string; goals?: string[]; context?: string }

function clampWorkspace(raw: unknown): WorkspaceSpecOutput | null {
  const parsed = workspaceSchema.safeParse(raw);
  if (!parsed.success) return null;
  const ws = parsed.data;
  const texts: string[] = [ws.title, ws.purpose ?? ""];
  for (const b of ws.blocks) {
    texts.push(b.title);
    if (b.kind === "checklist") texts.push(...b.items);
    else if (b.kind === "tracker") texts.push(...b.columns, b.addLabel ?? "");
    else if (b.kind === "notes") texts.push(b.placeholder ?? "");
    else if (b.kind === "prompts") texts.push(...b.questions);
  }
  if (texts.some((t) => t && !postGate(t).ok)) return null;
  return ws;
}

export async function POST(req: Request) {
  if (rateLimited(req, "workspace", 15, 60_000)) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  let body: WorkspaceRequest;
  try { body = await req.json(); } catch { return NextResponse.json({ workspace: null }); }
  const request = (body.request || "").slice(0, 400);
  if (!request) return NextResponse.json({ workspace: null });

  const user = [
    `They asked: "${request}"`,
    body.goal ? `Their goal / who they're becoming: ${body.goal}` : "",
    body.goals && body.goals.length ? `Focus areas: ${body.goals.slice(0, 5).join("; ")}` : "",
    body.context ? `What you know about them: ${body.context}` : "",
    "",
    "Compose the workspace as JSON now.",
  ].filter(Boolean).join("\n");

  try {
    const raw = await callModel({ system: WORKSPACE_PROMPT.system, user, maxTokens: 1200, temperature: 0.7 });
    const workspace = raw ? clampWorkspace(extractJson(raw)) : null;
    return NextResponse.json({ workspace });
  } catch {
    return NextResponse.json({ workspace: null });
  }
}
