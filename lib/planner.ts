"use client";

/**
 * PLANNER — the shared brain between you and Synapse.
 *
 * For YOU: an Obsidian/Todoist-style organizer — multiple documents, each a stack of lines you can
 * flip between plain notes, checkable tasks, and headings, with optional due dates.
 * For SYNAPSE: the structured record of what's actually on your plate. Open tasks (especially the
 * ones due today/soon) become real obligations it plans around, so it stops pushing your outside
 * goals on a day that's already full. Stored on-device; changes emit `synapse:planner` so awareness
 * refreshes live.
 */

export type LineType = "text" | "task" | "heading";
export interface PlannerLine { id: string; type: LineType; text: string; done?: boolean; due?: string }
export interface PlannerDoc { id: string; title: string; lines: PlannerLine[]; createdAt: string; updatedAt: string }

const KEY = "synapse.planner.v1";
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function emit() { try { window.dispatchEvent(new Event("synapse:planner")); } catch {} }

export function loadDocs(): PlannerDoc[] {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(r) ? (r as PlannerDoc[]) : [];
  } catch { return []; }
}

export function saveDocs(docs: PlannerDoc[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(docs)); } catch {}
  emit();
}

export function newLine(type: LineType = "text", text = ""): PlannerLine {
  return { id: uid("ln"), type, text };
}

export function createDoc(title = "Untitled"): PlannerDoc {
  const now = new Date().toISOString();
  const doc: PlannerDoc = { id: uid("doc"), title, lines: [newLine("text", "")], createdAt: now, updatedAt: now };
  saveDocs([doc, ...loadDocs()]);
  return doc;
}

/** Replace a doc (by id) with an updated version and bump updatedAt. */
export function persistDoc(doc: PlannerDoc): void {
  const docs = loadDocs();
  const i = docs.findIndex((d) => d.id === doc.id);
  const next = { ...doc, updatedAt: new Date().toISOString() };
  if (i >= 0) docs[i] = next; else docs.unshift(next);
  saveDocs(docs);
}

export function deleteDoc(id: string): void {
  saveDocs(loadDocs().filter((d) => d.id !== id));
}

/* ---------- obligations feed (what Synapse plans around) ---------- */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export interface OpenTask { text: string; doc: string; due?: string; daysUntil: number | null }

export function plannerOpenTasks(now: Date = new Date(), withinDays = 14): OpenTask[] {
  const out: OpenTask[] = [];
  for (const d of loadDocs()) {
    for (const ln of d.lines) {
      if (ln.type !== "task" || ln.done || !ln.text.trim()) continue;
      let daysUntil: number | null = null;
      if (ln.due) {
        const t = new Date(ln.due + "T00:00:00").getTime();
        if (!Number.isNaN(t)) daysUntil = Math.round((startOfDay(new Date(t)) - startOfDay(now)) / 864e5);
      }
      // Keep dated tasks within the window (incl. overdue) and a few undated ones.
      if (daysUntil == null || daysUntil <= withinDays) out.push({ text: ln.text.trim(), doc: d.title, due: ln.due, daysUntil });
    }
  }
  // Dated first (soonest/overdue), then undated.
  out.sort((a, b) => {
    if (a.daysUntil == null && b.daysUntil == null) return 0;
    if (a.daysUntil == null) return 1;
    if (b.daysUntil == null) return -1;
    return a.daysUntil - b.daysUntil;
  });
  return out.slice(0, 20);
}
