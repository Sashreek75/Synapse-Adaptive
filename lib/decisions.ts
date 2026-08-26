/**
 * DECISION REVIEW LOOP — how Synapse learns from its OWN coaching.
 *
 * Memory made Synapse remember; this makes it accountable for its advice. Every meaningful
 * recommendation it makes is captured, then later JUDGED (worked / partial / failed). Over time
 * Synapse can see which strategies actually help this person and which keep failing — so it stops
 * forcing what doesn't work, never repeats a failed strategy without explaining why this time is
 * different, and can honestly review its own coaching. This is the shift from "chatbot with memory"
 * to something closer to a mentor that owns the outcome.
 *
 * A plain client-side ledger. Touches no engine.
 */

export type RecStatus = "open" | "worked" | "partial" | "failed";
export interface Recommendation {
  id: string;
  at: string;
  text: string;       // the strategy / advice, in a few words
  goalId?: string;
  status: RecStatus;
  reviewedAt?: string;
  note?: string;
}

const KEY = "synapse.decisions.v1";
const EVT = "synapse:decisions";
const canStore = () => typeof window !== "undefined" && !!window.localStorage;
const nl = String.fromCharCode(10);
const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const uid = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function loadDecisions(): Recommendation[] {
  if (!canStore()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? (raw as Recommendation[]).filter((r) => r && typeof r.text === "string") : [];
  } catch { return []; }
}
export function saveDecisions(list: Recommendation[]): void {
  if (!canStore()) return;
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-80))); window.dispatchEvent(new CustomEvent(EVT)); } catch {}
}

/** Capture a recommendation Synapse just made. De-dupes an identical still-open rec from the last week. */
export function recordRecommendation(text: string, goalId?: string): Recommendation | null {
  const t = (text || "").trim();
  if (t.length < 3 || t.length > 140) return null;
  const list = loadDecisions();
  const weekAgo = Date.now() - 7 * 86_400_000;
  const dupe = list.find((r) => r.status === "open" && norm(r.text) === norm(t) && new Date(r.at).getTime() > weekAgo);
  if (dupe) return dupe;
  const rec: Recommendation = { id: uid(), at: new Date().toISOString(), text: t, goalId, status: "open" };
  saveDecisions([...list, rec]);
  return rec;
}

export function reviewRecommendation(id: string, status: RecStatus, note?: string): void {
  saveDecisions(loadDecisions().map((r) => (r.id === id ? { ...r, status, reviewedAt: new Date().toISOString(), note: note?.trim() || r.note } : r)));
}

/** Open recommendations at least `minAgeHours` old — the ones worth asking "did that help?" */
export function openRecommendations(minAgeHours = 0): Recommendation[] {
  const cut = Date.now() - minAgeHours * 3_600_000;
  return loadDecisions().filter((r) => r.status === "open" && new Date(r.at).getTime() <= cut).sort((a, b) => a.at.localeCompare(b.at));
}

interface Tally { text: string; worked: number; partial: number; failed: number; total: number }
function tallies(): Tally[] {
  const map = new Map<string, Tally>();
  for (const r of loadDecisions()) {
    if (r.status === "open") continue;
    const k = norm(r.text);
    const cur = map.get(k) || { text: r.text, worked: 0, partial: 0, failed: 0, total: 0 };
    if (r.status === "worked") cur.worked++;
    else if (r.status === "partial") cur.partial++;
    else if (r.status === "failed") cur.failed++;
    cur.total++;
    map.set(k, cur);
  }
  return [...map.values()];
}

/** Strategies that have repeatedly failed and rarely (never) worked — do NOT force these again. */
export function failedStrategies(): Tally[] {
  return tallies().filter((t) => t.failed >= 2 && t.worked === 0).sort((a, b) => b.failed - a.failed);
}
/** Strategies that keep working for this person. */
export function winningStrategies(): Tally[] {
  return tallies().filter((t) => t.worked >= 2 && t.failed === 0).sort((a, b) => b.worked - a.worked);
}

/**
 * Injected into every conversation so Synapse judges its own past advice: what worked, what to stop
 * forcing, and what's still awaiting a verdict.
 */
export function decisionsContextBlock(): string {
  const failed = failedStrategies().slice(0, 3);
  const won = winningStrategies().slice(0, 3);
  const open = openRecommendations(40).slice(-3); // open ~2+ days
  if (!failed.length && !won.length && !open.length) return "";
  const lines: string[] = ["WHAT YOU HAVE ALREADY TRIED WITH THEM (judge your own advice — this is how you get wiser, not just smarter):"];
  for (const t of failed) lines.push(`- ALREADY FAILED (${t.failed}x, never worked): "${t.text}". Do NOT suggest this again unless you first explain why THIS time will be different.`);
  for (const t of won) lines.push(`- Has worked for them (${t.worked}x): "${t.text}". Lean on what already works.`);
  for (const r of open) lines.push(`- Still unjudged: "${r.text}" (suggested earlier) — worth asking whether it actually helped, then adjust.`);
  return lines.join(nl);
}

/** A deterministic, honest self-review line for the weekly review. */
export function selfReviewLine(): string | null {
  const tenAgo = Date.now() - 10 * 86_400_000;
  const recent = loadDecisions().filter((r) => r.status !== "open" && r.reviewedAt && new Date(r.reviewedAt).getTime() > tenAgo);
  if (!recent.length) return null;
  const worked = recent.filter((r) => r.status === "worked").length;
  const failed = recent.filter((r) => r.status === "failed").length;
  const parts: string[] = [`Of the moves I suggested lately, ${worked} landed and ${failed} fell flat.`];
  const fs = failedStrategies()[0];
  if (fs) parts.push(`I'm going to stop pushing "${fs.text}" — it keeps not surviving contact with your real life, and that's on my coaching, not on you.`);
  return parts.join(" ");
}

/**
 * Recommendation tag — the model appends `[[rec: strategy | goalId]]` when it makes a meaningful
 * recommendation, so it can be judged later. We strip it from what the user reads and record it.
 */
export function extractRecTag(text: string): { text?: string; goalId?: string; cleaned: string } {
  const raw = text || "";
  const m = raw.match(/\[\[\s*rec\s*:\s*([^\]]*?)\s*\]\]/i);
  if (!m) return { cleaned: raw };
  const parts = (m[1] || "").split("|").map((s) => s.trim());
  const recText = parts[0] || undefined;
  const goalId = parts[1] || undefined;
  const cleaned = raw.replace(m[0], "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: recText, goalId, cleaned };
}
