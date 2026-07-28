/**
 * ACTIVITY CONTEXT — presence, not memory.
 *
 * Memory is "you told me your SAT matters." PRESENCE is "I saw you just finished a
 * 52-minute focus session and committed to emailing your professor." This is a tiny log
 * of things Synapse WITNESSED happen inside the app — the shared experiences that make a
 * relationship, not a chat history. It is injected into every conversation so Synapse
 * already knows what you just did together and never recommends something you just did.
 *
 * Behavioral layer only. It records nothing but coarse "this happened" facts — never page
 * content — and touches none of the statistical/memory/safety systems.
 */

export const ACTIVITY_KEY = "synapse.activity.v1";

export type ActivityKind =
  | "snapshot" | "focus_start" | "focus_end"
  | "commitment_made" | "commitment_kept" | "commitment_missed" | "commitment_carried"
  | "conviction_seen" | "conviction_released"
  | "trajectory_changed" | "onboarding_updated"
  | "weekly_review_opened" | "you_opened";

export interface Activity { kind: ActivityKind; at: string; detail?: string }

export function loadActivity(): Activity[] {
  try { const r = localStorage.getItem(ACTIVITY_KEY); return r ? (JSON.parse(r) as Activity[]) : []; } catch { return []; }
}

/** Record that Synapse witnessed something. De-dupes rapid repeats (re-mounts) of the same
 * kind, and caps the log. No events emitted — contexts read this at send time. */
export function witness(kind: ActivityKind, detail?: string, now = new Date()): void {
  try {
    const list = loadActivity();
    const t = now.getTime();
    const last = list[list.length - 1];
    if (last && last.kind === kind && last.detail === (detail || undefined) && t - new Date(last.at).getTime() < 60_000) return;
    list.push({ kind, at: now.toISOString(), detail: detail || undefined });
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list.slice(-60)));
  } catch {}
}

function ago(fromMs: number, now: number): string {
  const m = Math.max(0, Math.round((now - fromMs) / 60000));
  if (m < 3) return "just now";
  if (m < 20) return "a few minutes ago";
  if (m < 90) return "about an hour ago";
  const sameDay = new Date(fromMs).toDateString() === new Date(now).toDateString();
  if (sameDay) return "earlier today";
  const days = Math.round((now - fromMs) / 864e5);
  if (days <= 1) return "yesterday";
  return "recently";
}

function phrase(a: Activity, now: number): string {
  const when = ago(new Date(a.at).getTime(), now);
  const d = a.detail ? a.detail : "";
  switch (a.kind) {
    case "snapshot": return `${when} they completed today's Daily Snapshot${d ? ` (they mentioned: "${d}")` : ""}.`;
    case "focus_start": return `${when} they started a focus session${d ? ` on ${d}` : ""}.`;
    case "focus_end": return `${when} they finished a focus session${d ? ` \u2014 ${d}` : ""}.`;
    case "commitment_made": return `${when} they committed to: ${d}.`;
    case "commitment_kept": return `${when} they kept a commitment: ${d}.`;
    case "commitment_missed": return `${when} they let a commitment go: ${d}.`;
    case "commitment_carried": return `${when} they carried a commitment into today: ${d}.`;
    case "conviction_seen": return `${when} you shared a conviction with them: "${d}".`;
    case "conviction_released": return `${when} they set that conviction aside.`;
    case "trajectory_changed": return `${when} they updated who they're working to become${d ? `: ${d}` : ""}.`;
    case "onboarding_updated": return `${when} they updated their profile.`;
    case "weekly_review_opened": return `${when} they opened their weekly review.`;
    case "you_opened": return `${when} they looked at the You page (how you understand them).`;
    default: return "";
  }
}

/** Pick meaningful recent activity: newest first, one per kind (awareness, not a ledger). */
function pickRecent(now: number, withinMs: number, cap: number): Activity[] {
  const recent = loadActivity().filter((a) => now - new Date(a.at).getTime() <= withinMs);
  const out: Activity[] = [];
  const seen = new Set<string>();
  for (let i = recent.length - 1; i >= 0 && out.length < cap; i--) {
    const a = recent[i];
    const key = a.kind + (a.kind.startsWith("commitment") ? "|" + (a.detail || "") : "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

/** Flat lines, newest first. */
export function recentActivityLines(now = new Date(), withinMs = 20 * 3600_000, cap = 7): string[] {
  const t = now.getTime();
  return pickRecent(t, withinMs, cap).map((a) => phrase(a, t)).filter(Boolean);
}

const NL = String.fromCharCode(10);
const sameDay = (ms: number, now: number) => new Date(ms).toDateString() === new Date(now).toDateString();
const bullets = (xs: string[]) => xs.map((x) => "- " + x).join(NL);

/** The activity block, TIERED by freshness so the emotional timing is right: what just
 * happened dominates; today is context; older is background mentioned only if relevant. */
export function activityContextBlock(now = new Date()): string {
  const t = now.getTime();
  const picked = pickRecent(t, 20 * 3600_000, 8);
  if (!picked.length) return "";
  const active: string[] = [], today: string[] = [], background: string[] = [];
  for (const a of picked) {
    const age = t - new Date(a.at).getTime();
    const line = phrase(a, t);
    if (!line) continue;
    if (age < 3 * 60_000) active.push(line);
    else if (sameDay(new Date(a.at).getTime(), t) && age < 12 * 3600_000) today.push(line);
    else background.push(line);
  }
  const parts: string[] = [];
  if (active.length) parts.push("RIGHT NOW (this just happened, let it shape your reply first):" + NL + bullets(active));
  if (today.length) parts.push("Earlier today:" + NL + bullets(today));
  if (background.length) parts.push("Further back (mention only if genuinely relevant):" + NL + bullets(background));
  return [
    "What you have been present for (shared experiences you WITNESSED inside the app). Reference them naturally, LEAD with whatever is freshest, and NEVER suggest something they just did. Where you can, notice how an experience seems to have CHANGED them (before vs after) rather than just that it happened.",
    ...parts,
  ].join(NL + NL);
}
