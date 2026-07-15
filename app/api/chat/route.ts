import { NextResponse } from "next/server";
import { answerChat } from "@/ai/pipeline";
import { preGate, CRISIS_RESPONSE } from "@/ai/safety";

export const runtime = "nodejs";

/**
 * Synapse's conversation endpoint. Safety pre-gate first; then the Gemini-powered
 * agent answers using the supplied context (the user's own data + recent chat).
 * When AI isn't configured, we still answer AS Synapse — warm for chit-chat,
 * honest about needing data for analysis — never a robotic placeholder.
 */
function fallback(message: string, hasData: boolean): { content?: string; sections?: { kind: string; text: string }[] } {
  const m = message.toLowerCase().trim();
  const isGreeting = /\b(hi|hey|hello|yo|sup|good (morning|afternoon|evening)|how are you|what'?s up)\b/.test(m);
  const aboutSynapse = /\b(your name|like the name|who are you|what are you|synapse|founder|created you|do you like)\b/.test(m);

  if (aboutSynapse) {
    return { content: "I'm Synapse — your health intelligence companion. And yes, I'm fond of the name: a synapse is where signals connect, which is exactly my job — connecting the dots in your health over time so things make more sense. It's good to meet you. Whenever you're ready, complete a check-in and I'll start learning your patterns." };
  }
  if (isGreeting) {
    return { content: "Hi — I'm Synapse. Good to see you. I'm here to help you understand how you're doing over time. Ask me anything, or complete a check-in and I'll start spotting what's changing for you." };
  }
  if (!hasData) {
    return { content: "I'd love to dig in, but I don't have any check-ins from you yet — so I'd just be guessing, and I'd rather be honest than do that. Complete your first check-in and I'll start reasoning over your real data. In the meantime, is there anything about how Synapse works you'd like to know?" };
  }
  return {
    sections: [
      { kind: "observation", text: "I can see your check-ins, and I'm building a picture of your trends." },
      { kind: "education", text: "I reason best over several weeks — the more consistently you check in, the clearer the patterns I can explain." },
      { kind: "ask_provider", text: "Ask me things like “what changed this week?” or “what should I focus on?” and I'll work from your own history." },
    ],
  };
}

type Tier = "free" | "pro" | "max";

/** Per-tier reasoning directive. Free is still genuinely useful — just concise. */
const CHAT_DEPTH: Record<Tier, string> = {
  free: "[Plan: Free — still give a real, personalized read: one specific observation grounded in their own data plus one concrete takeaway. Keep it to a few sentences. Save exhaustive multi-week pattern analysis for a fuller answer, and, only if it's naturally relevant, mention that deeper ongoing analysis is what Pro adds.]",
  pro: "[Plan: Pro — connect signals across their weeks, reference specific trends and timing, and end with a concrete next step. Be substantive.]",
  max: "[Plan: Max — this member has opted into the deepest analysis. Reason across their full history, connect multiple signals, weigh alternative explanations, note how the picture has evolved, and offer a clear, specific way forward. Be thorough and precise — never padded.]",
};

export async function POST(req: Request) {
  let message = "";
  let context = "";
  let tier: Tier = "pro";
  try { ({ message, context, tier } = await req.json()); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!message?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  if (tier !== "free" && tier !== "pro" && tier !== "max") tier = "pro";

  const crisis = preGate(message);
  if (crisis.triggered) return NextResponse.json({ role: "assistant", content: CRISIS_RESPONSE });

  const ctx = `${context || "No data yet."}\n\n${CHAT_DEPTH[tier]}`;
  const { text, source } = await answerChat(message, ctx, tier);
  if (source === "model" && text) return NextResponse.json({ role: "assistant", content: text });

  const hasData = !!context && context !== "No data yet." && /Metric trends/.test(context);
  return NextResponse.json({ role: "assistant", ...fallback(message, hasData) });
}
