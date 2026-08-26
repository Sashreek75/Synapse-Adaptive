/**
 * REACH-OUT INTENT — when Synapse promises to check in later, it appends a machine-readable tag:
 *   [[reachout: <minutes-from-now> | <the message to send>]]
 * We parse it out of the visible reply, strip the tag, and schedule a real push so the promise is
 * actually kept. Minutes are clamped server-side; here we just extract cleanly.
 */

export interface ReachoutParse { cleaned: string; offer: { minutes: number; message: string } | null }

const MATCH = /\[\[\s*reachout\s*:\s*([0-9]{1,5})\s*(?:\|\s*([^\]]*?))?\s*\]\]/i;
const STRIP = /\[\[\s*reachout\s*:[^\]]*\]\]/gi;

export function extractReachoutOffer(text: string): ReachoutParse {
  const cleaned = (text || "")
    .replace(STRIP, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const m = (text || "").match(MATCH);
  if (!m) return { cleaned, offer: null };
  const minutes = parseInt(m[1], 10);
  if (!Number.isFinite(minutes) || minutes < 1) return { cleaned, offer: null };
  const message = (m[2] || "Checking in — how did it go?").trim();
  return { cleaned, offer: { minutes, message } };
}
