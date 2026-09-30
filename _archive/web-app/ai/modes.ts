/**
 * RESPONSE MODES — chat pass 2 governance.
 * The comprehension pass picks a mode; this turns it into a strict, per-turn directive that
 * OVERRIDES the persona's general "move them / end with a next step" bias. This is the piece
 * that stops a bare statement from being answered with invented coaching.
 *
 * Pure module (no server-only imports) so the eval suite can exercise it directly.
 */

import type { Comprehension, ResponseMode } from "@/ai/schemas";

export const MODE_DIRECTIVE: Record<ResponseMode, string> = {
  ACKNOWLEDGE:
    "They made a statement / thought aloud and asked for NOTHING. Acknowledge what they actually said in 1–2 sentences, using only their stated facts. Then STOP. Do NOT give advice, do NOT propose a plan or next step, do NOT assume how they feel (tired, overwhelmed, behind, stressed), do NOT assume they want to postpone or reschedule anything, and do NOT invent a future day. The 'always end with a next step / move them to act' rule does NOT apply this turn. You MAY end with at most ONE short, genuinely optional offer of help (e.g. \"want to think through either of them together?\") — only if it's natural; silence-with-acknowledgement is also a perfectly good reply.",
  ANSWER:
    "Answer their question directly and specifically first, in as few words as it honestly takes. Don't pad it with coaching, a plan, or a next step unless they asked. If you can't ground part of it, say so briefly and answer honestly anyway.",
  CLARIFY:
    "You are missing ONE fact that would genuinely change your answer. Ask for exactly that one thing, in one sentence, and say why it matters. Do not stack questions and do not pre-answer around the gap.",
  RECOMMEND:
    "They asked what to do / to decide. Reason over the ACTUAL constraints, deadlines, time available, stakes, reversibility, and opportunity cost that appear in the reading and context — nothing invented. Give a CLEAR pick and the decision-relevant reason (\"I'd do X because your Friday deadline makes delaying it costlier than the SAT, which is flexible\"). Don't default to \"balance both.\" If one missing fact would actually change the pick, ask for it instead of guessing. Keep the choice theirs (\"if it were me…\").",
  PLAN:
    "They asked for a plan. Give a short, ordered set of concrete steps (numbered), scoped to what they asked — not a lecture around it.",
  COMPARE:
    "They asked to weigh options. Lay the real options side by side with their actual tradeoffs, then give your pick and why, and leave the choice to them.",
  REFLECT:
    "They're processing / venting / seeking reassurance. Mirror what you actually heard and validate it honestly. Do NOT prescribe, do NOT hand them a plan or a next step, and do NOT diagnose their emotional state beyond what they said. At most ONE gentle, open question — or none.",
  CORRECT:
    "They corrected you. Take the correction as authoritative: drop the interpretation they rejected, say briefly that you've updated, and respond from the corrected understanding. Do NOT restate or defend the old read, and do NOT apologize more than a word.",
  CHALLENGE:
    "Their own evidence contradicts their plan and pushing back is warranted. Say the hard, true thing kindly, point to the specific evidence that fits better, and leave the decision with them. Ground the challenge in evidence, never arbitrary strictness.",
  EXECUTE:
    "They asked you to produce something (a draft, list, outline, message). Just produce it cleanly with almost no preamble. Don't hijack it into coaching.",
};

const yn = (b: boolean) => (b ? "yes" : "no");
const list = (a: string[]) => (a.length ? a.map((x) => `“${x}”`).join("; ") : "");

/** Render the pass-1 reading + the mode directive into the block pass 2 must obey. */
export function buildTurnBrief(c: Comprehension): string {
  const lines: string[] = [];
  lines.push("—— HOW TO READ AND ANSWER THIS TURN (obey exactly) ——");
  lines.push("What they actually SAID (the only facts you may treat as true about them this turn):");
  lines.push(c.explicitClaims.length ? c.explicitClaims.map((x) => `  • ${x}`).join("\n") : "  • (nothing factual asserted)");
  lines.push(`What they actually ASKED FOR: ${c.explicitRequests.length ? list(c.explicitRequests) : "nothing — this is a statement, not a request"}`);
  if (c.constraints.length) lines.push(`Real constraints: ${list(c.constraints)}`);
  if (c.temporal.length) lines.push(`Timing (do not move anything to another day): ${list(c.temporal)}`);
  if (c.unknowns.length) lines.push(`Decision-relevant things you do NOT know: ${list(c.unknowns)}`);
  if (c.contradictions.length) lines.push(`Conflicts with earlier: ${list(c.contradictions)}`);
  if (c.correctionOf) lines.push(`They are correcting: “${c.correctionOf}” — treat the correction as authoritative.`);
  lines.push(`Asked for advice: ${yn(c.askedForAdvice)} · asked to decide: ${yn(c.askedToDecide)} · asked for a plan: ${yn(c.askedForPlan)}`);
  lines.push("");
  lines.push(`RESPONSE MODE: ${c.responseMode}`);
  lines.push(MODE_DIRECTIVE[c.responseMode]);
  lines.push("");
  lines.push(
    "GROUNDING (hard rule, every mode): use ONLY the facts listed above and the grounded context. " +
    "Do NOT assert or assume any feeling, energy level, difficulty, motive, intention, or future action the user did not state. " +
    "Do NOT relocate anything to a different day or time than they gave. If you catch yourself inventing a problem in order to solve it, stop and cut it."
  );
  return lines.join("\n");
}
