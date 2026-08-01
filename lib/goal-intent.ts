/**
 * GOAL INTENT — recognizing when someone declares an ambition worth executing.
 *
 * "I want to get into Stanford", "my goal is to run a marathon", "help me land a software
 * internship" — these are not idle chat; they are the birth of a campaign. When detected, the
 * app quietly creates the goal and decomposes it, while the conversation responds naturally.
 * Deterministic and conservative to avoid firing on casual talk. No model call, no engine.
 */

const CUES = [
  /\bmy goal is(?: to)?\s+(.{3,90})/i,
  /\bi (?:really )?want to (get into|become|land|achieve|build|launch|start|run|write|finish|lose|gain|learn|master|make|get)\s+(.{3,90})/i,
  /\bi'?m trying to (get into|become|land|achieve|build|launch|start|run|write|finish|lose|gain|learn|master|make|get)\s+(.{3,90})/i,
  /\bhelp me (get into|become|land|achieve|build|launch|start|run|write|finish|lose|gain|learn|master|get)\s+(.{3,90})/i,
  /\bi want to be (?:a |an )?(.{3,90})/i,
];

// Verbs that read as conversation, not ambition — never treat these as goals.
const NOT_GOAL = /\b(know|talk|chat|understand|see|check|ask|tell|say|think about|reflect|vent|figure out|decide)\b/i;

export interface GoalIntent { goal: string }

export function detectGoalIntent(text: string): GoalIntent | null {
  const raw = (text || "").trim();
  if (!raw) return null;
  for (const rx of CUES) {
    const m = raw.match(rx);
    if (!m) continue;
    // Reassemble the ambition: for cued verbs, keep the verb + object; for "my goal is", take the object.
    let goal = (m.length >= 3 ? `${m[1]} ${m[2]}` : m[1] || "").trim();
    goal = goal.replace(/[.!?].*$/s, "").replace(/\s+/g, " ").trim();
    if (goal.length < 3 || goal.length > 90) continue;
    if (NOT_GOAL.test(goal)) continue;
    return { goal: goal.charAt(0).toUpperCase() + goal.slice(1) };
  }
  return null;
}
