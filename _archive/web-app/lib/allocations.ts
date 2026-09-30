/**
 * ALLOCATION DECISIONS — Synapse's record of its OWN prioritization calls.
 *
 * decisions.ts remembers ADVICE ("did waking at 6am work?"). This remembers the deeper thing a
 * partner is accountable for: "what did I decide deserved this week, why, how sure was I, and what
 * would have changed my mind." That lets Synapse (a) stay consistent and change its mind OUT LOUD
 * when the situation shifts ("last week I'd have protected the SAT; you've caught up, so I'd shift"),
 * (b) later judge whether the CALL was good — separately from whether the person executed it — and
 * (c) over time notice its own judgment patterns ("I keep overestimating deadlines").
 *
 * A plain client-side ledger, decoupled from every engine. No new engine, no server, no schema on
 * the frozen machinery. decisions.ts is left untouched — it cannot represent chosen-vs-parked,
 * confidence, or a reversal condition, which is exactly why this is a sibling store.
 */

export type AllocConfidence = "low" | "moderate" | "high";
/** DECISION quality — was the CALL good given what we knew, independent of whether they executed it. */
export type AllocAssessment = "supported" | "mixed" | "wrong" | "unclear";
/** EXECUTION quality — did the protected goals actually move after the call. Auto-derived from
 * goal progress, deliberately kept SEPARATE from decision quality (invariant 6). */
export type ExecRead = "moved" | "partial" | "stalled" | "unknown";

export interface AllocGoalRef { id: string; title: string; momentum?: string; dueInDays?: number | null }

export interface AllocationDecision {
  id: string;
  at: string;
  weekKey: string;                 // the week this allocation is FOR
  protect: string[];               // goalIds — the needle (the marginal attention)
  maintain: string[];              // kept alive with minimum effort — still matters
  park: string[];                  // deliberately set down for now
  watch: string[];                 // close to needing to become the needle
  reasoning: string;               // the note / primary why, in Synapse's own words
  confidence: AllocConfidence;
  reversal?: string;               // the one change that would flip the call
  goals: AllocGoalRef[];           // light snapshot of the field at decision time (for titles + review)
  // Two SEPARATE axes, never conflated: was the call right (decisionQuality), and did they act on it (execution).
  outcome?: { at: string; decisionQuality?: AllocAssessment; execution?: ExecRead; note?: string };
}

const KEY = "synapse.allocations.v1";
const EVT = "synapse:allocations";
const NL = String.fromCharCode(10);
const canStore = () => typeof window !== "undefined" && !!window.localStorage;
const uid = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function loadAllocations(): AllocationDecision[] {
  if (!canStore()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? (raw as AllocationDecision[]).filter((a) => a && Array.isArray(a.protect) && typeof a.weekKey === "string") : [];
  } catch { return []; }
}
function save(list: AllocationDecision[]): void {
  if (!canStore()) return;
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-40))); window.dispatchEvent(new CustomEvent(EVT)); } catch {}
}

const titleFor = (a: AllocationDecision, id: string) => a.goals.find((g) => g.id === id)?.title || id;

export interface RecordAllocationInput {
  weekKey: string;
  protect: string[];
  maintain?: string[];
  park?: string[];
  watch?: string[];
  reasoning?: string;
  confidence?: AllocConfidence;
  reversal?: string;
  goals: AllocGoalRef[];
}

/**
 * Record (or refine) this week's allocation call. The same week is UPDATED in place rather than
 * duplicated — a week has one standing decision that can sharpen as goals change — but its original
 * timestamp and any recorded outcome are preserved. Returns null when the call is empty or unchanged.
 */
export function recordAllocation(input: RecordAllocationInput): AllocationDecision | null {
  if (!input.protect?.length) return null;
  const list = loadAllocations();
  const existing = list.find((a) => a.weekKey === input.weekKey);
  const next: AllocationDecision = {
    id: existing?.id ?? uid(),
    at: existing?.at ?? new Date().toISOString(),
    weekKey: input.weekKey,
    protect: [...input.protect],
    maintain: [...(input.maintain ?? [])],
    park: [...(input.park ?? [])],
    watch: [...(input.watch ?? [])],
    reasoning: (input.reasoning ?? "").trim(),
    confidence: input.confidence ?? "low",
    reversal: input.reversal?.trim() || undefined,
    goals: input.goals,
    outcome: existing?.outcome,
  };
  // No-op if nothing material changed (avoids churn + event spam on re-renders).
  if (existing && sameCall(existing, next)) return existing;
  const rest = list.filter((a) => a.weekKey !== input.weekKey);
  save([...rest, next]);
  return next;
}

function sameCall(a: AllocationDecision, b: AllocationDecision): boolean {
  const eq = (x: string[], y: string[]) => x.length === y.length && x.every((v, i) => v === y[i]);
  return eq(a.protect, b.protect) && eq(a.maintain, b.maintain) && eq(a.park, b.park) &&
    a.reasoning === b.reasoning && a.confidence === b.confidence && (a.reversal || "") === (b.reversal || "");
}

/** Most recent decision by wall-clock. */
export function lastAllocation(): AllocationDecision | null {
  const list = loadAllocations();
  return list.length ? list.slice().sort((a, b) => a.at.localeCompare(b.at))[list.length - 1] : null;
}

/** The most recent decision made for a week EARLIER than `weekKey` — i.e. "last week's call". */
export function priorAllocation(weekKey: string): AllocationDecision | null {
  const earlier = loadAllocations().filter((a) => a.weekKey < weekKey).sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  return earlier.length ? earlier[earlier.length - 1] : null;
}

function patchOutcome(id: string, patch: Partial<NonNullable<AllocationDecision["outcome"]>>): void {
  save(loadAllocations().map((a) => {
    if (a.id !== id) return a;
    const base = a.outcome ?? { at: new Date().toISOString() };
    return { ...a, outcome: { ...base, at: base.at || new Date().toISOString(), ...patch } };
  }));
}

/** Record whether the protected goals actually MOVED after the call (execution quality). Auto-derived,
 * never a judgment of the decision itself. */
export function recordExecution(id: string, execution: ExecRead): void { patchOutcome(id, { execution }); }

/** Record Synapse's judgment of whether the CALL was right given what it knew (decision quality) —
 * set in reflection, separate from execution. */
export function assessAllocationDecision(id: string, quality: AllocAssessment, note?: string): void {
  patchOutcome(id, { decisionQuality: quality, note: note?.trim() || undefined });
}

/** Summarize per-goal movement into an execution read. `unknown` = goals we couldn't check. */
export function summarizeExecution(moved: number, total: number, unknown: number): ExecRead {
  if (total === 0 || unknown >= total) return "unknown";
  const known = total - unknown;
  if (moved >= known && moved > 0) return "moved";
  if (moved > 0) return "partial";
  return "stalled";
}

/**
 * Injected into chat + orb so Synapse can reason about CONTINUITY and SHIFT: it can see the call it
 * last made and either hold to it or change it out loud. Kept short and never shown raw to the user.
 */
export function allocationContextBlock(): string {
  const last = lastAllocation();
  if (!last) return "";
  const lines: string[] = ["YOUR LAST ALLOCATION CALL (stay consistent with it — or change it OUT LOUD if the situation actually shifted; do not silently contradict yourself):"];
  if (last.protect.length) lines.push(`- You chose to PROTECT: ${last.protect.map((id) => titleFor(last, id)).join("; ")} (confidence ${last.confidence}).`);
  if (last.maintain.length) lines.push(`- Keep alive (maintain, NOT drop): ${last.maintain.map((id) => titleFor(last, id)).join("; ")}.`);
  if (last.park.length) lines.push(`- Deliberately parked for now (still matters — deferred, not dropped): ${last.park.map((id) => titleFor(last, id)).join("; ")}.`);
  if (last.reversal) lines.push(`- You said you'd reallocate if: ${last.reversal}. If that has happened, name it and shift the plan.`);
  if (!last.outcome && last.protect.length) lines.push(`- This call hasn't been checked yet — when it fits, ask whether protecting ${last.protect.map((id) => titleFor(last, id)).join(" / ")} actually paid off before you re-decide (judge the CALL, not just their effort).`);
  return lines.join(NL);
}

/**
 * CALIBRATION — the loop the audit was really after: not "what advice works" but "what kinds of
 * JUDGMENT do I get right or wrong." Surfaces (a) a prior call ready to be judged (with its auto-read
 * execution, so Synapse assesses the DECISION separately), and (b) honest aggregate patterns — only
 * when there is genuinely enough reviewed history to say something true. Silent otherwise; never
 * manufactures a pattern from thin data. Finer, factor-level calibration ("I over-weight deadlines")
 * needs factor tagging on each decision — a deliberate future step, not faked here.
 */
export function calibrationContextBlock(): string {
  const list = loadAllocations();
  if (!list.length) return "";
  const lines: string[] = [];

  // (a) A recent call with an execution read but no decision-quality judgment yet → invite the split.
  const toJudge = list
    .filter((a) => a.outcome?.execution && !a.outcome?.decisionQuality && a.protect.length)
    .sort((x, y) => x.weekKey.localeCompare(y.weekKey))
    .pop();
  if (toJudge) {
    const ex = toJudge.outcome!.execution;
    const exWord = ex === "moved" ? "did move" : ex === "partial" ? "partly moved" : ex === "stalled" ? "did NOT move" : "can't be read";
    lines.push(`CALIBRATE YOUR JUDGMENT — last time you chose to protect ${toJudge.protect.map((id) => titleFor(toJudge, id)).join(" / ")}, and it ${exWord}. Two SEPARATE questions: was the CALL right given what you knew, and did they EXECUTE it? Don't collapse them — a right call can stall on execution, a lucky push can't excuse a wrong call. Reflect on which it was before re-deciding.`);
  }

  // (b) Aggregate — only with >=3 judged calls, and only when a real skew exists.
  const judged = list.filter((a) => a.outcome?.decisionQuality);
  if (judged.length >= 3) {
    const q = (v: AllocAssessment) => judged.filter((a) => a.outcome!.decisionQuality === v).length;
    const supported = q("supported");
    const off = q("wrong") + q("mixed");
    if (off >= 2 && off >= supported) lines.push(`Your prioritization calls have been landing off more than right lately (${off} shaky vs ${supported} sound of ${judged.length}) — hold the needle loosely and lean harder on their read.`);
    // Right calls that keep not getting executed → the gap is the plan/capacity, not the priority.
    const soundButStalled = judged.filter((a) => a.outcome!.decisionQuality === "supported" && a.outcome!.execution === "stalled").length;
    if (soundButStalled >= 2) lines.push(`Several calls looked right but kept not getting executed — the gap is likely the plan or their capacity, not the priority; fix the how, not the what.`);
  }

  return lines.join(NL);
}
