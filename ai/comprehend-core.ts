/**
 * COMPREHENSION — pure core (no server-only imports) so it is unit-testable and can also power
 * the offline fallback. Holds the deterministic reading + the safety normalizer that guarantees
 * pass-1 mistakes can only ever REDUCE intervention, never manufacture it.
 */

import { comprehensionSchema, type Comprehension } from "@/ai/schemas";

const QUESTION_LEAD = /^(what|which|who|whom|whose|when|where|why|how|should|shall|can|could|would|will|do|does|did|is|are|am|was|were|have|has|had|may|might)\b/i;
const DECIDE = /\b(should i|what should i (do|work on|focus)|which (one|should)|help me (decide|choose|pick|prioriti[sz]e)|(worth it|better) to|do i|is it better)\b/i;
const OR_CHOICE = /\b(\w[\w' ]{1,40})\s+(?:or|vs\.?|versus)\s+(\w[\w' ]{1,40})\??$/i;
const PLAN = /\b(plan|steps|step by step|walk me through|how do i (start|begin|go about)|break (this|it) down|roadmap|schedule for)\b/i;
const EXECUTE = /\b(write|draft|compose|make me|create|generate|outline|rewrite|summari[sz]e|list out|give me a list)\b/i;
const CORRECTION = /(that'?s not what i meant|not what i meant|no,? i |that'?s wrong|you (misunderstood|got that wrong)|i didn'?t say|actually,? (no|i|it|that)|i meant\b|not really,? i)/i;
const VENT = /\b(i'?m (so |really |just )?(tired|exhausted|overwhelmed|stressed|burnt? out|done|drained|anxious|frustrated|lost|stuck)|i can'?t (do this|take|keep)|hate this|ugh|fed up|falling apart)\b/i;
const REASSURE = /\b(am i (ok|okay|doing (ok|okay|enough|alright))|is that (ok|okay|normal|enough|fine)|(do you think )?i('?ll| will) be (ok|okay|fine)|is this normal|reassure)\b/i;
const SMALLTALK = /^(hi|hey|hello|yo|sup|hiya|good (morning|afternoon|evening)|how are you|how'?s it going|what'?s up|thanks|thank you|ty|thx|lol|haha|ok(ay)?|cool|nice|got it)[\s!.?]*$/i;
const PROGRESS = /\b(i (just |already )?(did|finished|completed|wrote|sent|submitted|shipped|studied|worked on|got through)|done with|finished the|knocked out)\b/i;

/** Deterministic reading — conservative: when in doubt it does NOT escalate to coaching. */
export function fallbackComprehension(message: string): Comprehension {
  const raw = message.trim();
  const m = raw.toLowerCase();
  const isQuestion = raw.includes("?") || QUESTION_LEAD.test(m);
  const claims = [raw.slice(0, 200)];

  const base = {
    explicitClaims: claims,
    explicitRequests: [] as string[],
    askedForAdvice: false, askedToDecide: false, askedForPlan: false,
    constraints: [] as string[], temporal: [] as string[], unknowns: [] as string[],
    contradictions: [] as string[], rationale: "deterministic fallback",
  };

  if (SMALLTALK.test(raw)) return comprehensionSchema.parse({ ...base, intent: "smalltalk", responseMode: "ANSWER", explicitClaims: [] });
  if (CORRECTION.test(m)) return comprehensionSchema.parse({ ...base, intent: "correction", responseMode: "CORRECT", correctionOf: "a prior interpretation" });
  if (DECIDE.test(m) || (isQuestion && OR_CHOICE.test(raw))) return comprehensionSchema.parse({ ...base, intent: "decision_request", responseMode: "RECOMMEND", explicitRequests: ["decide what to do"], askedForAdvice: true, askedToDecide: true });
  if (isQuestion && PLAN.test(m)) return comprehensionSchema.parse({ ...base, intent: "planning", responseMode: "PLAN", explicitRequests: ["a plan"], askedForPlan: true });
  if (EXECUTE.test(m) && !isQuestion) return comprehensionSchema.parse({ ...base, intent: "execute_request", responseMode: "EXECUTE", explicitRequests: ["produce an artifact"] });
  if (REASSURE.test(m)) return comprehensionSchema.parse({ ...base, intent: "reassurance_seeking", responseMode: "REFLECT" });
  if (VENT.test(m)) return comprehensionSchema.parse({ ...base, intent: "venting", responseMode: "REFLECT" });
  if (isQuestion) return comprehensionSchema.parse({ ...base, intent: "question", responseMode: "ANSWER", explicitRequests: ["answer the question"] });
  if (PROGRESS.test(m)) return comprehensionSchema.parse({ ...base, intent: "progress_report", responseMode: "ACKNOWLEDGE" });
  return comprehensionSchema.parse({ ...base, intent: "statement", responseMode: "ACKNOWLEDGE" });
}

/** Safety net so pass-1 (model) mistakes can only REDUCE intervention, never invent it. */
export function normalizeComprehension(c: Comprehension, message: string): Comprehension {
  const askedSomething = c.askedForAdvice || c.askedToDecide || c.askedForPlan || c.explicitRequests.length > 0 || message.includes("?");
  const escalated = ["RECOMMEND", "PLAN", "COMPARE", "CHALLENGE"];
  if (!askedSomething && escalated.includes(c.responseMode)) {
    return { ...c, responseMode: c.intent === "venting" || c.intent === "reflection" ? "REFLECT" : "ACKNOWLEDGE" };
  }
  return c;
}
