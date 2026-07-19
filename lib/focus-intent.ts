/**
 * CONVERSATIONAL MODE ENTRY — roles are entered, not clicked.
 *
 * A user shouldn't have to find a "Focus" tab. They should be able to say
 * "I'm about to start a work session on my thesis" and have Synapse recognize
 * that as a signal to enter focus/coach mode and help. This deterministic
 * detector reads a message for that intent and pulls out the goal + any duration,
 * so the conversation can offer to start a real focus session on the spot.
 *
 * Deterministic and cheap — no model call, no engine involvement.
 */

const CUES: RegExp[] = [
  /\bfocus (session|block|time|sprint)\b/,
  /\bwork session\b/,
  /\bdeep work\b/,
  /\bstart(ing)? (a |my )?(work|study|writing|focus)\b/,
  /\b(help me|let'?s) (focus|concentrate|lock in|get to work)\b/,
  /\bkeep me (accountable|on track)\b/,
  /\bpomodoro\b/,
  /\bstudy session\b/,
  /\bi'?m about to (work|start|study|write|focus)\b/,
  /\btime to (work|focus|study|write)\b/,
];

export interface FocusIntent { focus: boolean; goal?: string; minutes?: number }

export function detectFocusIntent(text: string): FocusIntent {
  const raw = (text || "").trim();
  const t = raw.toLowerCase();
  if (!CUES.some((r) => r.test(t))) return { focus: false };

  // Duration, if mentioned ("25 min", "for an hour", "90m").
  let minutes: number | undefined;
  const mm = t.match(/(\d{1,3})\s*(?:minutes?|mins?|m)\b/);
  if (mm) minutes = Math.min(180, Math.max(5, parseInt(mm[1], 10)));
  else if (/\ban hour\b/.test(t)) minutes = 60;
  else if (/\bhalf an hour\b/.test(t)) minutes = 30;

  // Goal, if mentioned ("on X", "working on X", "for X").
  let goal: string | undefined;
  const gm = raw.match(/\b(?:working on|work on|on|for|to)\s+(.{3,80})/i);
  if (gm) {
    goal = gm[1]
      .replace(/[.!?].*$/s, "")
      .replace(/\bfor \d+.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    // Guard against grabbing filler ("on it", "for now").
    if (/^(it|now|today|a bit|while|the next)\b/i.test(goal) || goal.length < 3) goal = undefined;
  }
  return { focus: true, goal, minutes };
}
