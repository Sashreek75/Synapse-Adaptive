/**
 * AFFIRMATION — read short replies the way a human would, typos and all.
 *
 * A decision partner must never be tripped up by "eys" or "k". When the user's message is a terse
 * yes/no to whatever Synapse just said, we classify it (fuzzily) and tell the model to ACT on its
 * previous offer instead of re-asking — the #1 cause of "it just repeated itself."
 */

export type Reply = "affirm" | "deny" | null;

const AFFIRM = ["yes", "yep", "yeah", "yup", "ya", "yah", "yeh", "ye", "yah", "yess", "yatta", "sure", "ok", "okay", "okey", "k", "kk", "aye", "affirmative", "absolutely", "definitely", "certainly", "please", "yesplease", "gotcha", "word", "bet", "fine", "alright", "aight"];
const DENY = ["no", "nope", "nah", "naw", "nay", "never", "dont", "stop", "skip", "pass", "cancel", "nvm", "nevermind"];
const AFFIRM_PHRASES = ["do it", "go for it", "lets do it", "let's do it", "sounds good", "go ahead", "please do", "yes please", "for sure", "why not", "make it happen", "lets go", "let's go", "sign me up"];
const DENY_PHRASES = ["no thanks", "not now", "not really", "maybe later", "some other time", "no thank you", "i'm good", "im good", "leave it"];

/** Damerau/OSA distance — counts an adjacent transposition ("eys"→"yes") as a single edit. */
function osa(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const d = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

/** Allow one typo/transposition for words length>=3 (so "eys"~"yes", "suer"~"sure"); exact for very short. */
function fuzzyIn(token: string, dict: string[]): boolean {
  for (const w of dict) {
    if (token === w) return true;
    if (w.length >= 3 && Math.abs(token.length - w.length) <= 1 && osa(token, w) <= 1) return true;
  }
  return false;
}

/** Classify a SHORT reply as affirmation / denial / neither. Longer messages return null (they carry
 * their own meaning and should go to the model normally). */
export function classifyReply(text: string): Reply {
  const raw = (text || "").toLowerCase().trim().replace(/[^a-z'\s]/g, "").trim();
  if (!raw) return null;
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length > 4) return null; // too long to be a bare yes/no

  if (AFFIRM_PHRASES.some((p) => raw === p || raw.startsWith(p + " "))) return "affirm";
  if (DENY_PHRASES.some((p) => raw === p || raw.startsWith(p + " "))) return "deny";

  // Single decisive token dominates ("yes", "eys", "nope"). Guard by first letter so the yes- and
  // no-families never fuzzy-bleed into each other ("nah" must not match "yah").
  if (words.length <= 2) {
    const denyHit = words.some((w) => w[0] !== "y" && fuzzyIn(w, DENY));
    const affirmHit = words.some((w) => w[0] !== "n" && fuzzyIn(w, AFFIRM));
    if (denyHit && !affirmHit) return "deny";
    if (affirmHit && !denyHit) return "affirm";
  }
  return null;
}
