/**
 * CONVERSATIONAL OBSERVATION CAPTURE — Stage 2 (capture only, no influence).
 *
 * Synapse's job here is to get better at PAYING ATTENTION, not at profiling. When it notices a
 * concrete, specific behavioral signal in conversation (how the person decides, doubts, follows
 * through, reopens things), it appends an invisible tag `[[observe: pattern-key | concrete note]]`.
 * This module parses that tag and turns it into ONE atomic piece of Evidence in the SYNCED mind —
 * nothing else. It forms NO hypotheses, promotes NO beliefs, and influences NO decision. That is a
 * later, separately-approved stage, gated on inspecting whether these observations are actually good.
 *
 * The epistemic firewall lives HERE, at capture:
 *   - an OBSERVATION ("reopened this decision a 4th time") may be captured;
 *   - an INFERENCE ("is afraid of committing") must NOT be — it's silently dropped;
 *   - the pattern key names an observed BEHAVIOR, never a supposed cause;
 *   - a single observation is always low-confidence and never a durable belief.
 * A conservative parser: anything malformed, vague, off-vocabulary, or label-like is ignored.
 */

import type { Evidence } from "@/types";

/** The only pattern keys Stage 2 will accept — each names a behavior, not a cause. Off-list keys are
 * dropped, which is the schema-level guard against the model sneaking a trait ("commitment_anxiety")
 * into the key. */
export const ALLOWED_PATTERN_KEYS: ReadonlySet<string> = new Set([
  // decision behavior
  "reopened_decision", "repeated_question", "reassurance_seeking", "over_comparison", "changed_mind_after_setback",
  // goal behavior
  "avoidance_at_step", "stuck_same_step", "priority_execution_mismatch", "abandons_after_setback", "ambition_then_reduce",
  // conversational behavior
  "doubt_loop", "certainty_seeking", "circling_question", "strong_reaction_constraint", "position_change_on_evidence",
  // self-understanding signals
  "preference_signal", "follow_through_signal", "changed_mind",
]);

/** Words that signal an INFERENCE / clinical / personality label rather than an observation. If a note
 * contains one, the observation is dropped — we capture what happened, not what it "means". */
const LABEL_BLOCKLIST = [
  "anxiety", "anxious", "insecure", "insecurity", "depressed", "depression", "adhd", "ocd", "bipolar",
  "neurotic", "perfectionist", "perfectionism", "trauma", "narcissist", "self-esteem", "self esteem",
  "indecisive", "indecision", "lazy", "procrastinator", "undisciplined", "unmotivated", "coward",
  "afraid of", "fear of", "scared of", "commitment issues", "commitment anxiety", "attachment",
];

const OBSERVE_RE = /\[\[\s*observe\s*:\s*([^\]]+?)\s*\]\]/gi;

export interface CapturedObservation { patternKey: string; note: string }

function normalizeKey(raw: string): string {
  return (raw || "").toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

/** Concrete = a real phrase describing something that happened, not a one-word trait or an inference. */
export function isConcreteNote(note: string): boolean {
  const t = (note || "").trim();
  if (t.length < 15 || t.length > 300) return false;   // too short = vague; too long = not an atom
  if (!/\s/.test(t)) return false;                      // must be a phrase, not a single label
  const low = t.toLowerCase();
  if (LABEL_BLOCKLIST.some((w) => low.includes(w))) return false;
  // Reject bare trait declarations like "User is impulsive." / "They seem indecisive."
  if (/\b(is|are|seems|seem|appears|appear)\s+(a\s+|an\s+|very\s+|quite\s+|really\s+)?\w+(\s+person)?\.?$/i.test(t)) return false;
  return true;
}

/**
 * Parse ALL observation tags out of a model reply. Returns the valid observations plus the reply with
 * every observe tag removed (so the user never sees them). Invalid tags are still stripped but not
 * captured. Never throws.
 */
export function extractObserveTags(text: string): { observations: CapturedObservation[]; cleaned: string } {
  const raw = text || "";
  const observations: CapturedObservation[] = [];
  const matches = raw.match(OBSERVE_RE);
  if (!matches) return { observations, cleaned: raw };

  for (const m of matches) {
    const inner = m.replace(/^\[\[\s*observe\s*:\s*/i, "").replace(/\s*\]\]$/, "");
    // Accept "key | note" or a lenient "key | polarity | note" (polarity ignored in Stage 2).
    const parts = inner.split("|").map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const key = normalizeKey(parts[0]);
    const note = (parts.length >= 3 ? parts.slice(2).join(" ") : parts[1]).trim();
    if (!ALLOWED_PATTERN_KEYS.has(key)) continue;      // off-vocabulary → drop
    if (!isConcreteNote(note)) continue;               // vague / label-like → drop
    // De-dupe identical captures within a single reply.
    if (observations.some((o) => o.patternKey === key && o.note === note)) continue;
    observations.push({ patternKey: key, note });
  }

  const cleaned = raw.replace(OBSERVE_RE, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { observations, cleaned };
}

/**
 * Build the atomic Evidence record for one observation — the SAME shape addContextNote already writes
 * (kind:"statement", source:"conversation"), so it lands in the synced mind.evidence log with one
 * canonical home. Always low capture-confidence: a single observation is never treated as established.
 */
export function buildObservationEvidence(patternKey: string, note: string, now = new Date().toISOString()): Evidence {
  return {
    id: `obs_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    kind: "statement",
    recordedAt: now,
    source: "conversation",
    text: note.trim(),
    captureConfidence: "low",
    facets: { patternKey, importance: "medium" },
  };
}
