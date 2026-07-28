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

const DIRECTIVE = /\b(take me|bring me|go to|open|show me|pull up|head (to|over)|jump to|let'?s (do|go|see|talk|reflect)|i (want|need|'?d like|wanna) to|can (we|you|i)|start (my|today'?s|a))\b/;

/** Returns a destination only when the message genuinely reads as a request to GO there —
 * not a passing mention (so "the numbers don't add up in my essay" won't navigate). */
export function detectNavIntent(text: string): NavIntent | null {
  const t = (text || "").toLowerCase().trim();
  if (!t) return null;
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  const directive = DIRECTIVE.test(t) || /^(what|how|show|see|pull up|open|let'?s)\b/.test(t) || wordCount <= 4;
  if (!directive) return null;
  for (const c of CATEGORIES) if (c.rx.test(t)) return { to: c.to, label: c.label, talk: c.talk };
  return null;
}
