/**
 * GOALS — the operating system of Synapse, and the thing everything else orbits.
 *
 * A goal here is not a note and not even a plan; it is a LIVING MISSION. It decomposes into a
 * campaign of fronts, names its current bottleneck, always knows the next critical move — and
 * then it keeps changing based on OUTCOMES. When the user does the next move, Synapse asks "did
 * it actually work?", records the result, and the campaign reorganizes: maybe the SAT was never
 * the bottleneck, maybe it's essays, maybe it's sleep. Each mission also carries a relationship
 * (the user's limiting belief vs. what the evidence shows, the greatest risk, the recent win, the
 * question Synapse is still trying to answer). The job is not to own the plan — it is to own the
 * OUTCOME.
 *
 * Decoupled from the statistical engine / Person Model / memory internals — it only stores
 * user- and model-authored mission structure. No engine involvement.
 */

export type GoalPriority = "primary" | "high" | "medium" | "someday";
export type GoalStatus = "active" | "paused" | "achieved" | "dropped";
export type GoalMomentum = "new" | "building" | "steady" | "slipping" | "stalled";
export type FrontStatus = "open" | "active" | "won" | "paused";
export type OutcomeVerdict = "yes" | "partly" | "no";

export interface Front {
  id: string;
  title: string;
  status: FrontStatus;
  bottleneck?: string;
  nextMove?: string;
  target?: string;
  current?: string;
}
export interface NextMove { title: string; when?: string; minutes?: number; why?: string }
export interface GoalOutcome { id: string; move: string; result: string; worked?: OutcomeVerdict; at: string }

export interface Goal {
  id: string;
  title: string;
  mission?: string;            // identity-level framing: "Become someone who…"
  why?: string;
  priority: GoalPriority;
  timeline?: string;           // FREE TEXT, human ("by end of summer") — never parsed into urgency
  dueDate?: string;            // OPTIONAL structured deadline (ISO yyyy-mm-dd) — the only real urgency signal
  momentum: GoalMomentum;
  strategy?: string;
  obstacles: string[];
  whatWorks: string[];
  whatHasnt: string[];
  notes?: string;
  fronts: Front[];
  bottleneck?: string;
  nextMove?: NextMove;
  greatestRisk?: string;       // the thing most likely to sink the mission
  belief?: string;             // the user's limiting belief ("I never stay consistent")
  counterBelief?: string;      // what Synapse believes instead
  evidence: string[];          // facts that support the counter-belief
  recentWin?: string;
  openQuestion?: string;       // what Synapse is still trying to answer
  outcomes: GoalOutcome[];     // the log that makes the mission reorganize
  lastProgressAt?: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  order: number;
}

export const PRIORITIES: GoalPriority[] = ["primary", "high", "medium", "someday"];
export const MOMENTA: GoalMomentum[] = ["new", "building", "steady", "slipping", "stalled"];
export const STATUSES: GoalStatus[] = ["active", "paused", "achieved", "dropped"];
export const FRONT_STATUSES: FrontStatus[] = ["open", "active", "won", "paused"];

const PRIORITY_RANK: Record<GoalPriority, number> = { primary: 0, high: 1, medium: 2, someday: 3 };
export const MOMENTUM_LABEL: Record<GoalMomentum, string> = {
  new: "just started", building: "building", steady: "steady", slipping: "slipping", stalled: "stalled",
};

const KEY = "synapse.goals.v1";
const EVT = "synapse:goals";
const canStore = () => typeof window !== "undefined" && !!window.localStorage;

function normalize(g: Goal): Goal {
  return {
    ...g,
    obstacles: Array.isArray(g.obstacles) ? g.obstacles : [],
    whatWorks: Array.isArray(g.whatWorks) ? g.whatWorks : [],
    whatHasnt: Array.isArray(g.whatHasnt) ? g.whatHasnt : [],
    fronts: Array.isArray(g.fronts) ? g.fronts : [],
    evidence: Array.isArray(g.evidence) ? g.evidence : [],
    outcomes: Array.isArray(g.outcomes) ? g.outcomes : [],
  };
}

export function loadGoals(): Goal[] {
  if (!canStore()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw)
      ? (raw as Goal[]).filter((g) => g && typeof g.id === "string" && typeof g.title === "string").map(normalize)
      : [];
  } catch { return []; }
}

export function saveGoals(list: Goal[]): void {
  if (!canStore()) return;
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40))); window.dispatchEvent(new CustomEvent(EVT)); } catch {}
}

function slug(s: string): string {
  return (s || "goal").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "goal";
}
function uid(prefix: string): string { return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`; }

export function addGoal(input: { title: string; why?: string; priority?: GoalPriority; timeline?: string; dueDate?: string }): Goal {
  const now = new Date().toISOString();
  const list = loadGoals();
  const goal: Goal = {
    id: `${slug(input.title)}-${Date.now().toString(36)}`,
    title: input.title.trim(),
    mission: undefined,
    why: input.why?.trim() || undefined,
    priority: input.priority || (list.some((g) => g.priority === "primary" && g.status === "active") ? "high" : "primary"),
    timeline: input.timeline?.trim() || undefined,
    dueDate: input.dueDate?.trim() || undefined,
    momentum: "new",
    strategy: undefined,
    obstacles: [], whatWorks: [], whatHasnt: [],
    notes: undefined,
    fronts: [],
    bottleneck: undefined,
    nextMove: undefined,
    greatestRisk: undefined,
    belief: undefined,
    counterBelief: undefined,
    evidence: [],
    recentWin: undefined,
    openQuestion: undefined,
    outcomes: [],
    lastProgressAt: undefined,
    status: "active",
    createdAt: now, updatedAt: now,
    order: list.length,
  };
  saveGoals([...list, goal]);
  return goal;
}

export function updateGoal(id: string, patch: Partial<Omit<Goal, "id" | "createdAt">>): Goal | null {
  const list = loadGoals();
  let updated: Goal | null = null;
  const next = list.map((g) => (g.id === id ? (updated = { ...g, ...patch, updatedAt: new Date().toISOString() }) : g));
  if (updated) saveGoals(next);
  return updated;
}

export function deleteGoal(id: string): void { saveGoals(loadGoals().filter((g) => g.id !== id)); }
export function getGoal(id: string): Goal | null { return loadGoals().find((g) => g.id === id) ?? null; }

export function activeGoals(): Goal[] {
  return loadGoals()
    .filter((g) => g.status === "active")
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order);
}

/* ---- Campaign structure ---- */
export function setCampaign(goalId: string, plan: Partial<Pick<Goal, "fronts" | "bottleneck" | "nextMove" | "mission" | "greatestRisk" | "belief" | "counterBelief" | "openQuestion" | "evidence">>): Goal | null {
  const patch: Partial<Goal> = {};
  (Object.keys(plan) as (keyof typeof plan)[]).forEach((k) => {
    if (plan[k] !== undefined) (patch as Record<string, unknown>)[k] = plan[k];
  });
  return updateGoal(goalId, patch);
}
export function addFront(goalId: string, title: string): Goal | null {
  const g = getGoal(goalId); if (!g) return null;
  return updateGoal(goalId, { fronts: [...g.fronts, { id: uid("f"), title: title.trim(), status: "open" }] });
}
export function updateFront(goalId: string, frontId: string, patch: Partial<Omit<Front, "id">>): Goal | null {
  const g = getGoal(goalId); if (!g) return null;
  return updateGoal(goalId, { fronts: g.fronts.map((f) => (f.id === frontId ? { ...f, ...patch } : f)) });
}
export function removeFront(goalId: string, frontId: string): Goal | null {
  const g = getGoal(goalId); if (!g) return null;
  return updateGoal(goalId, { fronts: g.fronts.filter((f) => f.id !== frontId) });
}

/** Fraction of fronts won, 0-100. The mission's overall progress bar. */
export function progressPct(g: Goal): number {
  if (!g.fronts.length) return 0;
  return Math.round((g.fronts.filter((f) => f.status === "won").length / g.fronts.length) * 100);
}
/** The front currently being fought. */
export function currentFront(g: Goal): Front | null {
  return g.fronts.find((f) => f.status === "active") ?? g.fronts.find((f) => f.status === "open") ?? g.fronts[0] ?? null;
}

/** Mark real progress (no reflection captured). */
export function logProgress(goalId: string): Goal | null {
  const g = getGoal(goalId); if (!g) return null;
  const momentum: GoalMomentum = g.momentum === "stalled" || g.momentum === "slipping" || g.momentum === "new" ? "building" : g.momentum;
  return updateGoal(goalId, { lastProgressAt: new Date().toISOString(), momentum });
}

/** THE OUTCOME LOOP — the user did the move; capture whether it actually worked so the mission
 * can reorganize. A recent win is remembered; momentum reflects the verdict. */
export function logOutcome(goalId: string, o: { move: string; result: string; worked?: OutcomeVerdict }): Goal | null {
  const g = getGoal(goalId); if (!g) return null;
  const entry: GoalOutcome = { id: uid("o"), move: o.move, result: o.result.trim(), worked: o.worked, at: new Date().toISOString() };
  const momentum: GoalMomentum = o.worked === "no" ? "slipping" : "building";
  return updateGoal(goalId, {
    outcomes: [...g.outcomes, entry].slice(-30),
    lastProgressAt: new Date().toISOString(),
    momentum,
    recentWin: o.worked === "yes" ? o.result.trim() : g.recentWin,
  });
}

/** Match an existing goal by title (case-insensitive) or create one. */
export function findOrCreateGoal(title: string): { goal: Goal; created: boolean } {
  const t = title.trim();
  const existing = loadGoals().find((g) => g.title.toLowerCase() === t.toLowerCase());
  if (existing) return { goal: existing, created: false };
  return { goal: addGoal({ title: t }), created: true };
}

export function daysSinceProgress(g: Goal): number | null {
  const ts = g.lastProgressAt || g.createdAt;
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
}

/** Whole days until the goal's structured deadline (negative = overdue). null when no dueDate is set —
 * urgency is ONLY real when a deadline actually exists; free-text `timeline` is never treated as urgency. */
export function daysUntilDue(g: Goal): number | null {
  if (!g.dueDate) return null;
  const t = new Date(g.dueDate).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

/** Short human urgency label from the structured deadline, or "" when none. */
export function dueLabel(g: Goal): string {
  const d = daysUntilDue(g);
  if (d == null) return "";
  if (d < 0) return `${-d}d overdue`;
  if (d === 0) return "due today";
  if (d === 1) return "due tomorrow";
  return `due in ${d}d`;
}

export function campaignFallback(title: string): string[] {
  const t = (title || "").toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has("stanford", "college", "university", "admission", "get in", "ivy")) return ["Test prep (SAT/ACT)", "Coursework & GPA", "Research or projects", "Extracurriculars & leadership", "Applications & essays"];
  if (has("fit", "weight", "gym", "muscle", "strength", "run", "marathon", "abs", "health")) return ["Training consistency", "Nutrition", "Sleep", "Recovery", "Weekly review"];
  if (has("startup", "business", "launch", "company", "product")) return ["MVP", "First real users", "Landing page", "Marketing", "Funding"];
  if (has("job", "internship", "promotion", "career", "offer", "hired")) return ["Resume & profile", "Interview prep", "Applications & outreach", "Networking", "Portfolio / projects"];
  if (has("learn", "guitar", "language", "spanish", "master", "skill", "code")) return ["Fundamentals", "Daily practice", "A feedback loop", "Real-world use", "Milestone check"];
  return ["Define what done looks like", "The first concrete step", "Remove the biggest obstacle", "A weekly review rhythm"];
}

/** Preserve won/active statuses across a reassessment when a front title still matches. */
function mergeFronts(existing: Front[], fresh: Front[]): Front[] {
  return fresh.map((f) => {
    const prior = existing.find((e) => e.title.toLowerCase() === f.title.toLowerCase());
    return prior ? { ...f, id: prior.id, status: prior.status } : f;
  });
}

/**
 * Decompose (or REASSESS) a goal into a campaign. Sends the current fronts and recent outcomes
 * so the model can reorganize around what's actually happening — the bottleneck can change.
 * Falls back deterministically; never throws. Client-side.
 */
/**
 * The person-level context the user ALREADY gave (in onboarding / conversation), read from the
 * persisted health-store snapshot so the first recommendation can reason from their real situation
 * — their aspiration, what they say is hardest right now — instead of generic goal decomposition.
 * Read-only; degrades to "" if unavailable. Never invents anything the user didn't state.
 */
function personContext(): string {
  if (typeof window === "undefined") return "";
  try {
    const snap = JSON.parse(localStorage.getItem("synapse.recovery.v3") || "null"); // health-store KEY
    if (!snap) return "";
    const p = snap.profile ?? {};
    const traj: string | undefined = snap.mind?.trajectory?.statement || p.definitionOfBetter;
    const parts: string[] = [];
    if (traj) parts.push(`They're working toward: ${traj}.`);
    if (p.primaryChallenge && p.primaryChallenge !== traj) parts.push(`What they say is hardest right now: ${p.primaryChallenge}.`);
    if (p.aiSummary) parts.push(String(p.aiSummary));
    return parts.join(" ").slice(0, 600);
  } catch { return ""; }
}

export async function decomposeGoal(goalId: string): Promise<Goal | null> {
  const g = getGoal(goalId); if (!g) return null;
  type RawFront = { title: string; bottleneck?: string; nextMove?: string; target?: string; current?: string };
  type Plan = {
    fronts?: RawFront[]; bottleneck?: string; nextMove?: NextMove; mission?: string;
    greatestRisk?: string; belief?: string; counterBelief?: string; openQuestion?: string; evidence?: string[];
  };
  let plan: Plan | null = null;
  try {
    const res = await fetch("/api/goal-plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: g.title, why: g.why, timeline: g.timeline,
        context: personContext(), // what they already told us — reason the first move from THEIR situation
        fronts: g.fronts.map((f) => ({ title: f.title, status: f.status })),
        outcomes: g.outcomes.slice(-6).map((o) => ({ move: o.move, result: o.result, worked: o.worked })),
      }),
    });
    const data = await res.json();
    if (data && data.plan && Array.isArray(data.plan.fronts) && data.plan.fronts.length) plan = data.plan;
  } catch { /* fall through */ }

  const rawFronts: RawFront[] = plan?.fronts ?? campaignFallback(g.title).map((title) => ({ title }));
  const fresh: Front[] = rawFronts.slice(0, 7).map((f, i) => ({
    id: uid(`f${i}`),
    title: String(f.title),
    status: "open" as FrontStatus,
    bottleneck: f.bottleneck || undefined,
    nextMove: f.nextMove || undefined,
    target: f.target || undefined,
    current: f.current || undefined,
  }));
  const fronts = mergeFronts(g.fronts, fresh);
  return setCampaign(goalId, {
    fronts,
    bottleneck: plan?.bottleneck,
    nextMove: plan?.nextMove,
    mission: plan?.mission,
    greatestRisk: plan?.greatestRisk,
    belief: plan?.belief,
    counterBelief: plan?.counterBelief,
    openQuestion: plan?.openQuestion,
    evidence: plan?.evidence,
  });
}

export function seedGoalFromTrajectory(_statement?: string | null): void {
  // Intentionally a no-op. The long-term aspiration is the OVERHEAD (it lives in mind.trajectory), not a
  // goal to check off. Seeding it as a goal made the abstract identity ("become more focused") compete
  // with real short-term goals and win the weekly needle — which is backwards. You develop the long-term
  // THROUGH concrete short-term goals; the trajectory frames them, it isn't one of them.
}

/**
 * Injected into every conversation. This is what makes Synapse a goal OBSESSOR: it surfaces each
 * mission's bottleneck, next move, greatest risk, and recent OUTCOMES, and instructs the model to
 * (a) close the outcome loop — after any action, ask whether it actually worked; (b) challenge the
 * wrong optimization — if effort is going where the needle isn't moving, say so; and (c) force a
 * choice when goals compete for a finite week.
 */
export function goalsContextBlock(): string {
  const goals = activeGoals();
  if (!goals.length) return "";
  const nl = String.fromCharCode(10);
  const lines = goals.map((g) => {
    const head = `[${g.priority}${g.momentum !== "new" ? `, ${MOMENTUM_LABEL[g.momentum]}` : ""}]`;
    const extra: string[] = [];
    if (g.why) extra.push(`why: ${g.why}`);
    if (g.bottleneck) extra.push(`BOTTLENECK: ${g.bottleneck}`);
    if (g.greatestRisk) extra.push(`greatest risk: ${g.greatestRisk}`);
    if (g.nextMove) extra.push(`next move: ${g.nextMove.title}`);
    if (g.fronts.length) extra.push(`fronts ${g.fronts.filter((f) => f.status === "won").length}/${g.fronts.length} won`);
    const last = g.outcomes[g.outcomes.length - 1];
    if (last) extra.push(`last outcome: "${last.move}" -> ${last.worked ?? "logged"} (${last.result})`);
    const due = dueLabel(g);
    if (due) extra.push(due.toUpperCase());
    const d = daysSinceProgress(g);
    if (d != null) extra.push(`last moved ${d === 0 ? "today" : `${d}d ago`}`);
    return `- ${head} ${g.title}${extra.length ? ` (${extra.join(" | ")})` : ""}`;
  });

  const stale = goals.filter((g) => (g.priority === "primary" || g.priority === "high") && (daysSinceProgress(g) ?? 0) >= 8);
  const driftLine = stale.length
    ? `POSSIBLE DRIFT — these important goals haven't moved in over a week: ${stale.map((g) => g.title).join("; ")}. If attention has gone elsewhere on purpose that's fine — but if it's slipping unnoticed, name it and ask whether the allocation should change.`
    : "";
  const competeLine = goals.length > 1
    ? `They are carrying ${goals.length} goals at once with a finite week. Decide where their MARGINAL attention goes — allocation, not elimination: which one or two to PROTECT this week, which to MAINTAIN with a small action (still matters — maintenance is not neglect), which to PARK on purpose (deferred because acting now costs more than waiting — never "unimportant" — with what brings it back). Allocation is NOT execution: a protected goal still leaves the others a small maintenance action, not nothing. Only treat goals as competing if pushing one actually starves another; don't manufacture a trade-off. And stay dynamic: if a deadline, a stall, or a new dependency means last week's call is no longer right, say so and reallocate.`
    : "";
  return [
    "THE GOALS YOU ARE HELPING THEM WIN — you are a goal OBSESSOR, not a note-taker. For each: reason about the real BOTTLENECK ('if this isn't moving, why?') and attack THAT, not the obvious task. CLOSE THE OUTCOME LOOP: after they do something, ask whether it actually worked and let the answer reorganize the plan. CHALLENGE THE WRONG OPTIMIZATION: if their energy keeps going where the needle isn't moving, say so plainly ('we've spent weeks on X but Y hasn't moved — I think we're solving the wrong problem'). A goal shown with a deadline (DUE IN…) has real urgency; a goal without one does not — never invent urgency from a vibe.",
    ...lines,
    driftLine,
    competeLine,
  ].filter(Boolean).join(nl);
}
