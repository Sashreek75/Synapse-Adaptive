/**
 * INPUT VALIDATION — a lightweight, dependency-free "does this look like a real answer?" check.
 *
 * Free-text that feeds the reasoning engine (goals, aspirations, check-in answers) is worthless if
 * it's keyboard-mashing or random symbols — worse, it can distort what Synapse infers about a person.
 * These heuristics reject the obvious garbage ("asdfgh", "!!!", "aaaaaa", "1234") while staying lenient
 * enough to let normal, even terse, answers through ("get fit", "gym", "be less anxious").
 *
 * Tuning is deliberately "balanced": we would rather occasionally let a weird-but-real answer pass
 * than block a genuine user. Nothing here should ever run on the live chat box.
 */

export type TextCheck = { ok: boolean; message: string | null };

// Adjacent-key sequences (both directions) used to spot deliberate keyboard runs.
const KEYBOARD_ROWS = [
  "qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890",
];
const KEYBOARD_SEQS = KEYBOARD_ROWS.flatMap((r) => [r, r.split("").reverse().join("")]);

const VOWELS = "aeiouyàáâãäåèéêëìíîïòóôõöùúûü";
const isVowel = (c: string) => VOWELS.includes(c);

/** True when the whole alphanumeric input is one contiguous run of adjacent keys (e.g. "asdf", "qwerty"). */
function isKeyboardRun(s: string): boolean {
  const t = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (t.length < 4) return false;
  return KEYBOARD_SEQS.some((seq) => seq.includes(t));
}

const GIBBERISH = "That looks like random text — tell me in a few real words.";

/**
 * Validate a free-text answer. Empty is treated as "not ok" but yields no message (so a disabled
 * button doesn't shout at someone who simply hasn't typed yet) unless `allowEmpty` is set.
 */
export function validateText(
  raw: string,
  opts: { minLength?: number; allowEmpty?: boolean } = {},
): TextCheck {
  const { minLength = 3, allowEmpty = false } = opts;
  const s = (raw ?? "").trim();

  if (s.length === 0) return { ok: allowEmpty, message: null };
  if (s.length < minLength) return { ok: false, message: "A little more detail helps." };

  const nonSpace = s.replace(/\s/g, "").length;
  const letters = (s.match(/[a-zA-ZÀ-ɏ]/g) || []).length;

  // Must be mostly words, not digits or symbols.
  if (letters === 0) return { ok: false, message: "Please use words, not just numbers or symbols." };
  if (letters / Math.max(1, nonSpace) < 0.5) return { ok: false, message: "Try describing this in words." };

  const alpha = s.toLowerCase().replace(/[^a-zÀ-ɏ]/g, "");

  // A single character repeated ("aaaaaa") or near-zero variety.
  if (alpha.length >= 4 && new Set(alpha).size <= 2) return { ok: false, message: GIBBERISH };

  // Deliberate keyboard runs ("asdf", "qwerty", "zxcvbnm").
  if (isKeyboardRun(s)) return { ok: false, message: "That looks like keyboard mashing — tell me in your own words." };

  // Longer alphabetic strings with no vowels at all are almost always mashing ("sdfghjk").
  if (alpha.length >= 5) {
    const vowels = [...alpha].filter(isVowel).length;
    if (vowels === 0) return { ok: false, message: GIBBERISH };
  }

  // An implausibly long consonant cluster (across the whole string) is mashing ("bcdfghjk").
  if (alpha.length >= 6 && /[^aeiouyÀ-ɏ\s]{6,}/i.test(alpha)) {
    return { ok: false, message: GIBBERISH };
  }

  return { ok: true, message: null };
}

/** Name-specific: letters + spaces + hyphen/apostrophe/period only, still gibberish-checked. */
export function validateName(raw: string): TextCheck {
  const s = (raw ?? "").trim();
  if (s.length === 0) return { ok: false, message: null };
  if (s.length < 2) return { ok: false, message: "That's a little short — what should I call you?" };
  if (!/[a-zA-ZÀ-ɏ]/.test(s)) return { ok: false, message: "Please enter a name using letters." };
  if (/[^a-zA-ZÀ-ɏ\s.'\-]/.test(s)) return { ok: false, message: "A name shouldn't contain numbers or symbols." };
  const g = validateText(s, { minLength: 2 });
  return g.ok ? { ok: true, message: null } : g;
}

/** Convenience for gating: is this value acceptable to submit? */
export const isMeaningful = (raw: string, opts?: { minLength?: number; allowEmpty?: boolean }) =>
  validateText(raw, opts).ok;
