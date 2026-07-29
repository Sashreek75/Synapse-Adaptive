/**
 * TEACH THE MODEL ONCE — a fading cue that Synapse can drive you around.
 *
 * The companion can take you anywhere ("show me my numbers", "let's reflect", "help me
 * focus") — but that's a hidden superpower until you stumble onto it. We surface a tiny
 * "try saying…" hint until the user has actually used the capability a few times, then it
 * disappears for good. Deterministic, localStorage-backed, no engine involvement.
 */

const KEY = "synapse.navHints.uses";
const LEARNED_AT = 3; // once they've driven themselves around this many times, they know.

export const NAV_HINT_EXAMPLES = [
  "Let's reflect.",
  "Take me to my weekly review.",
  "Show me my numbers.",
  "Help me focus.",
];

export function navHintUses(): number {
  try { return Number(localStorage.getItem(KEY) || 0); } catch { return 0; }
}

export function shouldShowNavHints(): boolean {
  return navHintUses() < LEARNED_AT;
}

/** Call whenever the user successfully asks Synapse to take them somewhere or start a
 * session by talking — that's the capability learned. Fires an event so any open cue fades. */
export function recordNavUse(): void {
  try {
    localStorage.setItem(KEY, String(navHintUses() + 1));
    window.dispatchEvent(new CustomEvent("synapse:navhint"));
  } catch {}
}
