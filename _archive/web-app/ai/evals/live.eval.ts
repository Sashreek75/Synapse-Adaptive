/**
 * LIVE (MODEL-BACKED) UNDERSTANDING EVAL
 * --------------------------------------
 * The offline suite (npm run eval:understanding) proves the deterministic backbone: classification,
 * mode mapping, and the grounding guard, all with no network. This runner layers the part that
 * only a real model can exercise — it drives the ACTUAL two-pass chat pipeline (comprehend → mode
 * generation → grounding repair) end to end and checks that live replies FOLLOW from the message:
 *   • the right RESPONSE MODE is chosen on real phrasing,
 *   • replies don't invent states / move work to another day (grounding holds on live output),
 *   • MULTI-TURN context accumulates — later turns respect earlier facts and don't contradict them,
 *   • corrections are taken (not re-litigated), and a changed fact is adopted.
 *
 * Needs a Gemini key. It reads .env.local itself (Next isn't running here), and if no key is present
 * it SKIPS cleanly (exit 0) so CI/offline runs are never red for a missing secret.
 *
 * Run:  npm run eval:live
 *
 * Notes:
 *  - server-only modules (pipeline/comprehend/client) are imported dynamically AFTER the key is
 *    loaded, under the `react-server` export condition (see the npm script), so they don't throw.
 *  - Free-tier quota is finite; if the model is unavailable for a turn the pipeline returns a
 *    deterministic fallback. Model-quality assertions are then SKIPPED (not failed); the grounding
 *    assertions still run, because the fallback must be safe too.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { checkGrounding } from "@/ai/grounding";
import { fallbackComprehension } from "@/ai/comprehend-core";
import type { Comprehension, ResponseMode } from "@/ai/schemas";

// ── Load .env.local / .env into process.env BEFORE anything imports env.ts ──
function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
const ROOT = process.cwd();
loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

// ── Scoreboard ──
let pass = 0, fail = 0, skip = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ""}`); }
};
const skipped = (name: string, why: string) => { skip++; console.log(`  ⊘ ${name}  — skipped (${why})`); };

// Build a grounding-check comprehension from the message, overriding the mode the pipeline actually
// chose. checkGrounding keys off the mode + asked-flags + the message/reply text, so this is a
// faithful proxy for "does this reply obey the mode it was answered in".
const groundingFor = (message: string, mode: ResponseMode): Comprehension => ({ ...fallbackComprehension(message), responseMode: mode });

interface Turn {
  msg: string;
  expectModes?: ResponseMode[];   // model-quality assertion (skipped on fallback)
  mustNot?: RegExp;               // reply must NOT contain (checked whenever we have model text)
  must?: RegExp;                  // reply MUST contain
  grounded?: boolean;             // reply must pass the grounding guard for its mode (default true)
}
interface Scenario { name: string; turns: Turn[]; }

const SCENARIOS: Scenario[] = [
  {
    name: "The regression — statement, then a real request (context accumulates)",
    turns: [
      // The exact bug: a bare statement must NOT become "…maybe do them tomorrow morning".
      { msg: "I have two assignments today.", expectModes: ["ACKNOWLEDGE"], mustNot: /\btomorrow\b|energy|here'?s the plan/i },
      // Now they actually ask — advice is licensed, and the reply should be about ordering the two.
      { msg: "Okay — which should I do first?", expectModes: ["RECOMMEND", "CLARIFY"], must: /first|start|earlier|due|order/i },
    ],
  },
  {
    name: "Vent, then ask",
    turns: [
      { msg: "Honestly I'm so overwhelmed right now.", expectModes: ["REFLECT"], mustNot: /here'?s the plan|step 1|1\.\s/i },
      { msg: "What should I actually focus on tonight?", expectModes: ["RECOMMEND", "CLARIFY", "PLAN"] },
    ],
  },
  {
    name: "Correction is taken, not re-litigated",
    turns: [
      { msg: "Should I work on the SAT or the startup tonight?", expectModes: ["RECOMMEND", "CLARIFY"] },
      { msg: "No, that's not what I meant — I only care about the SAT right now.", expectModes: ["CORRECT"], mustNot: /what i meant was|you misunderstood|as i said/i },
    ],
  },
  {
    name: "A changed fact is adopted (consistency across turns)",
    turns: [
      { msg: "My startup demo is this Friday.", expectModes: ["ACKNOWLEDGE"] },
      // The reply should carry the NEW date forward, not keep asserting Friday as the live deadline.
      { msg: "Actually the demo got moved to next Monday.", expectModes: ["ACKNOWLEDGE", "CORRECT"], must: /monday/i },
    ],
  },
];

// ── Runner ──
async function main() {
  const { flags } = await import("@/env");
  if (!flags.aiLive) {
    console.log("\nLIVE EVAL — SKIPPED");
    console.log("No GEMINI_API_KEY found in .env.local (or .env).");
    console.log("The offline suite covers the deterministic backbone:  npm run eval:understanding\n");
    process.exit(0);
  }

  const { answerChat } = await import("@/ai/pipeline");
  const { pingModel } = await import("@/ai/client");

  console.log("\nLIVE UNDERSTANDING EVAL\n=======================");
  const ping = await pingModel();
  if (!ping.ok) {
    console.log(`\n⚠  Model reachable check failed (${(ping as { hint?: string }).hint ?? "see above"}).`);
    console.log("   Likely free-tier quota for today — replies will fall back deterministically.");
  } else {
    console.log(`Model OK: ${(ping as { model?: string }).model ?? "?"}`);
  }

  for (const sc of SCENARIOS) {
    console.log(`\n▸ ${sc.name}`);
    let transcript = "";
    for (const [i, turn] of sc.turns.entries()) {
      const res = await answerChat(turn.msg, transcript.trim());
      const mode = (res.mode ?? "ACKNOWLEDGE") as ResponseMode;
      const live = res.source === "model";
      const label = `T${i + 1} “${turn.msg.slice(0, 42)}${turn.msg.length > 42 ? "…" : ""}”`;
      console.log(`  · ${label}  [mode=${mode}, source=${res.source}]`);

      // Mode assertion — model quality; only meaningful when the model actually answered.
      if (turn.expectModes) {
        if (!live) skipped(`${label} → mode ∈ {${turn.expectModes.join(", ")}}`, "model unavailable");
        else ok(`${label} → mode ∈ {${turn.expectModes.join(", ")}}`, turn.expectModes.includes(mode), `got ${mode}`);
      }

      // Content assertions — only when we have a genuine model reply to inspect.
      if (turn.mustNot) {
        if (!live) skipped(`${label} → must NOT match ${turn.mustNot}`, "model unavailable");
        else ok(`${label} → reply avoids ${turn.mustNot}`, !turn.mustNot.test(res.text), `reply: ${res.text.slice(0, 90)}`);
      }
      if (turn.must) {
        if (!live) skipped(`${label} → must match ${turn.must}`, "model unavailable");
        else ok(`${label} → reply contains ${turn.must}`, turn.must.test(res.text), `reply: ${res.text.slice(0, 90)}`);
      }

      // Grounding — the safety backstop must hold on live OR fallback output.
      if (turn.grounded !== false && res.text) {
        const g = checkGrounding(turn.msg, res.text, groundingFor(turn.msg, mode));
        ok(`${label} → grounded (no invented state / temporal drift)`, g.ok, g.issues.join(" | "));
      }

      transcript += `\nYou: ${turn.msg}\nSynapse: ${res.text}`;
    }
  }

  console.log(`\n=======================\n${pass} passed, ${fail} failed, ${skip} skipped\n`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => { console.error("live eval crashed:", err); process.exitCode = 1; });
