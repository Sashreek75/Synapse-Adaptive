/**
 * ADAPTIVE WORKSPACES — Synapse assembles the product around the user.
 *
 * A companion should be able to reshape the software, not just its advice. When someone asks
 * for "an SAT mistake tracker", "a mock interview", "a weekly planning board", Synapse composes
 * a persistent WORKSPACE from a small, safe vocabulary of interactive blocks — rather than us
 * hard-coding dozens of screens. The model authors the spec; these deterministic renderers give
 * it life, and it persists so it becomes a real tool the person keeps returning to.
 *
 * This is decoupled from the statistical engine, memory, and safety systems — it only stores and
 * renders user-authored structure. No engine involvement.
 */

export type WsBlock =
  | { kind: "checklist"; title: string; items: string[] }
  | { kind: "tracker"; title: string; columns: string[]; addLabel?: string }
  | { kind: "notes"; title: string; placeholder?: string }
  | { kind: "prompts"; title: string; questions: string[]; reviewable?: boolean };

export interface Workspace {
  id: string;
  title: string;
  purpose?: string;
  blocks: WsBlock[];
  createdAt: string;
  goal?: string;
}

/** Per-workspace user data, keyed by block index. Shapes by block kind:
 *  checklist -> Record<string, boolean>   (item text -> checked)
 *  tracker   -> Record<string, string>[]  (rows; each row is column -> value)
 *  notes     -> string
 *  prompts   -> Record<number, string>    (question index -> answer)
 */
export type WsData = Record<number, unknown>;

const KEY = "synapse.workspaces.v1";
const DATA = (id: string) => `synapse.workspace.data.${id}`;
const EVT = "synapse:workspaces";

const canStore = () => typeof window !== "undefined" && !!window.localStorage;

export function loadWorkspaces(): Workspace[] {
  if (!canStore()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? (raw as Workspace[]).filter(isWorkspace) : [];
  } catch { return []; }
}

function isWorkspace(w: unknown): w is Workspace {
  const x = w as Workspace;
  return !!x && typeof x.id === "string" && typeof x.title === "string" && Array.isArray(x.blocks);
}

export function saveWorkspaces(list: Workspace[]): void {
  if (!canStore()) return;
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40))); window.dispatchEvent(new CustomEvent(EVT)); } catch {}
}

function slug(s: string): string {
  return (s || "space").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "space";
}

/** Add (or overwrite by id) a workspace and return it with a guaranteed id. */
export function addWorkspace(ws: Omit<Workspace, "id" | "createdAt"> & { id?: string; createdAt?: string }): Workspace {
  const full: Workspace = {
    ...ws,
    id: ws.id || `${slug(ws.title)}-${Date.now().toString(36)}`,
    createdAt: ws.createdAt || new Date().toISOString(),
    blocks: (ws.blocks || []).slice(0, 6),
  };
  const list = loadWorkspaces().filter((w) => w.id !== full.id);
  saveWorkspaces([full, ...list]);
  return full;
}

export function getWorkspace(id: string): Workspace | null {
  return loadWorkspaces().find((w) => w.id === id) ?? null;
}

export function deleteWorkspace(id: string): void {
  saveWorkspaces(loadWorkspaces().filter((w) => w.id !== id));
  if (canStore()) { try { localStorage.removeItem(DATA(id)); } catch {} }
}

export function loadWsData(id: string): WsData {
  if (!canStore()) return {};
  try { return JSON.parse(localStorage.getItem(DATA(id)) || "{}") as WsData; } catch { return {}; }
}

export function saveWsData(id: string, data: WsData): void {
  if (!canStore()) return;
  try { localStorage.setItem(DATA(id), JSON.stringify(data)); } catch {}
}

/**
 * DETERMINISTIC FALLBACK — if the model is unavailable, we still never say "I can't".
 * Compose the closest useful workspace from the request's keywords.
 */
export function fallbackWorkspace(request: string, goal?: string): Omit<Workspace, "id" | "createdAt"> {
  const t = (request || "").toLowerCase();
  const has = (...w: string[]) => w.some((x) => t.includes(x));

  if (has("interview", "mock")) {
    return { title: "Mock Interview", purpose: "Practice, capture your answers, and have Synapse review them.", goal,
      blocks: [
        { kind: "prompts", title: "Practice questions", reviewable: true, questions: [
          "Tell me about yourself.", "Why this role, and why now?", "Walk me through a hard problem you solved.",
          "What's a weakness you're actively working on?", "Where do you want to be in three years?" ] },
        { kind: "notes", title: "Notes to myself", placeholder: "Things I want to remember for next time…" },
      ] };
  }
  if (has("writing", "essay", "draft", "analyze my writing", "prose")) {
    return { title: "Writing Studio", purpose: "Paste your writing and work on it with Synapse.", goal,
      blocks: [
        { kind: "notes", title: "The draft", placeholder: "Paste or write here…" },
        { kind: "prompts", title: "Let's look closer", reviewable: true, questions: [
          "What am I actually trying to say here?", "Where does it drag or lose the reader?", "What's the strongest line, and why?" ] },
      ] };
  }
  if (has("sat", "mistake", "error", "wrong answer", "missed")) {
    return { title: "Mistake Tracker", purpose: "Log what you missed and why, so patterns surface.", goal,
      blocks: [
        { kind: "tracker", title: "Mistakes", addLabel: "Log a mistake",
          columns: ["Date", "Topic", "What I got wrong", "Why", "The fix"] },
        { kind: "notes", title: "Patterns I'm noticing", placeholder: "Recurring themes across my mistakes…" },
      ] };
  }
  if (has("habit", "streak", "daily")) {
    return { title: "Habit Tracker", purpose: "Keep the small daily reps visible.", goal,
      blocks: [
        { kind: "tracker", title: "Log", addLabel: "Log today", columns: ["Date", "Habit", "Done?", "Note"] },
        { kind: "checklist", title: "Today's reps", items: ["The main habit", "A tiny backup version"] },
      ] };
  }
  if (has("dashboard", "startup", "metrics", "kpi", "business")) {
    return { title: "Startup Dashboard", purpose: "The handful of numbers that actually matter.", goal,
      blocks: [
        { kind: "tracker", title: "Metrics", addLabel: "Add a reading", columns: ["Date", "Metric", "Value", "Note"] },
        { kind: "checklist", title: "This week's moves", items: ["", "", ""] },
        { kind: "notes", title: "Open questions", placeholder: "What am I unsure about?" },
      ] };
  }
  if (has("board", "plan", "planning", "week", "sprint", "kanban")) {
    return { title: "Weekly Planning Board", purpose: "Turn the week into a short, honest list.", goal,
      blocks: [
        { kind: "checklist", title: "This week — the few that matter", items: ["", "", ""] },
        { kind: "notes", title: "Parking lot", placeholder: "Everything that can wait…" },
      ] };
  }
  // Generic, still useful.
  return { title: titleFrom(request), purpose: "A space we can shape together — tell me what to add or change.", goal,
    blocks: [
      { kind: "checklist", title: "First steps", items: ["", "", ""] },
      { kind: "notes", title: "Notes", placeholder: "Anything you want to keep here…" },
    ] };
}

function titleFrom(request: string): string {
  const cleaned = (request || "").replace(/^(can you |could you |please |i want |i'd like |i would like |build me |make me |create |set up |a |an )+/gi, "").trim();
  const short = cleaned.split(/[.,!?]/)[0].slice(0, 40).trim();
  return short ? short.charAt(0).toUpperCase() + short.slice(1) : "Your Space";
}

/**
 * Generate a workspace from a natural-language request: ask the model, fall back to a
 * deterministic compose, always persist and return something. Client-side; used by the
 * companion orb, the main chat, and the Spaces page. Never throws, never refuses.
 */
export async function createWorkspaceFromRequest(
  request: string,
  opts?: { goal?: string; goals?: string[]; context?: string },
): Promise<Workspace> {
  let spec: Omit<Workspace, "id" | "createdAt"> | null = null;
  try {
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request, goal: opts?.goal, goals: opts?.goals, context: opts?.context }),
    });
    const data = await res.json();
    const w = data && data.workspace;
    if (w && Array.isArray(w.blocks) && w.blocks.length) {
      spec = { title: String(w.title), purpose: w.purpose ? String(w.purpose) : undefined, blocks: w.blocks as WsBlock[], goal: opts?.goal };
    }
  } catch { /* fall through to deterministic compose */ }
  if (!spec) spec = fallbackWorkspace(request, opts?.goal);
  return addWorkspace(spec);
}
