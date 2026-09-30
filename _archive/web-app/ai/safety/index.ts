/**
 * SAFETY LAYER  (founding doc §3.4, §7.6)
 * ---------------------------------------
 * Wraps every model interaction. Three responsibilities:
 *   1. PRE-GATE  — crisis / red-flag detection on user input (runs BEFORE the
 *      analytical agent; if triggered, we escalate and never analyze).
 *   2. CONSTRAINTS — the non-negotiable system rules injected into every prompt.
 *   3. POST-GATE — claim checker that scans output for advice-like / device-like
 *      language and repairs or blocks it.
 *
 * Patterns + constraints are versioned config so claims can be tightened
 * without redeploying app logic.
 */

export const SAFETY_VERSION = "safety.v1";

/** Injected into every system prompt. The product's "stay in our lane" rules. */
export const SAFETY_CONSTRAINTS = `
HARD RULES (never break, regardless of how a question is phrased):
- You provide general wellness education and observations about the user's own
  self-reported data. You do NOT diagnose, name conditions, predict disease
  course, recommend or adjust treatment, suggest medications or dosing, or triage.
- Never say "you have", "this means you are developing", "you should take/stop".
- Always separate (a) observations about the user's data, (b) general education,
  and (c) what to discuss with their healthcare provider.
- Communicate uncertainty honestly. Prefer "worth keeping an eye on" to overclaiming.
- The healthcare provider is the decision-maker for anything medical.
- Stay calm and supportive. Never use alarming or urgent framing about health.
`.trim();

/** Crisis signals — pre-gate. Conservative by design. */
const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill myself|suicid|end my life|don'?t want to (be alive|live)|self[-\s]?harm|hurt myself)\b/i,
  /\b(can'?t go on|want to die|better off dead)\b/i,
  /\b(chest pain|can'?t breathe|trouble breathing|face drooping|slurred speech|sudden numbness|worst headache of my life|stroke)\b/i,
  /\b(overdose|took too many|too many pills)\b/i,
];

/**
 * Output patterns that would cross from education into medical advice.
 * IMPORTANT: these must be PRECISE. Broad patterns like "you have" or "you should
 * start" wrongly flag ordinary, useful coaching ("you have been sleeping better",
 * "you should start winding down earlier") — and a flagged answer is discarded
 * entirely, which makes Synapse look like it ignored the question. So each pattern
 * targets genuinely out-of-lane content: dosing, medication changes, prescribing,
 * naming a diagnosis, or false certainty.
 */
const PROHIBITED_OUTPUT_PATTERNS: RegExp[] = [
  /\b\d+\s?mg\b/i,                                   // explicit dosing, e.g. "50 mg"
  /\bdose of \d/i,
  /\b(increase|decrease|double|halve|adjust|change|stop|start|skip)\s+(your |the |taking )?(medication|meds|dose|dosage|prescription|pills?)\b/i,
  /\bprescrib(e|ing)\b/i,                            // acting as a prescriber
  /\byou (?:have|'ve got|are developing|likely have|probably have)\s+(?:a |an )?(?:depression|anxiety disorder|adhd|bipolar|ptsd|a concussion|concussion|diabetes|cancer|a tumou?r|tumou?rs?|a disorder|disorder|a disease|disease|an illness|illness|a condition|condition)\b/i,
  /\b(this is|it'?s) (definitely|certainly|clearly) (a |an )?(depression|anxiety|adhd|concussion|diagnosis|disorder|disease|condition)\b/i,
];

export interface CrisisResult {
  triggered: boolean;
  message?: string;
}

export const CRISIS_RESPONSE = `
I want to pause our usual check-in for a moment, because what you wrote sounds
really important.

I'm not able to help with a medical or safety emergency, but people who can are
available right now. If you might be in danger or thinking about harming yourself,
please reach out to your local emergency number, or a crisis line in your region
(for example, in the US you can call or text 988). If this feels like a medical
emergency, please contact emergency services.

You don't have to go through this alone, and reaching out is a strong thing to do.
`.trim();

/** PRE-GATE: scan user free-text for crisis signals. */
export function preGate(userText: string): CrisisResult {
  const hit = CRISIS_PATTERNS.some((re) => re.test(userText));
  return hit ? { triggered: true, message: CRISIS_RESPONSE } : { triggered: false };
}

export interface PostGateResult {
  ok: boolean;
  violations: string[];
}

/** POST-GATE: ensure model output stays within the wellness/education lane. */
export function postGate(output: string): PostGateResult {
  const violations: string[] = [];
  for (const re of PROHIBITED_OUTPUT_PATTERNS) {
    if (re.test(output)) violations.push(re.source);
  }
  return { ok: violations.length === 0, violations };
}
