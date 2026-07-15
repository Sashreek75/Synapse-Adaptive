import { NextResponse } from "next/server";
import { generateProfileSummary } from "@/ai/pipeline";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let profile: Record<string, unknown> = {};
  try { ({ profile } = await req.json()); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const summary = await generateProfileSummary(profile as never);
  return NextResponse.json({ summary });
}
