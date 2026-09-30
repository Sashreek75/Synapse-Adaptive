import { NextResponse } from "next/server";
import { z } from "zod";
import { callModel } from "@/ai/client";
import { rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * THE RELAY — the only thing this server does for the product.
 *
 * The Synapse Windows app holds the brain (goals, memory, context, decisions) on the user's own
 * computer. It can't ship the Gemini key inside an installer, so it sends each model call here and
 * this route forwards it with the key. Nothing is stored. No pages, no accounts, no product logic.
 */
const body = z.object({
  system: z.string().max(60_000).optional(),
  user: z.string().min(1).max(40_000),
  fast: z.boolean().optional(),
  maxTokens: z.number().int().min(16).max(1200).optional(),
  temperature: z.number().min(0).max(1.2).optional(),
  images: z.array(z.object({ mimeType: z.enum(["image/jpeg", "image/png"]), data: z.string().max(6_000_000) })).max(1).optional(),
});

export async function POST(req: Request) {
  const install = req.headers.get("x-synapse-install") ?? "";
  if (!/^[a-z0-9]{8,40}$/.test(install)) return NextResponse.json({ error: "unknown client" }, { status: 401 });
  if (rateLimited(req, "relay", 60, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let parsed;
  try { parsed = body.safeParse(await req.json()); } catch { return NextResponse.json({ error: "invalid" }, { status: 400 }); }
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const text = await callModel(parsed.data);
  if (!text) return NextResponse.json({ text: null }, { status: 503 });
  return NextResponse.json({ text });
}
