import { NextResponse } from "next/server";
import { answerChat } from "@/ai/pipeline";
import { callModel } from "@/ai/client";
import { preGate, CRISIS_RESPONSE } from "@/ai/safety";
import { rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Browser orb → clarity conversation. Same Synapse pipeline as the website (/api/chat), with two
 * extra sources of context the orb has and the website doesn't:
 *   1. the tab they're looking at (title + URL, and — only if they switched it on — a screenshot,
 *      which a fast vision pass turns into a short description before the main pipeline runs);
 *   2. what happened at the distraction gate today.
 * Hidden machinery tags are stripped here; check-in tags are returned so the extension can deliver
 * them as real browser notifications.
 */

interface Turn { role: "user" | "synapse"; text: string }
interface Body {
  message: string;
  history?: Turn[];
  goals?: string;
  page?: { title?: string; url?: string };
  screenshot?: string; // data:image/jpeg;base64,...
  gateSummary?: string;
  localTime?: string;
}

const SCREEN_SYSTEM = `You are the eyes for Synapse, a follow-through partner. You'll get a screenshot of the browser tab the person is looking at and the question they're asking about it. Describe, in at most 8 short lines, what is on the screen that matters for their question: the site, the specific content (headings, visible text, the idea or document they're looking at, key numbers), and anything that signals what they're doing. Quote short visible text exactly when it matters. Do not give advice. Do not guess at things you can't see.`;

async function describeScreen(dataUrl: string, question: string): Promise<string | null> {
  const m = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m || m[2].length > 6_000_000) return null;
  const text = await callModel({
    system: SCREEN_SYSTEM,
    user: `Their question: "${question.slice(0, 600)}"\n\nDescribe what's on their screen that matters for it.`,
    images: [{ mimeType: m[1], data: m[2] }],
    fast: true,
    maxTokens: 500,
    temperature: 0.2,
  });
  return text?.trim() || null;
}

export async function POST(req: Request) {
  if (rateLimited(req, "ext-chat", 30, 60_000)) return NextResponse.json({ content: "One sec — that came through very fast. Try again in a moment." }, { status: 429 });
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid" }, { status: 400 }); }
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ error: "empty" }, { status: 400 });

  if (preGate(message).triggered) return NextResponse.json({ content: CRISIS_RESPONSE, reachouts: [] });

  const screen = body.screenshot ? await describeScreen(body.screenshot, message) : null;
  const history = (body.history ?? []).slice(-10)
    .map((t) => `${t.role === "user" ? "Them" : "Synapse"}: ${t.text.slice(0, 700)}`).join("\n");

  const context = [
    `SURFACE: They're talking to you through the Synapse orb that lives at the edge of their browser. You also guard the sites they listed as distractions: they have to convince you before they get in, and you give them a timed pass.`,
    body.localTime ? `Local time: ${body.localTime}` : "",
    body.goals?.trim() ? `Goals: ${body.goals.trim().slice(0, 1200)}` : "Goals: they haven't written any in the orb's settings yet.",
    body.page?.url ? `THE TAB THEY'RE ON: ${body.page.title ?? ""} — ${body.page.url}` : "",
    screen
      ? `WHAT'S ON THEIR SCREEN RIGHT NOW (from a screenshot they chose to share):\n${screen}`
      : body.screenshot ? "They tried to share their screen but it couldn't be read — say so if their question depends on it." : "They did not share their screen this time; if the question depends on what's on it, tell them to switch on \"Let Synapse see this tab\".",
    body.gateSummary ? `DISTRACTION GATE TODAY: ${body.gateSummary}` : "",
    history ? `RECENT CONVERSATION IN THE ORB:\n${history}` : "",
  ].filter(Boolean).join("\n\n");

  const { text, source } = await answerChat(message, context, "pro");
  if (source !== "model" || !text) {
    return NextResponse.json({ content: "I couldn't think that through just now. Give it a moment and ask again — if it keeps happening, the daily AI limit may have been hit.", reachouts: [] });
  }

  const reachouts: { minutes: number; text: string }[] = [];
  for (const m of text.matchAll(/\[\[\s*reachout\s*:\s*(\d+)\s*\|\s*([^\]]+?)\s*\]\]/gi)) {
    const minutes = Math.min(24 * 60, Math.max(1, parseInt(m[1], 10)));
    reachouts.push({ minutes, text: m[2].slice(0, 200) });
  }
  const content = text.replace(/\[\[[\s\S]*?\]\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return NextResponse.json({ content, reachouts, sawScreen: !!screen });
}
