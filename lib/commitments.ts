/**
 * THE COMMITMENT LOOP — the behavioral layer between understanding and change.
 *
 * This is NOT the intelligence engine (PersonModel, statistics, hypotheses, memory,
 * safety are all frozen and untouched). It is a small, deterministic layer that gives
 * Synapse a STAKE in what happens next: every session can end with ONE concrete
 * commitment — framed as a promise, not a plan — and every future session picks that
 * thread back up until it is done, partly done, consciously dropped WITH A REASON, or
 * replaced by something higher-leverage. Nothing silently disappears.
 *
 * No gamification: no points, no streaks, no badges. Just a promise, remembered.
 */

import { witness } from "@/lib/activity";

export const COMMITMENTS_KEY = "synapse.commitments.v1";

export type CommitmentStatus = "open" | "done" | "partial" | "dropped" | "replaced";

export interface Commitment {
  id: string;
  text: string;                 // "email three professors"
  createdAt: string;            // ISO — the session it was made in
  status: CommitmentStatus;
  towards?: string;             // the identity/goal it serves (for framing)
  resolvedAt?: string;
  note?: string;                // what actually happened
  reason?: string;              // why partial / dropped / replaced
  replacedBy?: string;          // id of the commitment that took its place
  history: { at: string; status: CommitmentStatus; note?: string }[];
}

const dayOf = (iso: string) => iso.slice(0, 10);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const ageInDays = (iso: string, now: Date) => Math.floor((startOfDay(now) - startOfDay(new Date(iso))) / 864e5);

export function loadCommitments(): Commitment[] {
  try { const r = localStorage.getItem(COMMITMENTS_KEY); return r ? (JSON.parse(r) as Commitment[]) : []; } catch { return []; }
}
function save(list: Commitment[]) { try { localStorage.setItem(COMMITMENTS_KEY, JSON.stringify(list.slice(-100))); } catch {} }

/** Broadcast so every surface (home, chat, check-in) refreshes — same pattern as focus. */
function emit() { try { window.dispatchEvent(new CustomEvent("synapse:commitments")); } catch {} }

/** The single live thread right now (most recent still-open commitment). */
export function openCommitment(list: Commitment[] = loadCommitments()): Commitment | null {
  const open = list.filter((c) => c.status === "open");
  return open.length ? open[open.length - 1] : null;
}

/**
 * The open commitment made on a PRIOR session — the one it's time to check in on — but ONLY if it's
 * still RECENT. A promise from yesterday is worth revisiting; one from 5 days ago is stale and
 * resurfacing it just confuses ("you said schoolwork mattered" days after the conversation moved on).
 * So we cap it: made on a prior day AND no older than `maxAgeDays`.
 */
export function commitmentAwaitingReport(list: Commitment[] = loadCommitments(), now = new Date(), maxAgeDays = 2): Commitment | null {
  const c = openCommitment(list);
  if (!c) return null;
  if (dayOf(c.createdAt) >= now.toISOString().slice(0, 10)) return null; // made today → not "from a prior session"
  return ageInDays(c.createdAt, now) <= maxAgeDays ? c : null;            // older than the window → stale, don't resurface
}

/**
 * Self-healing: any commitment left OPEN longer than `maxOpenDays` is quietly lapsed to "dropped"
 * (with a reason, never silently) so it stops polluting presence, obligations, and openers. Called on
 * app load. Keeps the loop honest — a promise nobody reported on for days is no longer live.
 */
export function pruneStaleCommitments(now = new Date(), maxOpenDays = 4): boolean {
  const list = loadCommitments();
  const iso = now.toISOString();
  let changed = false;
  for (const c of list) {
    if (c.status !== "open") continue;
    if (ageInDays(c.createdAt, now) > maxOpenDays) {
      c.status = "dropped"; c.resolvedAt = iso; c.reason = "went stale — never reported back";
      c.history.push({ at: iso, status: "dropped", note: "auto-lapsed (stale)" });
      changed = true;
    }
  }
  if (changed) { save(list); emit(); }
  return changed;
}

/** Make (or, if one already exists today, revise) today's ONE commitment. Any older
 * open thread is consciously marked replaced — never silently dropped. */
export function addCommitment(text: string, towards?: string, now = new Date()): Commitment {
  const list = loadCommitments();
  const iso = now.toISOString();
  const t = iso.slice(0, 10);
  const todays = list.find((c) => c.status === "open" && dayOf(c.createdAt) === t);
  if (todays) { todays.text = text.trim(); if (towards) todays.towards = towards; save(list); emit(); witness("commitment_made", todays.text); return todays; }
  const created: Commitment = { id: `c_${now.getTime()}`, text: text.trim(), createdAt: iso, status: "open", towards, history: [{ at: iso, status: "open" }] };
  for (const c of list) if (c.status === "open") { c.status = "replaced"; c.resolvedAt = iso; c.reason = "replaced by a newer commitment"; c.replacedBy = created.id; c.history.push({ at: iso, status: "replaced" }); }
  list.push(created); save(list); emit(); witness("commitment_made", created.text); return created;
}

/** Report how a commitment went. Every path is explicit — nothing evaporates. */
export function resolveCommitment(id: string, status: CommitmentStatus, extra: { note?: string; reason?: string } = {}, now = new Date()): void {
  const list = loadCommitments();
  const c = list.find((x) => x.id === id);
  if (!c) return;
  const iso = now.toISOString();
  c.status = status; c.resolvedAt = iso;
  if (extra.note) c.note = extra.note;
  if (extra.reason) c.reason = extra.reason;
  c.history.push({ at: iso, status, note: extra.note });
  save(list); emit();
  if (status === "done") witness("commitment_kept", c.text); else if (status === "dropped") witness("commitment_missed", c.text);
}

/** Carry an unfinished commitment into today (keeps the promise alive without shame). */
export function recommitToday(id: string, note?: string, now = new Date()): void {
  const list = loadCommitments();
  const c = list.find((x) => x.id === id);
  if (!c) return;
  const iso = now.toISOString();
  c.createdAt = iso; c.status = "open";
  c.history.push({ at: iso, status: "open", note: note || "carried into today" });
  save(list); emit(); witness("commitment_carried", c.text);
}

/** Swap the current commitment for a higher-leverage one — conscious, with a reason. */
export function replaceCommitment(id: string, newText: string, reason?: string, towards?: string, now = new Date()): Commitment {
  resolveCommitment(id, "replaced", { reason: reason || "swapped for something higher-leverage" }, now);
  const created = addCommitment(newText, towards, now);
  const list = loadCommitments();
  const old = list.find((x) => x.id === id);
  if (old) { old.replacedBy = created.id; save(list); }
  return created;
}

/* ── Reflected progress + gentle lean-in (honest, never gamified) ─────────────── */

export interface FocusLike { elapsedSec: number; completed: boolean; at: number }

/** Progress reflected back as identity — only when the data honestly earns it. Null otherwise. */
export function winsLine(list: Commitment[] = loadCommitments(), focus: FocusLike[] = []): string | null {
  if (focus.length >= 4) {
    const mins = focus.map((f) => Math.round(f.elapsedSec / 60));
    const third = Math.max(1, Math.floor(mins.length / 3));
    const earlyMax = Math.max(...mins.slice(0, third));
    const recentMax = Math.max(...mins.slice(-third));
    if (recentMax >= earlyMax + 15) return `Not long ago your longest focus stretch was about ${earlyMax} minutes. Lately you've reached ${recentMax}. That's real change — protect it.`;
  }
  const cutoff = Date.now() - 14 * 864e5;
  const recentDone = list.filter((c) => c.status === "done" && c.resolvedAt && new Date(c.resolvedAt).getTime() >= cutoff);
  if (recentDone.length >= 3) return `You've followed through on ${recentDone.length} of your commitments in the last couple of weeks. That's who you're becoming.`;
  return null;
}

/** A quiet lean-in when momentum is slipping. Rare; null most days. */
export function driftLine(list: Commitment[] = loadCommitments(), now = new Date()): string | null {
  const c = openCommitment(list);
  if (c) {
    const ageDays = Math.floor((now.getTime() - new Date(c.createdAt).getTime()) / 864e5);
    if (ageDays >= 2) return `We keep circling the same thing — a few days now on "${c.text}". Want to work out what's actually in the way?`;
  }
  const resolved = list.filter((x) => x.resolvedAt).slice(-3);
  const slipping = resolved.filter((x) => x.status === "dropped" || x.status === "partial").length;
  if (resolved.length >= 3 && slipping >= 3) return `This stretch doesn't quite feel like you. Want to talk about what shifted?`;
  return null;
}
