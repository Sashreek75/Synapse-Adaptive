import { NextResponse } from "next/server";
import { pingModel } from "@/ai/client";

export const runtime = "nodejs";

/** Visit /api/ai-status in your browser to confirm Synapse can reach Gemini. */
export async function GET() {
  const result = await pingModel();
  return NextResponse.json(result);
}
