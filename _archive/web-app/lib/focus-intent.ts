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
  /\btimer\b/,
  /\btime me\b/,
  /\bset (a|the) timer\b/,
  /\block in\b/,
  /\bpomodoro\b/,
  /\bstudy session\b/,
  /\bstart(ing)? (to |a |my )?(stud(y|ying)|work(ing)?|writ(e|ing)|read(ing)?|focus(ing)?)\b/,
  /\b(help me|let'?s|i want to|i'?d like to|i need to|i wanna|gonna|going to|gotta) (study|work|write|read|focus|concentrate|grind|lock in|get to work)\b/,
  /\bkeep me (accountable|on track)\b/,
  /\bi'?m about to (work|start|study|write|focus)\b/,
  /\btime to (work|focus|study|write)\b/,
  /\bheads?[\s-]?down\b/,
  /\bhit (a|the|my|some) (work|study|focus|writing|reading|deep work)\b/,
  /\bget in the zone\b/,
];

export interface FocusIntent { focus: boolean; goal?: string; minutes?: number }

export function detectFocusIntent(text: string): FocusIntent {
  const raw = (text || "").trim();
  const t = raw.toLowerCase();
  if (!CUES.some((r) => r.test(t))) return { focus: false };

  // VETO — a timer is for STARTING work, not for reflecting on a session that already happened,
  // venting, or asking for care. Unless they EXPLICITLY ask to start one, back off so the
  // conversation can respond with understanding instead of shoving a stopwatch at them.
  const STRONG_START = /\b(start (a|the|my)? ?(timer|focus|session|pomodoro|clock)|time me|set (a|the) timer|pomodoro|lock in|i'?m about to)\b/;
  const PAST = /\b(just|already|earlier|yesterday|last night|this morning|today|a while ago)\s+(hit|did|had|finished|completed|wrapped|got through|got out of|studied|worked|practiced|went)\b/;
  const REFLECT = /\b(didn'?t|don'?t think i|not sure i|feel like i|felt|wasn'?t (great|good|productive)|went (badly|poorly|terribly|ok|okay|alright|fine))\b/;
  const EMOTION = /\b(sad|upset|discouraged|defeated|demoralized|burn(ed|t)[\s-]?out|exhausted|drained|overwhelmed|unmotivated|frustrated|hopeless|miserable|deflated)\b|\b(feeling|feel|i'?m|im|so|really|a bit|bit|pretty|kind of|kinda|a little|little|quite) (down|low|blue)\b/;
  const ASK_HELP = /\b(what (should|do|can) i do|make (the rest of )?my day better|how (do|can) i (feel|get) better|don'?t know what to do|rest of my day)\b/;
  if (!STRONG_START.test(t) && (PAST.test(t) || REFLECT.test(t) || EMOTION.test(t) || ASK_HELP.test(t))) {
    return { focus: false };
  }

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
    if (/^(it|now|today|a bit|while|the next|an? hour|half an hour|hours?|a couple)\b/i.test(goal) || /^\d+\s*(m|mins?|minutes?|h|hours?)\b/i.test(goal) || goal.length < 3) goal = undefined;
    // The intent phrase itself is not a goal ("hit a work session" isn't a task).
    if (goal && /\b(work session|focus session|study session|deep work|lock in|heads?[\s-]?down|timer|pomodoro|the zone)\b/i.test(goal)) goal = undefined;
  }
  return { focus: true, goal, minutes };
}

/**
 * MODEL-DRIVEN FOCUS OFFER — Synapse decides (from context, not keywords) that a timer would help
 * and appends `[[focus: goal | minutes]]`. We strip it and turn it into a "Start a focus session"
 * affordance. This is what makes focus part of the adaptive companion rather than a trigger word.
 */
export function extractFocusOffer(text: string): { offered: boolean; goal?: string; minutes?: number; cleaned: string } {
  const raw = text || "";
  const m = raw.match(/\[\[\s*focus\s*:\s*([^\]]*?)\s*\]\]/i);
  if (!m) return { offered: false, cleaned: raw };
  let goal: string | undefined;
  let minutes: number | undefined;
  for (const part of (m[1] || "").split("|").map((s) => s.trim()).filter(Boolean)) {
    const mm = part.match(/^(\d{1,3})\s*(?:m|min|mins|minutes)?$/i);
    if (mm) minutes = Math.min(180, Math.max(5, parseInt(mm[1], 10)));
    else if (!goal) goal = part;
  }
  const cleaned = raw.replace(m[0], "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { offered: true, goal, minutes, cleaned };
}