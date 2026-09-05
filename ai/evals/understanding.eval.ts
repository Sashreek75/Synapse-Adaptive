/**
 * UNDERSTANDING EVAL — the deterministic backbone of the intelligence overhaul's test suite.
 * Runnable offline (no model/key): exercises comprehension classification, mode mapping, and the
 * grounding guard against the 10 scenarios from the brief — including the exact regression:
 * "I have two assignments today." must NOT be turned into "…maybe do them tomorrow morning."
 *
 * Run:  npx tsx ai/evals/understanding.eval.ts
 * (A separate model-backed runner can layer full end-to-end checks on top when a key is present.)
 */

import { fallbackComprehension } from "@/ai/comprehend-core";
import { buildTurnBrief } from "@/ai/modes";
import { checkGrounding } from "@/ai/grounding";
import type { ResponseMode } from "@/ai/schemas";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ""}`); }
};
const modeOf = (msg: string): ResponseMode => fallbackComprehension(msg).responseMode;
const grounded = (msg: string, reply: string) => {
  const c = fallbackComprehension(msg);
  return checkGrounding(msg, reply, c);
};

console.log("\nUNDERSTANDING EVAL\n==================");

// ── Test 1 — Simple statement: do NOT invent exhaustion / tomorrow / a plan ──
console.log("\nTest 1 — simple statement");
ok("‘I have two assignments today.’ → ACKNOWLEDGE", modeOf("I have two assignments today.") === "ACKNOWLEDGE");
{
  const bad = "Focus on those right now, and if you don't have the energy to do them, let's figure out a plan to do them tomorrow morning.";
  const r = grounded("I have two assignments today.", bad);
  ok("the original bad reply is REJECTED by grounding", !r.ok, r.issues.join(" | "));
  ok("  → flags invented energy state", r.issues.some((i) => /energy/i.test(i)));
  ok("  → flags moving work to tomorrow", r.issues.some((i) => /tomorrow/i.test(i)));
  ok("  → flags unrequested plan", r.issues.some((i) => /advice|plan|next step/i.test(i)));
  const good = "Got it — two assignments due today.";
  ok("a plain acknowledgement PASSES grounding", grounded("I have two assignments today.", good).ok);
  const goodOffer = "Got it — two assignments today. Want to think through the order together, or just noting it?";
  ok("acknowledgement + one optional offer PASSES", grounded("I have two assignments today.", goodOffer).ok);
}

// ── Test 2 — Statement + a real request → decision reasoning ──
console.log("\nTest 2 — actual request");
ok("‘…Which should I do first?’ → RECOMMEND", modeOf("I have two assignments today. Which should I do first?") === "RECOMMEND");
ok("a recommendation reply is ALLOWED to advise", grounded("I have two assignments today. Which should I do first?", "I'd start with the one due earliest, then the other.").ok);

// ── Test 3 — Context accumulation (deterministic pieces) ──
console.log("\nTest 3 — context accumulation");
ok("‘My startup deadline is Friday.’ → ACKNOWLEDGE (a fact, not a request)", modeOf("My startup deadline is Friday.") === "ACKNOWLEDGE");
ok("‘I only have three hours tonight.’ → ACKNOWLEDGE", modeOf("I only have three hours tonight.") === "ACKNOWLEDGE");
console.log("    (full 3-turn integration is covered by the model-backed runner)");

// ── Test 4 — Correction updates understanding ──
console.log("\nTest 4 — correction");
ok("‘Actually, I can't do the startup task because I'm waiting on someone.’ → CORRECT", modeOf("Actually, I can't do the startup task because I'm waiting on someone.") === "CORRECT");
ok("‘No, that's not what I meant.’ → CORRECT", modeOf("No, that's not what I meant.") === "CORRECT");

// ── Test 5 — Decision → concrete recommendation ──
console.log("\nTest 5 — decision");
ok("‘Should I work on the startup or SAT tonight?’ → RECOMMEND", modeOf("Should I work on the startup or SAT tonight?") === "RECOMMEND");
ok("a RECOMMEND reply may suggest resting/deferring without being flagged", grounded("Should I work on the startup or SAT tonight?", "Honestly, I'd rest tonight and hit the startup tomorrow — the deadline's still days out.").ok);

// ── Test 6 — Ambiguity (classification; CLARIFY escalation is model-driven) ──
console.log("\nTest 6 — ambiguity");
ok("a bare ‘which tonight, SAT or startup?’ routes to a decision path", ["RECOMMEND", "CLARIFY"].includes(modeOf("Which should I do tonight, SAT or startup?")));

// ── Test 7 — No question → no manufactured coaching ──
console.log("\nTest 7 — no question");
ok("‘I studied for three hours today.’ → ACKNOWLEDGE", modeOf("I studied for three hours today.") === "ACKNOWLEDGE");
ok("an advice-y reply to a statement is REJECTED", !grounded("I studied for three hours today.", "You should keep that momentum — here's what to do next: 1. plan tomorrow 2. rest.").ok);

// ── Test 8 — Contradiction (field plumbing; detection is model-driven) ──
console.log("\nTest 8 — contradiction");
ok("comprehension carries a contradictions array", Array.isArray(fallbackComprehension("But I already finished that.").contradictions));

// ── Venting → REFLECT, and no prescribing ──
console.log("\nExtra — venting");
ok("‘I'm so overwhelmed right now.’ → REFLECT", modeOf("I'm so overwhelmed right now.") === "REFLECT");
ok("‘overwhelmed’ is allowed in the reply because THEY said it", grounded("I'm so overwhelmed right now.", "That sounds genuinely overwhelming.").ok);
ok("but a prescriptive plan back to a vent is REJECTED", !grounded("I'm so overwhelmed right now.", "Here's the plan: 1. list everything 2. do the first one now.").ok);

// ── buildTurnBrief wiring ──
console.log("\nWiring — turn brief");
{
  const brief = buildTurnBrief(fallbackComprehension("I have two assignments today."));
  ok("brief states RESPONSE MODE: ACKNOWLEDGE", /RESPONSE MODE: ACKNOWLEDGE/.test(brief));
  ok("brief carries the grounding hard-rule", /GROUNDING \(hard rule/.test(brief));
  ok("brief marks it as a statement, not a request", /statement, not a request/.test(brief));
}

console.log(`\n==================\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exitCode = 1;
