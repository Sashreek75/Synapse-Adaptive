/**
 * NAVIGATE BY INTENT — Synapse drives you to the right place.
 *
 * A companion doesn't say "head over to /daily"; it takes you there. This deterministic
 * detector reads a message for a clear request to GO somewhere — check in, reflect, see
 * your numbers, your weekly review, the You page — so the conversation can move the person
 * there instead of handing out a link. No model call, no engine involvement.
 *
 * Guiding rule (learned from a bug): a long, discursive message is CONVERSATION, not a command.
 * "I've been working since 6:10, still below my goal, I need to study for physics" must NOT
 * navigate just because it contains "my goal" and "I need to". Navigation requires either a
 * short, on-purpose phrase or an explicit "take me to …" directive at the very start.
 */

export interface NavIntent { to: string; label: string; talk?: boolean }

const CATEGORIES: { rx: RegExp; to: string; label: string; talk?: boolean; directiveOnly?: boolean }[] = [
  // reflect first, so "talk through my day" opens the conversational snapshot, not the form
  { rx: /\b(reflect|talk (it|things|this|that)?\s*(through|out)|process (my|the|today'?s) day|vent|clear my head|think (this|things|it) through|unpack (my|the|today))\b/, to: "/daily", label: "reflect together", talk: true },
  { rx: /\b(check[\s-]?in|daily snapshot|snapshot|log (my|today|this)|do (my|today'?s)? ?(daily|check[\s-]?in)|today'?s entry|capture today)\b/, to: "/daily", label: "today's snapshot" },
  { rx: /\b(numbers|stats|statistics|the data|my data|charts?|trend lines?|my trends?)\b/, to: "/stats", label: "your progress" },
  // "goal"/"goals" collides with normal reflection ("below my goal"), so ONLY navigate here when
  // there's an actual movement directive ("take me to my goals").
  { rx: /\b(my )?goals?\b|what i'?m working toward|my objectives?/, to: "/goals", label: "your goals", directiveOnly: true },
  { rx: /\b(weekly (review|report|recap|sit[\s-]?down)|review my week|my week look|how'?s my week)\b/, to: "/report", label: "your weekly review" },
  { rx: /\b(what have you learned|how do you see me|the you page|about[\s-]?me page|my playbook|what you (know|understand) about me)\b/, to: "/playbook", label: "who you're becoming" },
];

// A movement verb — but the want/need form must be tied to a GO-ish verb ("want to see/open/check"),
// never a bare "I need to <anything>" (which shows up constantly in ordinary talk).
const DIRECTIVE = /\b(take me|bring me|go to|open|show me|pull up|head (to|over)|jump to|let'?s (do|go|see|talk|reflect)|(?:want|need|'?d like|wanna) to (?:see|go|open|check|look at|review|do|visit|pull up)|start (my|today'?s|a))\b/;

// An explicit relocation command at the START of the message always wins.
const STRONG_LEAD = /^(take me|bring me|go to|open|show me|pull up|head (to|over)|jump to)\b/;

const ANSWER_SEEKING = /(\btell me\b|\bexplain\b|\bwhat (do|does|is|are|'?s)\b|\bhow (am|do|does|is|are|'?s) i\b|\bmean(s|ing)?\b|\bhelp me understand\b|\bwhy\b|\bshould i\b|\bis (it|this|that)\b)/;

/** Returns a destination ONLY when the message genuinely reads as a request to GO there. */
export function detectNavIntent(text: string): NavIntent | null {
  const t = (text || "").toLowerCase().trim();
  if (!t) return null;

  const wordCount = t.split(/\s+/).filter(Boolean).length;
  const strongLead = STRONG_LEAD.test(t);

  // A long message is conversation unless it literally opens with "take me to …".
  if (wordCount > 12 && !strongLead) return null;

  const hasGo = DIRECTIVE.test(t);
  if (!hasGo) {
    if (ANSWER_SEEKING.test(t)) return null;
    if (/\?/.test(t)) return null;
    const terse = wordCount <= 3 && !/^(what|why|how|who|when|which|is|are|do|does|can|should)\b/.test(t);
    if (!terse) return null;
  }

  for (const c of CATEGORIES) {
    if (!c.rx.test(t)) continue;
    if (c.directiveOnly && !hasGo) continue; // e.g. "goal" mentioned in passing → don't route
    return { to: c.to, label: c.label, talk: c.talk };
  }
  return null;
}
