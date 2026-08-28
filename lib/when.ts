/**
 * WHEN — turn a human time phrase ("in 30 min", "at 7:30", "at 6am", "tonight", "tomorrow at noon")
 * into a concrete moment in the user's LOCAL timezone. Deterministic, so user-requested reach-outs
 * ("check on me at 7:30") land exactly when meant, without depending on the model doing time math.
 */

export interface WhenResult { fireAt: Date; label: string }

const MIN = 60_000;

function fmt(d: Date): string {
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  if (sameDay) return `at ${time}`;
  if (isTomorrow) return `tomorrow at ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: "long" })} at ${time}`;
}

/** Build the soonest future Date for a clock time, honoring am/pm or picking the nearest sensible one. */
function clockTime(hourRaw: number, minute: number, ampm: string | null, now: Date, dayHint: 0 | 1 | null): Date | null {
  const at = (h: number, dayOffset: number): Date | null => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, minute, 0, 0);
    return d.getTime() > now.getTime() + 30_000 ? d : null;
  };
  const offsets: number[] = dayHint === 1 ? [1] : dayHint === 0 ? [0] : [0, 1];
  const cands: Date[] = [];
  const add = (h: number) => { for (const o of offsets) { const d = at(h, o); if (d) cands.push(d); } };

  if (ampm === "am") add(hourRaw % 12);
  else if (ampm === "pm") add((hourRaw % 12) + 12);
  else if (hourRaw >= 13 && hourRaw <= 23) add(hourRaw);
  else if (hourRaw === 0 || hourRaw === 24) add(0);
  else { add(hourRaw % 12); add((hourRaw % 12) + 12); } // bare 1–12: consider AM and PM, pick soonest

  cands.sort((a, b) => a.getTime() - b.getTime());
  return cands[0] ?? null;
}

export function parseWhen(text: string, now: Date = new Date()): WhenResult | null {
  const t = (text || "").toLowerCase();

  // Relative: "in 30 minutes", "in 2 hours", "in an hour", "in half an hour"
  let m = t.match(/\bin\s+(\d{1,4})\s*(minutes?|mins?|m|hours?|hrs?|h)\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2][0] === "h" ? 60 : 1;
    if (n > 0) return finalize(new Date(now.getTime() + n * unit * MIN), now);
  }
  if (/\bin\s+half\s+an\s+hour\b/.test(t)) return finalize(new Date(now.getTime() + 30 * MIN), now);
  if (/\bin\s+(an?|one)\s+hours?\b/.test(t)) return finalize(new Date(now.getTime() + 60 * MIN), now);

  const tomorrow = /\btomorrow\b/.test(t);
  const dayHint: 0 | 1 | null = tomorrow ? 1 : null;

  // Named times
  if (/\bnoon\b/.test(t)) { const d = clockTime(12, 0, "pm", now, dayHint); if (d) return finalize(d, now); }
  if (/\bmidnight\b/.test(t)) { const d = clockTime(0, 0, "am", now, dayHint); if (d) return finalize(d, now); }
  if (/\btonight\b/.test(t)) { const d = clockTime(20, 0, "pm", now, null); if (d) return finalize(d, now); }
  if (/\bthis evening\b/.test(t)) { const d = clockTime(19, 0, "pm", now, null); if (d) return finalize(d, now); }
  if (/\b(tomorrow morning|in the morning|this morning)\b/.test(t)) {
    const d = clockTime(8, 0, "am", now, /tomorrow/.test(t) ? 1 : null); if (d) return finalize(d, now);
  }

  // Clock time with am/pm anywhere ("6am", "7:30 pm")
  m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/);
  if (m) {
    const d = clockTime(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0, m[3][0] === "a" ? "am" : "pm", now, dayHint);
    if (d) return finalize(d, now);
  }
  // "at 7:30" / "for 8" / "by 18:00" (no am/pm)
  m = t.match(/\b(?:at|for|by|around)\s+(\d{1,2})(?::(\d{2}))?\b/);
  if (m) {
    const d = clockTime(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0, null, now, dayHint);
    if (d) return finalize(d, now);
  }
  return null;
}

function finalize(d: Date, now: Date): WhenResult {
  // Never schedule in the past or absurdly far out (> 30 days).
  const clamped = new Date(Math.min(Math.max(d.getTime(), now.getTime() + MIN), now.getTime() + 30 * 24 * 60 * MIN));
  return { fireAt: clamped, label: fmt(clamped) };
}

const TRIGGER = /\b(remind me|reminder\b|(?:give me|set|make|create|add|leave me|need|want|schedule)\s+(?:a|an|me a|me an)?\s*reminder|check (in )?(on|up on|with)? ?me|check on me|check in|nudge me|ping me|reach out to me|follow up with me|hold me accountable|wake me|tell me to)\b/i;

/** A user explicitly asking to be checked on at a time → a concrete reach-out to schedule. */
export function detectReachoutRequest(text: string, now: Date = new Date()): { fireAt: Date; label: string; message: string } | null {
  if (!text || !TRIGGER.test(text)) return null;
  const when = parseWhen(text, now);
  if (!when) return null;
  // Try to capture what it's about. Prefer "remind me to X"; else "to X" but skip the filler "to me".
  const tail = /(?:\s+(?:at|by|tonight|tomorrow|this)\b|\s+in\s+\d|[.!?]|$)/i.source;
  const m1 = text.match(new RegExp(`\\bremind me to\\s+(.{2,80}?)${tail}`, "i"));
  const m2 = m1 ? null : text.match(new RegExp(`\\bto\\s+(?!me\\b)(.{2,80}?)${tail}`, "i"));
  const about = (m1?.[1] || m2?.[1] || "").trim().replace(/[.!?]+$/, "");
  const message = about ? `Reminder: ${about}.` : "Checking in — how's it going?";
  return { fireAt: when.fireAt, label: when.label, message };
}
