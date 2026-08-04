/**
 * DECISION QUALITY — calibrating the challenge to the person, from evidence.
 *
 * The default failure mode of an assistant is "they're tired, make it easier" — which quietly trains
 * people to lower the bar every time life gets hard. A great coach does something else: it decides
 * whether to PUSH, MAINTAIN, SIMPLIFY, or PROTECT based on who the person is trying to become and what
 * they've actually PROVEN they can do. This reads existing behavioural signals — commitments kept vs.
 * dropped, focus sessions finished, whether acting on a next move actually worked — and hands the model
 * that evidence plus an honestly-uncertain stance, so it earns the right to push by watching what works
 * rather than hard-coding toughness.
 *
 * Read-only over the commitment/goal/focus stores. Touches no engine.
 */
import { loadCommitments } from "@/lib/commitments";
import { activeGoals } from "@/lib/goals";
import { loadHistory } from "@/lib/focus-session";

export function challengeContextBlock(): string {
  const nl = String.fromCharCode(10);

  // Commitment follow-through (their promises to themselves).
  const resolved = loadCommitments().filter((c) => c.status === "done" || c.status === "partial" || c.status === "dropped");
  const recent = resolved.slice(-12);
  const done = recent.filter((c) => c.status === "done").length;
  const partial = recent.filter((c) => c.status === "partial").length;
  const dropped = recent.filter((c) => c.status === "dropped").length;
  const followRate = recent.length ? (done + 0.5 * partial) / recent.length : null;

  // Focus sessions finished.
  let sessions = 0, sessionsDone = 0;
  try { const h = loadHistory(); sessions = h.length; sessionsDone = h.filter((x) => x.completed).length; } catch {}

  // Did acting on a next move actually work (their own report)?
  const goals = activeGoals();
  const outs = goals.flatMap((g) => g.outcomes || []);
  const oYes = outs.filter((o) => o.worked === "yes").length;
  const oNo = outs.filter((o) => o.worked === "no").length;
  const ambitious = goals.some((g) => g.priority === "primary" || g.priority === "high");

  if (recent.length === 0 && sessions === 0 && outs.length === 0) return "";

  const facts: string[] = [];
  if (recent.length) facts.push(`Their own commitments: kept ${done}, partial ${partial}, dropped ${dropped} of the last ${recent.length}.`);
  if (sessions) facts.push(`Focus sessions: finished ${sessionsDone} of ${sessions}.`);
  if (outs.length) facts.push(`When they acted on a next move it worked ${oYes}x and fell flat ${oNo}x (their report).`);

  let stance: string;
  if (followRate == null) {
    stance = "You don't yet have enough evidence of how much challenge helps them. Match today honestly and WATCH what works — earn the right to push by seeing that it leads to follow-through, not misses.";
  } else if (followRate >= 0.7) {
    stance = `They have been following through (${Math.round(followRate * 100)}%). When today's obstacle is DISCOMFORT rather than real incapability, hold the higher bar — they've earned a push and proven they can take it${ambitious ? ", and they said their ambition matters more than comfort" : ""}. Don't reflexively max out; if signals point to genuine overload, protect recovery instead.`;
  } else if (followRate < 0.45) {
    stance = "They've been dropping commitments — pushing harder has NOT been landing. Recalibrate: shrink the scope, rebuild one small streak, or protect recovery. Earn the harder ask back once follow-through returns.";
  } else {
    stance = "Follow-through is mixed. Read today specifically: push when it's discomfort and they have reserves, ease when the plan is genuinely too big — and keep learning which actually works for this person.";
  }

  return [
    "CALIBRATE THE CHALLENGE (decide push / maintain / simplify / protect from EVIDENCE, not from what's easiest). Is today's obstacle capability or just discomfort?",
    ...facts.map((f) => "- " + f),
    "- STANCE: " + stance,
  ].join(nl);
}
