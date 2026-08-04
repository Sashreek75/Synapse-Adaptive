/**
 * THE EVIDENCE ENGINE — the difference between advice and JUSTIFIED advice.
 *
 * A mentor shouldn't merely be right; they should be able to prove why. This layer turns everything
 * Synapse already tracks (promises kept and broken, when focus actually sticks, which strategies win
 * or fail, goal drift, principles, check-in consistency) into concrete, cited evidence ABOUT THIS
 * PERSON — not research, not generic productivity advice — so that every recommendation can answer
 * "why this, why now, and what would change my mind."
 *
 * It also grades that evidence on a ladder (L1 general reasoning → L5 long-term pattern) so Synapse's
 * confidence comes from evidence, not tone: tentative when we've never tried something, certain when
 * the same thing has worked six times. Behavioral layer only: pure reads over the existing stores.
 */

import { loadCommitments } from "@/lib/commitments";
import { loadHistory, type FocusRecord } from "@/lib/focus-session";
import { winningStrategies, failedStrategies } from "@/lib/decisions";
import { loadPrinciples } from "@/lib/principles";
import { activeGoals, daysSinceProgress } from "@/lib/goals";
import { computeStreak } from "@/lib/intelligence";
import type { CheckIn } from "@/components/providers/health-store";

export type EvidenceLevel = 1 | 2 | 3 | 4 | 5;

export interface EvidenceItem {
  level: EvidenceLevel;   // strength on the ladder
  text: string;           // a plain, specific, citable statement about this person
}

const NL = String.fromCharCode(10);
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

/* ── Time-of-day: when does deep work actually stick for this person? ─────────────────────── */
function focusTimeEvidence(hist: FocusRecord[]): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  const morning = hist.filter((h) => new Date(h.at).getHours() < 12);
  const late = hist.filter((h) => new Date(h.at).getHours() >= 21);
  const rate = (arr: FocusRecord[]) => ({ done: arr.filter((a) => a.completed).length, n: arr.length });
  const m = rate(morning); const l = rate(late);
  // Only claim a pattern once there's enough of one to mean something.
  if (m.n >= 3) {
    const lvl: EvidenceLevel = m.n >= 6 ? 5 : 4;
    out.push({ level: lvl, text: `Morning focus sessions succeed for you: ${m.done} of ${m.n} completed (${pct(m.done, m.n)}%).` });
  }
  if (l.n >= 3) {
    const lvl: EvidenceLevel = l.n >= 6 ? 5 : 4;
    out.push({ level: lvl, text: `Late-night sessions (after 9pm) tend to fail: only ${l.done} of ${l.n} completed (${pct(l.done, l.n)}%).` });
  }
  return out;
}

/* ── Promises: how reliably does this person do what they said? ───────────────────────────── */
function commitmentEvidence(): EvidenceItem[] {
  const resolved = loadCommitments().filter((c) => c.status !== "open" && c.status !== "replaced");
  if (resolved.length < 2) return [];
  const kept = resolved.filter((c) => c.status === "done").length;
  const lvl: EvidenceLevel = resolved.length >= 6 ? 5 : resolved.length >= 4 ? 4 : 3;
  return [{ level: lvl, text: `You've followed through on ${kept} of the last ${resolved.length} promises we've made (${pct(kept, resolved.length)}%).` }];
}

/* ── Strategies: what has repeatedly worked or failed for THIS person? ─────────────────────── */
function strategyEvidence(): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  const win = winningStrategies()[0];
  if (win && win.total >= 3) out.push({ level: win.total >= 5 ? 5 : 4, text: `"${win.text}" keeps working for you — ${win.worked} of ${win.total} times.` });
  const fail = failedStrategies()[0];
  if (fail && fail.total >= 3) out.push({ level: fail.total >= 5 ? 5 : 4, text: `"${fail.text}" has repeatedly failed — ${fail.failed} of ${fail.total} times. Don't force it again without a real reason.` });
  return out;
}

/* ── Goals: priority + drift as timing evidence ───────────────────────────────────────────── */
function goalEvidence(): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const g of activeGoals().slice(0, 3)) {
    const d = daysSinceProgress(g);
    if (g.priority === "primary") out.push({ level: 2, text: `Your top-priority goal right now is "${g.title}".` });
    if (d != null && d >= 4) out.push({ level: 3, text: `No progress logged on "${g.title}" for ${d} days.` });
  }
  return out;
}

function principleEvidence(): EvidenceItem[] {
  return loadPrinciples().slice(-2).map((p) => ({ level: 2 as EvidenceLevel, text: `A principle we've established together: ${p.text}` }));
}

function checkinEvidence(checkIns: CheckIn[]): EvidenceItem[] {
  const s = computeStreak(checkIns);
  if (s.currentStreak >= 3) return [{ level: 3, text: `You've checked in ${s.currentStreak} days running.` }];
  return [];
}

/** Everything Synapse can honestly cite about this person right now, strongest evidence first. */
export function gatherEvidence(checkIns: CheckIn[]): EvidenceItem[] {
  const hist = loadHistory();
  const items = [
    ...focusTimeEvidence(hist),
    ...commitmentEvidence(),
    ...strategyEvidence(),
    ...goalEvidence(),
    ...principleEvidence(),
    ...checkinEvidence(checkIns),
  ];
  return items.sort((a, b) => b.level - a.level);
}

/** The highest rung of the evidence ladder currently available — drives how confident to sound. */
export function evidenceLevel(checkIns: CheckIn[]): EvidenceLevel {
  const items = gatherEvidence(checkIns);
  return (items[0]?.level ?? 1) as EvidenceLevel;
}

const LEVEL_GUIDANCE: Record<EvidenceLevel, string> = {
  1: "You have almost no personal evidence yet — reason from what's universally true, and SAY it's tentative (\"we've never tried this, so this is a starting guess\").",
  2: "You can ground this in things they've told you — reference them, but stay humble; you haven't watched it play out yet.",
  3: "You've observed some behaviour — say \"I've noticed…\" and cite it, with moderate confidence.",
  4: "You have repeated outcomes — say \"we've tried this several times…\" and be confident, citing the count.",
  5: "You have a long-term pattern — be direct and confident (\"this is consistently how you perform\"), and cite it plainly.",
};

/**
 * The block that forces judgment: it hands the model this person's real signals and the Core Rule.
 * Injected into every conversation so recommendations are grounded, cited, and confidence-calibrated.
 */
export function evidenceContextBlock(checkIns: CheckIn[]): string {
  const items = gatherEvidence(checkIns);
  const level = (items[0]?.level ?? 1) as EvidenceLevel;
  const lines: string[] = [];
  lines.push("EVIDENCE ABOUT THIS PERSON — the raw material for judgment. Use it to JUSTIFY, never to decorate:");
  if (items.length) {
    for (const it of items.slice(0, 8)) lines.push(`- [L${it.level}] ${it.text}`);
  } else {
    lines.push("- (none yet — this is a new relationship; reason generally and say so)");
  }
  lines.push(`Your best evidence is level ${level} of 5. ${LEVEL_GUIDANCE[level]}`);
  lines.push("CORRELATION vs UNDERSTANDING: the items above are PATTERNS — what has happened — not explanations of WHY. Cite them as fact, but any claim about the cause (e.g. WHY mornings work) is a HYPOTHESIS: voice it with a confidence level and, when useful, offer to test it together rather than asserting it. Never present a correlation as understanding, and watch for the deeper driver behind the surface pattern.");
  lines.push("THE CORE RULE: never recommend an action without being able to answer, out loud when it helps, WHY THIS (why it's the highest-leverage next move, grounded in the evidence above — not generic advice), WHY NOW (why this moment: energy, a deadline, a dependency, a pattern of avoidance, recovering momentum), and privately WHAT EVIDENCE WOULD CHANGE YOUR MIND (and if it appears, adapt immediately — never defend old advice). Prefer the highest level of evidence available. If you cannot answer why-this and why-now, keep reasoning before you recommend — generic advice is a failure, justified advice is the product.");
  return lines.join(NL);
}
