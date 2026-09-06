import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/rate-limit";
import { generateProfileSummary } from "@/ai/pipeline";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (rateLimited(req, "profile-summary", 20, 60_000)) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  let profile: Record<string, unknown> = {};
  try { ({ profile } = await req.json()); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const summary = await generateProfileSummary(profile as never);
  return NextResponse.json({ summary });
}
