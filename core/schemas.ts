import { z } from "zod";

/**
 * Zod schemas that enforce the insight contract at the boundary between the
 * model and the rest of the system. Model output is validated against these;
 * malformed output triggers a repair retry, then a graceful stats-only
 * fallback (see ai/agent.ts). The shape makes medical advice structurally
 * impossible to emit — there is simply no field for it.
 */


/**
 * CONVERSATION COMPREHENSION (chat pass 1)
 * ----------------------------------------
 * Before Synapse writes a reply, a fast pass reads the turn and builds this explicit,
 * structured understanding: what the user actually SAID vs. ASKED vs. what is merely
 * inferred, and which RESPONSE MODE the message licenses. Pass 2 (generation) obeys the
 * mode, so a bare statement can no longer be turned into invented coaching. This never
 * writes beliefs/goals/decisions and never reads mind.evidence[] — it is a reading of
 * the conversation only (Stage-2 firewall preserved).
 */
export const RESPONSE_MODES = [
  "ACKNOWLEDGE", // a statement / thinking aloud with no request — reflect it back, do not advise
  "ANSWER",      // a direct question — answer it
  "CLARIFY",     // genuinely ambiguous AND a missing fact would change the help — ask ONE thing
  "RECOMMEND",   // they asked what to do / to decide — reason over real constraints, give a pick
  "PLAN",        // they asked for a plan / steps
  "COMPARE",     // they asked to weigh options
  "REFLECT",     // venting / processing — mirror, at most one gentle question, no prescribing
  "CORRECT",     // they corrected Synapse — update the understanding, don't repeat the old read
  "CHALLENGE",   // evidence contradicts their plan and pushing back is warranted
  "EXECUTE",     // they asked for an artifact (draft/list/outline) — just produce it
] as const;
export const responseModeEnum = z.enum(RESPONSE_MODES);
export type ResponseMode = z.infer<typeof responseModeEnum>;

export const INTENTS = [
  "statement", "question", "decision_request", "planning", "comparison", "reflection",
  "venting", "progress_report", "correction", "constraint_intro", "reassurance_seeking",
  "smalltalk", "continuation", "execute_request", "other",
] as const;

export const comprehensionSchema = z.object({
  intent: z.enum(INTENTS),
  responseMode: responseModeEnum,
  /** Facts the user LITERALLY stated this turn (verbatim-ish, no interpretation). */
  explicitClaims: z.array(z.string()).max(10).default([]),
  /** What the user LITERALLY asked for (empty if they asked for nothing). */
  explicitRequests: z.array(z.string()).max(6).default([]),
  /** Did they actually invite advice / a decision / a plan? */
  askedForAdvice: z.boolean().default(false),
  askedToDecide: z.boolean().default(false),
  askedForPlan: z.boolean().default(false),
  /** Real constraints stated or clearly implied by the words (deadlines, time, resources). */
  constraints: z.array(z.string()).max(8).default([]),
  /** Temporal facts, tagged: e.g. "assignments: due today". Never invent a different day. */
  temporal: z.array(z.string()).max(8).default([]),
  /** Decision-relevant things Synapse does NOT know (only if a recommendation is in play). */
  unknowns: z.array(z.string()).max(6).default([]),
  /** Conflicts between this turn and earlier context. */
  contradictions: z.array(z.string()).max(4).default([]),
  /** If intent is correction: what earlier interpretation is being corrected. */
  correctionOf: z.string().max(200).optional(),
  /** One line of why this reading — for logs/debug, never shown. */
  rationale: z.string().max(280).optional(),
});
export type Comprehension = z.infer<typeof comprehensionSchema>;
