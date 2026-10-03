/**
 * PERMISSION — the part of "one brain" that can't be left to the model.
 *
 * If Synapse says "yes, you can play" in the orb, the gate must let them in. The model is told to
 * attach a [[free]] / [[pass]] tag when it says yes, but it sometimes forgets, and then the gate
 * (a separate model call) contradicts it ("I didn't say that"). So the code reads the words itself:
 *
 *   asksPermission(message)   — "can I play deadshot?", "is it ok if I take a break?"
 *   grantsPermission(reply)   — "Yes, you can.", "Go for it", "Fine, 10 minutes."
 *   claimsPermission(arg)     — at the gate: "you just said I could play!"
 *   findPermission(turns, …)  — did Synapse actually say yes in the orb recently? Returns the quote.
 *   isBreak(text)             — a break / rest / free time (covers every site), not a specific task.
 */
import type { Turn, GateEvent } from "./brain";

/** Fun / rest words. Deliberately NOT "watch", "video", "go on": "can I watch the chem lecture" isn't leisure. */
const LEISURE = /\b(play|playing|game|games|gaming|break|chill|relax|rest|breather|scroll|scrolling|free time|hang out|have fun|fun|goof off|watch (something|a show|a movie|videos|stuff|tv|netflix|anime)|do whatever|do what i want|do other stuff)\b/i;
const ASKING = /\b(can|could|may|should)\s+i\b|\bam\s+i\s+allowed\b|\bis\s+it\s+(ok|okay|fine|alright|cool)\b|\bmind\s+if\s+i\b|\blet\s+me\b|\bpermission\b|\bi\s+(want|wanna|would like|need)\s+(to\s+)?(play|watch|go|get|hop|take|a)\b|\bcan\s+we\b/i;

/** They're asking the orb whether they may do something fun / go on a distracting site. */
export function asksPermission(message: string, siteWords: string[] = []): boolean {
  const m = message.toLowerCase();
  if (!ASKING.test(m)) return false;
  return LEISURE.test(m) || mentionsSite(m, siteWords);
}

function mentionsSite(m: string, siteWords: string[]) {
  return siteWords.some((w) => w.length > 2 && new RegExp(`\\b${esc(w.toLowerCase())}\\b`, "i").test(m));
}

const NO_START = /^\s*(no\b|nope|nah|not\s+(yet|now|right now|today)|hold on|hold up|wait\b|i'?d\s+(rather|say no)|i\s+wouldn'?t|let'?s\s+not|finish|first\b|why\b)/i;
const YES_START = /^\s*(yes|yeah|yep|yup|ya\b|sure|ok(ay)?\b|alright|all right|fine\b|fair\b|deal\b|sounds good|go\s+for\s+it|go\s+ahead|of\s+course|absolutely|definitely|totally|enjoy|have\s+fun|you'?ve\s+earned\s+(it|this|a break))/i;
const YES_PHRASE = /\b(yes,?\s+you\s+(can|may)|you\s+(can|may)\s+(play|go|watch|have|take|hop|get|do\s+(it|that|whatever))|go\s+for\s+it|go\s+ahead|you'?re\s+(good|cleared|free)\s+to|enjoy\s+(it|your|the|yourself)|have\s+fun|take\s+(a|the|your)\s+(\d+[- ]?min(ute)?\s+)?break|you'?ve\s+earned\s+(it|this|a break))\b/i;
const LATER = /\b(first|after(wards)?|once\s+you|later|not\s+yet|not\s+now|until|when\s+you'?re\s+done|tonight|tomorrow)\b/i;
const REFUSAL = /\b(you\s+can'?t|you\s+cannot|can\s?not\s+play|the\s+answer\s+is\s+no|i'?m\s+not\s+(going\s+to|gonna)\s+(say\s+yes|let)|not\s+a\s+good\s+idea|i'?d\s+hold\s+off)\b/i;

/** The orb's reply says yes, now (not "after you finish", not "no"). */
export function grantsPermission(reply: string): boolean {
  const r = reply.replace(/\[\[[\s\S]*?\]\]/g, "").trim();
  if (!r || NO_START.test(r) || REFUSAL.test(r)) return false;
  if (YES_START.test(r)) {
    // "Yeah, take 15 minutes, then back to the lab report after." — the "after" is about coming back.
    const head = r.slice(0, 50);
    return !LATER.test(head) || YES_PHRASE.test(head) || /\b\d{1,3}\s*(min|mins|minutes)\b/i.test(head);
  }
  const m = YES_PHRASE.exec(r);
  if (!m) return false;
  // "Finish the FRQ first, then you can play" is a no-for-now. "If you're clear, then yes, you can" is a yes.
  const before = r.slice(Math.max(0, m.index - 60), m.index);
  return !LATER.test(before);
}

/**
 * At the gate: "you said I could", "u just told me I can play", "you literally said yes", "you let me earlier".
 * NOT: "could you let me watch the lecture?", "like you said, I've been working", "you told me to take breaks".
 */
export function claimsPermission(argument: string): boolean {
  const a = argument.toLowerCase().replace(/[’']/g, "'");
  if (/\b(can|could|would|will|pls|please)\s+(you|u)\s+(just\s+)?let\s+me\b/.test(a) && !/\b(you|u)\s+(already|just)\s+(said|let)\b/.test(a)) return false;
  return /\b(you|u|ya|synapse)\s+(just\s+|literally\s+|already\s+|even\s+|did\s+|clearly\s+)?(said|say|told\s+me)\s*,?\s*(that\s+)?(i\s+(can|could|may|was allowed|am allowed)|yes|ok|okay|it'?s\s+(ok|okay|fine)|i\s+should\s+(play|take))/.test(a)
    || /\b(you|u|synapse)\s+(just\s+|literally\s+|already\s+|even\s+)?(let me|gave me|allowed( me)?|approved( it)?|ok'?d( it)?|okayed( it)?|agreed|promised)\b(?!\s+(watch|play|go|have|use|take)\b[^.?!]*\?)/.test(a)
    || /\byou\s+said\s+(yes|i\s+(can|could))\b/.test(a);
}

/**
 * A minutes number for the permission ("take 10", "for 20 minutes", "15 min"), skipping numbers that
 * describe work done ("you've worked 50 min", "3 hours 48 minutes deep").
 */
export function permissionMinutes(...texts: string[]): number | null {
  for (const t of texts) {
    const take = /\b(?:take|have|get|grab|enjoy|play\s+for|watch\s+for|for)\s+(?:like\s+|about\s+|another\s+|a\s+)?(\d{1,3})\b(?!\s*(?:hours?|hrs?|h\b|%))/i.exec(t);
    if (take && !/\b(worked|working|been|studied|spent)\s+(for\s+)?$/i.test(t.slice(Math.max(0, take.index - 20), take.index + 4))) {
      const n = parseInt(take[1], 10); if (n > 0) return n;
    }
    for (const m of t.matchAll(/(\d{1,3})\s*(?:more\s+)?(?:min|mins|minutes)\b/gi)) {
      const before = t.slice(Math.max(0, m.index! - 30), m.index!);
      const after = t.slice(m.index! + m[0].length, m.index! + m[0].length + 25);
      if (/\b(worked|working|been|studied|studying|spent|deep|in|at it|straight|solid)\b[^.!?]*$/i.test(before) && !/\b(take|for|have|get)\s*$/i.test(before)) continue;
      if (/^\s*(since|ago|of\s+(work|studying|focus)|deep|today|this\s+session|straight|in\b)/i.test(after)) continue;
      const n = parseInt(m[1], 10); if (n > 0) return n;
    }
  }
  return null;
}

const BREAK_WORDS = /\b(break|rest|breather|recharge|decompress|unwind|relax|chill|free time|fried|exhausted|tired|burn(ed|t)? out|brain is (dead|mush|fried)|need a minute|clear my head|do other stuff|do whatever|done (for|with) (today|the day|tonight|school|studying|homework))\b/i;
const TASK_WORDS = /\b(lecture|tutorial|lesson|for (class|school|my class|homework|hw|my assignment|the assignment|a project|my project|research)|assignment|assigned|teacher|professor|need (it|this) (for|to)|to (learn|study|research)|reply to|message (my|the)|group chat about|instructions|lo-?fi|study music|focus music|music (to|while i'?m?|for) (focus|study|studying|work|working))\b/i;

/** A break / rest / free time — which should cover every distracting site, not one. */
export function isBreak(text: string): boolean {
  return BREAK_WORDS.test(text) && !TASK_WORDS.test(text);
}

/** Which distracting site the question was about — one named site, or "*" (free time) for a break, "games", or several. */
export function permissionSite(message: string, sites: { domain: string; words: string[] }[], anySite: string): string {
  if (isBreak(message)) return anySite;
  const m = message.toLowerCase();
  const hits = sites.filter((s) => s.words.some((w) => w.length > 2 && new RegExp(`\\b${esc(w.toLowerCase())}\\b`).test(m)));
  const domains = [...new Set(hits.map((h) => h.domain))];
  return domains.length === 1 ? domains[0] : anySite;
}

/**
 * The permission request a yes answers: the message right before it, or — when Synapse asked a
 * follow-up first ("How long have you worked?" → "an hour" → "Okay, go for it") — the request a few
 * turns back. Returns the request text, or null if the yes wasn't answering a request.
 */
export function requestBefore(turns: Turn[], replyIndex: number, siteWords: string[], withinMs = 15 * 60_000): Turn | null {
  const reply = turns[replyIndex];
  let users = 0;
  for (let j = replyIndex - 1; j >= 0 && users < 3; j--) {
    const t = turns[j];
    if (reply.ts - t.ts > withinMs) break;
    if (t.surface === "gate") continue;
    // Only reach back past Synapse's own follow-up QUESTIONS. Anything else means that earlier request was already answered.
    if (t.role !== "user") { if (!/\?\s*$/.test(t.text.trim())) return null; continue; }
    users++;
    if (asksPermission(t.text, siteWords)) return t;
  }
  return null;
}

export interface FoundPermission { userText: string; reply: string; ts: number; site: string }

/**
 * Look back through the orb conversation for a yes Synapse gave that covers `site`. A yes that was
 * already turned into a pass (and used up) doesn't count again.
 */
export function findPermission(o: {
  turns: Turn[]; gateLog: GateEvent[]; site: string; now: number; withinMs?: number;
  siteOf: (message: string) => string; anySite: string; siteWords: string[];
}): FoundPermission | null {
  const since = o.now - (o.withinMs ?? 60 * 60_000);
  const turns = o.turns;
  for (let i = turns.length - 1; i >= 0; i--) {
    const reply = turns[i];
    if (reply.ts < since) break;
    if (reply.role !== "synapse" || reply.surface === "gate" || !grantsPermission(reply.text)) continue;
    const ask = requestBefore(turns, i, o.siteWords);
    if (!ask) continue;
    const covered = o.siteOf(ask.text);
    if (covered !== o.anySite && covered !== o.site) continue;
    const used = o.gateLog.some((e) => (e.kind === "pass" || e.kind === "extended") && e.ts >= ask.ts && (e.site === covered || e.site === o.anySite || e.site === o.site));
    if (used) return null;          // that yes already became a pass, and it's over
    return { userText: ask.text, reply: reply.text, ts: reply.ts, site: covered };
  }
  return null;
}

/** The last thing Synapse said in the orb recently — quoted when they claim a yes that isn't there. */
export function lastOrbReply(turns: Turn[], now: number, withinMs = 60 * 60_000): Turn | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (now - t.ts > withinMs) break;
    if (t.role === "synapse" && t.surface !== "gate") return t;
  }
  return null;
}

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
