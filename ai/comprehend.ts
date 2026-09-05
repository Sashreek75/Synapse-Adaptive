import "server-only";

/**
 * CHAT PASS 1 — CONVERSATION COMPREHENSION
 * ----------------------------------------
 * Before Synapse writes anything, this fast pass builds an explicit, structured reading of
 * the turn: what was SAID vs. ASKED vs. merely inferred, and which RESPONSE MODE the message
 * licenses. Pass 2 obeys the mode, which is what stops a bare statement ("two assignments
 * today") from being turned into invented coaching ("...maybe do them tomorrow morning").
 *
 * Firewall: this reads the CONVERSATION only. It never touches mind.evidence[], never writes
 * beliefs/goals/decisions — it just routes the turn.
 */

import { callModel, extractJson } from "@/ai/client";
import { COMPREHENSION_PROMPT } from "@/ai/prompts";
import { comprehensionSchema, type Comprehension } from "@/ai/schemas";
import { fallbackComprehension, normalizeComprehension } from "@/ai/comprehend-core";

export { fallbackComprehension } from "@/ai/comprehend-core";

/** Run pass 1. Uses the fast model; falls back to the deterministic reading on any failure. */
export async function comprehend(message: string, contextTail = ""): Promise<{ c: Comprehension; source: "model" | "fallback" }> {
  const refs = contextTail ? `\n\nRECENT CONTEXT (for resolving references / continuity ONLY — do NOT copy states from here into explicitClaims):\n${contextTail.slice(-1600)}` : "";
  const user = `USER MESSAGE (classify THIS):\n"""\n${message}\n"""${refs}\n\nReturn ONLY the JSON.`;
  const raw = await callModel({ system: COMPREHENSION_PROMPT.system, user, fast: true, maxTokens: 500, temperature: 0.1 });
  if (raw) {
    const parsed = comprehensionSchema.safeParse(extractJson(raw));
    // Guard: even if the model over-reaches, a message that asked for nothing may not be
    // escalated into advice/plan/decision modes.
    if (parsed.success) return { c: normalizeComprehension(parsed.data, message), source: "model" };
  }
  return { c: fallbackComprehension(message), source: "fallback" };
}
