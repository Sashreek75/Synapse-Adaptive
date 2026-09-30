"use client";

/**
 * REACH-OUT PREFERENCES — the person's own answer to "when should I check in?" Set the first time they
 * enable reach-outs without Synapse yet knowing their rhythm, so nudges never land during class/work.
 * Explicit hours here override anything Synapse would otherwise guess.
 */

export interface ReachoutPrefs { hours: number[]; setAt?: string }

const KEY = "synapse.reachout.prefs.v1";

export function loadReachoutPrefs(): ReachoutPrefs {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null");
    if (r && Array.isArray(r.hours)) return { hours: r.hours, setAt: r.setAt };
  } catch {}
  return { hours: [] };
}

export function saveReachoutPrefs(hours: number[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ hours: hours.slice(0, 3), setAt: new Date().toISOString() }));
  } catch {}
}

export function hasReachoutSchedule(): boolean {
  return loadReachoutPrefs().hours.length > 0;
}
