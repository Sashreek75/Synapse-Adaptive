import { NextResponse } from "next/server";
import { answerChat } from "@/ai/pipeline";
import { preGate, CRISIS_RESPONSE } from "@/ai/safety";
import { rateLimited } from "@/lib/rate-limit";

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
    return { content: "I'm Synapse — your adaptive AI partner. I'm fond of the name: a synapse is where signals connect, which is exactly my job — connecting the dots in how you work over time so you can act on them. Good to meet you. Tell me what you're working on, or do a quick check-in, and I'll start learning how you tick." };
  }
  if (isGreeting) {
    return { content: "Hi — I'm Synapse, your adaptive AI partner. Good to see you. I learn how you work and help you act on it. Tell me what you're working on, or do a quick check-in, and I'll start spotting what's changing for you." };
  }
  if (!hasData) {
    return { content: "I'd love to dig in, but I don't have any check-ins from you yet — so I'd just be guessing, and I'd rather be honest than do that. Complete your first check-in and I'll start reasoning over your real data. In the meantime, is there anything about how Synapse works you'd like to know?" };
  }
  // The model didn't return a usable answer (usually a transient error or daily
  // free-tier quota). Be HONEST rather than showing canned coaching that ignores
  // the question — that erodes trust far more than a brief, truthful hiccup.
  return { content: "I couldn't fully think that through just now — I don't want to give you a half-answer, so give me a moment and ask again. (If it keeps happening, my daily AI limit may have been reached and it resets automatically.)" };
}

type Tier = "free" | "pro" | "max";

/** Per-tier DEPTH/LENGTH only — NOT a mandate to advise. Whether a reply ends with a next
 *  step is decided by the turn's RESPONSE MODE, never by the tier. (A tier directive that
 *  demanded a "next step" every turn was a root cause of replies over-reaching on plain
 *  statements.) */
const CHAT_DEPTH: Record<Tier, string> = {
  free: "[Plan: Free — concise: a real, specific, grounded reply in a few sentences. Match depth to what they actually asked; don't pad. Save exhaustive multi-week analysis for a fuller answer.]",
  pro: "[Plan: Pro — substantive when the message warrants it: connect signals and reference specific trends/timing where relevant. Let the RESPONSE MODE decide whether to advise or end with a next step.]",
  max: "[Plan: Max — deepest analysis WHEN the message calls for it: reason across history, weigh alternatives, note how the picture evolved. Still obey the RESPONSE MODE — a plain statement gets a brief acknowledgement, not an essay. Never padded.]",
};

export async function POST(req: Request) {
  if (rateLimited(req, "chat", 40, 60_000)) return NextResponse.json({ role: "assistant", content: "One sec — that came through very fast. Try again in a moment." }, { status: 429 });
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

  // Does the context carry genuine substance about this person — on ANY surface — vs. a brand-new
  // empty user? Keyed to the stable section headers our context blocks emit, NOT to one health-era
  // string ("Metric trends"). The old single-string check meant an established user talking through
  // the orb, or anyone with goals/planner/decisions but no metric check-ins, was wrongly told "I
  // don't have any check-ins from you yet" whenever the model briefly hiccuped. Any of these markers
  // ⇒ established ⇒ the honest "transient hiccup" message instead of the onboarding nudge.
  const DATA_MARKERS = /Metric trends|This week'?s focus|Your Playbook|What I currently believe|Connections I'?ve found|Working to become:|\bGoals:|THEIR PLANNER|THE WHOLE BOARD|WHAT YOU HAVE ALREADY TRIED|Recent calls you'?ve made|REOPENING A DECISION|A PROMISE THEY MADE|commitment they set today|FOLLOW-THROUGH LIKELIHOOD/i;
  const hasData = !!context && context.trim() !== "No data yet." && DATA_MARKERS.test(context);
  return NextResponse.json({ role: "assistant", ...fallback(message, hasData) });
}
