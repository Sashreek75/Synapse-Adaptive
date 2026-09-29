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
import { reopeningContext, type Recommendation } from "@/lib/decisions";
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

// ── Test 9 — Compound (statement + request) → decision ──
console.log("\nTest 9 — compound statement + request");
ok("‘I have two assignments today. Which should I do first?’ → RECOMMEND", modeOf("I have two assignments today. Which should I do first?") === "RECOMMEND");
ok("‘…which matters more, the SAT or the startup?’ → RECOMMEND", modeOf("Honestly which matters more right now, the SAT or the startup?") === "RECOMMEND");

// ── Test 10 — Decision reopening awareness ──
console.log("\nTest 10 — reopening a prior decision");
{
  const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const calls: Recommendation[] = [
    { id: "r1", at: days(2), text: "protect the SAT this week and let the startup wait", status: "open" },
    { id: "r2", at: days(9), text: "email three professors about the research role", status: "worked" },
  ];
  const reopen = reopeningContext("should i really protect the SAT or push the startup now?", calls);
  ok("detects the user revisiting the SAT-vs-startup call", /REOPENING A DECISION/.test(reopen));
  ok("references the actual prior recommendation text", /protect the SAT/.test(reopen));
  ok("tells the model to reference it, not restart", /Reference the earlier call|hold your position/.test(reopen));
  ok("an unrelated message does NOT trigger reopening", reopeningContext("what should i eat for dinner tonight", calls) === "");
  const failed: Recommendation[] = [{ id: "r3", at: days(3), text: "wake up at 5am to study before school", status: "failed" }];
  ok("a failed prior call is flagged as failed (don't just re-recommend)", /did NOT work last time/.test(reopeningContext("should i try waking up at 5am again to study?", failed)));
}

// ── Test 11 — Correction: take it, don't re-litigate or over-apologize ──
console.log("\nTest 11 — correction is taken, not defended");
{
  const msg = "No, that's not what I meant — I meant the SAT, not the startup.";
  ok("‘No, that's not what I meant…’ → CORRECT", modeOf(msg) === "CORRECT");
  ok("a clean corrected reply PASSES", grounded(msg, "Got it — the SAT, then. Earliest deadline still wins, so I'd give tonight to that.").ok);
  ok("re-stating the old read is REJECTED", !grounded(msg, "What I meant was that the startup deserves your focus tonight.").ok);
  ok("blaming the user for misreading is REJECTED", !grounded(msg, "I think you misunderstood me — I was saying the startup comes first.").ok);
  ok("drowning it in apology is REJECTED", !grounded(msg, "I'm so sorry, my mistake, sorry about that — the SAT it is.").ok);
  ok("a single ‘sorry’ is fine", grounded(msg, "Sorry — the SAT, got it. That's where I'd put tonight.").ok);
}

// ── Test 12 — A decision turn must DECIDE (no hedging) ──
console.log("\nTest 12 — RECOMMEND must commit, not hedge");
{
  const msg = "Should I work on the startup or the SAT tonight?";
  ok("‘startup or SAT tonight?’ → RECOMMEND", modeOf(msg) === "RECOMMEND");
  ok("a committed pick PASSES", grounded(msg, "I'd start with the SAT — its date is fixed and the startup can flex a day.").ok);
  ok("‘it depends / both are important’ is REJECTED", !grounded(msg, "Honestly it depends — both are important, so it's really your call.").ok);
  ok("‘up to you’ with no pick is REJECTED", !grounded(msg, "There's no right answer here; up to you which one you'd rather do.").ok);
  ok("asking the ONE deciding question PASSES", grounded(msg, "Which has the nearer deadline — is the SAT this weekend, or further out? That decides it.").ok);
  ok("a stray ‘it depends’ but a clear pick PASSES", grounded(msg, "It depends a little on your energy, but I'd go with the SAT tonight — fixed date wins.").ok);
}

console.log(`\n==================\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exitCode = 1;
