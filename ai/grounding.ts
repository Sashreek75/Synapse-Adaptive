/**
 * "DOES THIS RESPONSE FOLLOW?" — deterministic guard (chat pass 2b).
 * Catches the specific failure class: a reply that invents a user STATE (overwhelmed, tired,
 * no energy…), moves work to a day the user never mentioned (the "tomorrow morning" bug), or
 * bolts unrequested advice/plans onto a message that asked for nothing. Not a substitute for
 * the mode-scoped generation — a backstop for when the model over-reaches anyway.
 *
 * Pure module (no server-only) so the eval suite can exercise it directly.
 */

import type { Comprehension, ResponseMode } from "@/ai/schemas";

/** Modes where advice / plans / next steps are legitimate — the guard relaxes for these. */
const ADVICE_OK: ResponseMode[] = ["RECOMMEND", "PLAN", "COMPARE", "CHALLENGE", "EXECUTE"];

const STATE_PATTERNS: { re: RegExp; stem: RegExp; label: string }[] = [
  { re: /\boverwhelm/i, stem: /overwhelm/i, label: "assumes they're overwhelmed" },
  { re: /\bburn(t|ed)?[ -]?out\b/i, stem: /burn/i, label: "assumes burnout" },
  { re: /\b(exhausted|drained)\b/i, stem: /(exhaust|drained)/i, label: "assumes exhaustion" },
  { re: /\b(no|don'?t have|without|low on|lack(?:ing)?|short on)\s+(?:the\s+)?energy\b/i, stem: /energy/i, label: "assumes low energy" },
  { re: /\b(too tired|you'?re tired|if you'?re tired|feeling tired)\b/i, stem: /tired/i, label: "assumes tiredness" },
  { re: /\b(you'?re|you seem|you might be|you may be|feeling)\s+(stressed|anxious|frustrated|behind|overwhelmed)\b/i, stem: /(stress|anxious|frustrat|behind)/i, label: "assumes an emotional state" },
  { re: /\b(procrastinat|you'?re avoiding|avoidance)\b/i, stem: /(procrastinat|avoid)/i, label: "assumes procrastination/avoidance" },
  { re: /\bstruggl(?:e|ing)\b/i, stem: /struggl/i, label: "assumes they're struggling" },
];

const DEFER_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\btomorrow\b/i, label: "moves work to tomorrow (not stated)" },
  { re: /\bnext week\b/i, label: "moves work to next week (not stated)" },
  { re: /\b(reschedul|postpon|put (?:it|them|that) off|push (?:it|them|that) (?:to|back)|do (?:it|them) (?:later|tomorrow)|leave (?:it|them) (?:for|till|until) (?:later|tomorrow)|save (?:it|them) for (?:later|tomorrow))\b/i, label: "suggests postponing (not asked)" },
];

const ADVICE_MARKERS: RegExp[] = [
  /\byou should\b/i, /\bi'?d (?:suggest|recommend|start by|focus on)\b/i,
  /\blet'?s (?:make|figure out|build|set up)?\s*(?:a )?plan\b/i, /\bhere'?s (?:what to do|the plan|my plan)\b/i,
  /\bnext step\b/i, /\bfirst,?\s+(?:do|start|tackle|knock)\b/i, /^\s*\d+[.)]\s+/m, /\bmake a plan\b/i,
];

const has = (re: RegExp, s: string) => re.test(s);

export interface GroundingResult { ok: boolean; issues: string[]; }

export function checkGrounding(message: string, reply: string, c: Comprehension): GroundingResult {
  const msg = message.toLowerCase();
  const issues: string[] = [];

  // 1. Invented user states — never allowed in ANY mode unless the user said it themselves.
  for (const p of STATE_PATTERNS) {
    if (has(p.re, reply) && !has(p.stem, msg)) issues.push(p.label);
  }

  // 2. Temporal drift / postponement the user never raised — only in modes where the user
  //    did NOT invite advice (in RECOMMEND/PLAN/etc., suggesting a different day is legitimate).
  if (!ADVICE_OK.includes(c.responseMode)) {
    for (const p of DEFER_PATTERNS) {
      if (has(p.re, reply) && !has(p.re, msg)) issues.push(p.label);
    }
  }

  // 3. Unrequested advice / plan / next step on a message that asked for nothing.
  if (!ADVICE_OK.includes(c.responseMode) && !c.askedForAdvice && !c.askedToDecide && !c.askedForPlan) {
    if (ADVICE_MARKERS.some((re) => has(re, reply))) issues.push("adds advice/a plan/a next step that wasn't asked for");
  }

  // 4. Question-stacking in low-intent modes (one optional question is fine; several is coaching).
  if ((c.responseMode === "ACKNOWLEDGE" || c.responseMode === "REFLECT")) {
    const qs = (reply.match(/\?/g) || []).length;
    if (qs >= 2) issues.push("asks multiple questions instead of letting them lead");
  }

  return { ok: issues.length === 0, issues };
}

/** Corrective instruction for the single repair pass. */
export function repairDirective(issues: string[], c: Comprehension): string {
  return [
    `Your draft broke the turn's rules: it ${issues.join("; ")}.`,
    "Rewrite it so it uses ONLY what the user actually said and asked for.",
    MODE_LINE[c.responseMode],
    "Do not assume any feeling, energy, difficulty, or future plan they didn't state, and do not move anything to another day.",
  ].join(" ");
}

const MODE_LINE: Record<ResponseMode, string> = {
  ACKNOWLEDGE: "Just acknowledge what they said in 1–2 sentences; no advice, no plan, no next step, at most one optional offer of help.",
  ANSWER: "Answer only what they asked, directly.",
  CLARIFY: "Ask only the one clarifying question that matters.",
  RECOMMEND: "Give a grounded recommendation from the real constraints.",
  PLAN: "Give the ordered steps they asked for.",
  COMPARE: "Weigh the options they raised, then give your pick.",
  REFLECT: "Mirror what they said; no prescribing; at most one gentle question.",
  CORRECT: "Answer from the corrected understanding; don't repeat the old read.",
  CHALLENGE: "Make the evidence-based point, then leave the choice with them.",
  EXECUTE: "Just produce what they asked for.",
};

/** Last-resort safe reply built from the pass-1 reading (used only if repair still fails). */
export function minimalAcknowledgement(c: Comprehension): string {
  const said = c.explicitClaims[0]?.replace(/[.?!]+$/, "");
  if (c.responseMode === "REFLECT") {
    return said ? `That sounds like a lot to sit with — ${said.toLowerCase()}. I'm here; tell me where you want to take it.` : "I hear you. I'm here — tell me where you want to take it.";
  }
  if (said) return `Got it — ${said.toLowerCase()}. Want to think through any of it together, or just noting it?`;
  return "Got it. Want to think through anything here together?";
}
