/**
 * NAVIGATE BY INTENT — Synapse drives you to the right place.
 *
 * A companion doesn't say "head over to /daily"; it takes you there. This deterministic
 * detector reads a message for a clear request to GO somewhere — check in, reflect, see
 * your numbers, your weekly review, the You page — so the conversation can move the person
 * there instead of handing out a link. No model call, no engine involvement.
 */

export interface NavIntent { to: string; label: string; talk?: boolean }

const CATEGORIES: { rx: RegExp; to: string; label: string; talk?: boolean }[] = [
  // reflect first, so "talk through my day" opens the conversational snapshot, not the form
  { rx: /\b(reflect|talk (it|things|this|that)?\s*(through|out)|process (my|the|today'?s) day|vent|clear my head|think (this|things|it) through|unpack (my|the|today))\b/, to: "/daily", label: "reflect together", talk: true },
  { rx: /\b(check[\s-]?in|daily snapshot|snapshot|log (my|today|this)|do (my|today'?s)? ?(daily|check[\s-]?in)|today'?s entry|capture today)\b/, to: "/daily", label: "today's snapshot" },
  { rx: /\b(numbers|stats|statistics|the data|my data|charts?|trend lines?|my trends?)\b/, to: "/stats", label: "your numbers" },
  { rx: /\b(weekly (review|report|recap|sit[\s-]?down)|review my week|my week look|how'?s my week)\b/, to: "/report", label: "your weekly review" },
  { rx: /\b(what have you learned|how do you see me|the you page|about[\s-]?me page|my playbook|what you (know|understand) about me)\b/, to: "/playbook", label: "what I understand about you" },
];

const DIRECTIVE = /\b(take me|bring me|go to|open|show me|pull up|head (to|over)|jump to|let'?s (do|go|see|talk|reflect)|i (want|need|'?d like|wanna) to|start (my|today'?s|a))\b/;

/** Words that mean "answer me right here", not "move me somewhere else". A companion that
 * can actually talk should never march you to another page when you're just asking it a
 * question — it should reply in place. */
const ANSWER_SEEKING = /(\btell me\b|\bexplain\b|\bwhat (do|does|is|are|'?s)\b|\bhow (am|do|does|is|are|'?s) i\b|\bmean(s|ing)?\b|\bhelp me understand\b|\bwhy\b|\bshould i\b|\bis (it|this|that)\b)/;

/** Returns a destination ONLY when the message genuinely reads as a request to GO there.
 * Questions and "just tell me…" requests return null, so they get answered in place instead
 * of routed. ("what do these numbers mean?" and "the numbers don't add up in my essay" both stay put.) */
export function detectNavIntent(text: string): NavIntent | null {
  const t = (text || "").toLowerCase().trim();
  if (!t) return null;
  const hasGo = DIRECTIVE.test(t);
  // An explicit "take me / go to / open …" wins outright — even if they also tack a question
  // onto it ("take me to my numbers, what do they mean?"). Move them; they can ask more there.
  if (!hasGo) {
    // No movement verb: a question or a "just tell me…" reads as answer-in-place, not relocate.
    if (ANSWER_SEEKING.test(t)) return null;
    if (/\?/.test(t)) return null;
    const wordCount = t.split(/\s+/).filter(Boolean).length;
    // A bare noun-phrase ("my numbers", "weekly report") still reads as go; a question word never does.
    const terse = wordCount <= 3 && !/^(what|why|how|who|when|which|is|are|do|does|can|should)\b/.test(t);
    if (!terse) return null;
  }
  for (const c of CATEGORIES) if (c.rx.test(t)) return { to: c.to, label: c.label, talk: c.talk };
  return null;
}
