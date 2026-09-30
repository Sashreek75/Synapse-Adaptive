/**
 * PRINCIPLES & MIND-SHIFTS — how Synapse grows WISER about the person, not just better informed.
 *
 * Information accumulates on its own. Wisdom is earned. Two durable objects live here:
 *   - PRINCIPLES: living truths about how THIS person works — the things that are almost always true
 *     ("you do your best work right after exercise", "you overestimate what you can do after 9pm").
 *     They rarely change; every decision should weigh against them.
 *   - MIND-SHIFTS: rare, earned revisions in Synapse's understanding of WHO THEY ARE — not "that advice
 *     failed", but "I used to think your problem was discipline; I don't anymore — it's your environment."
 *
 * Model-authored (rarely, via tags) and user-editable. A plain client store; touches no engine.
 */

export interface Principle { id: string; at: string; text: string; updatedAt?: string }
export interface MindShift { id: string; at: string; from: string; to: string; note?: string }

const PKEY = "synapse.principles.v1";
const MKEY = "synapse.mindshifts.v1";
const EVT = "synapse:principles";
const canStore = () => typeof window !== "undefined" && !!window.localStorage;
const nl = String.fromCharCode(10);
const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/* ---- Principles ---- */
export function loadPrinciples(): Principle[] {
  if (!canStore()) return [];
  try { const raw = JSON.parse(localStorage.getItem(PKEY) || "[]"); return Array.isArray(raw) ? (raw as Principle[]).filter((p) => p && typeof p.text === "string") : []; } catch { return []; }
}
export function savePrinciples(list: Principle[]): void {
  if (!canStore()) return;
  try { localStorage.setItem(PKEY, JSON.stringify(list.slice(-24))); window.dispatchEvent(new CustomEvent(EVT)); } catch {}
}
export function addPrinciple(text: string): Principle | null {
  const t = (text || "").trim();
  if (t.length < 4 || t.length > 160) return null;
  const list = loadPrinciples();
  if (list.some((p) => norm(p.text) === norm(t))) return list.find((p) => norm(p.text) === norm(t)) ?? null;
  const p: Principle = { id: uid("p"), at: new Date().toISOString(), text: t };
  savePrinciples([...list, p]);
  return p;
}
export function updatePrinciple(id: string, text: string): void {
  savePrinciples(loadPrinciples().map((p) => (p.id === id ? { ...p, text: text.trim(), updatedAt: new Date().toISOString() } : p)));
}
export function removePrinciple(id: string): void { savePrinciples(loadPrinciples().filter((p) => p.id !== id)); }

/* ---- Mind-shifts (changed my mind about you) ---- */
export function loadMindShifts(): MindShift[] {
  if (!canStore()) return [];
  try { const raw = JSON.parse(localStorage.getItem(MKEY) || "[]"); return Array.isArray(raw) ? (raw as MindShift[]).filter((m) => m && typeof m.to === "string") : []; } catch { return []; }
}
export function saveMindShifts(list: MindShift[]): void {
  if (!canStore()) return;
  try { localStorage.setItem(MKEY, JSON.stringify(list.slice(-24))); window.dispatchEvent(new CustomEvent(EVT)); } catch {}
}
export function addMindShift(input: { from: string; to: string; note?: string }): MindShift | null {
  const from = (input.from || "").trim(), to = (input.to || "").trim();
  if (to.length < 4) return null;
  const list = loadMindShifts();
  // Don't stack a near-identical shift recorded recently.
  const monthAgo = Date.now() - 30 * 86_400_000;
  if (list.some((m) => norm(m.to) === norm(to) && new Date(m.at).getTime() > monthAgo)) return null;
  const m: MindShift = { id: uid("m"), at: new Date().toISOString(), from, to, note: input.note?.trim() || undefined };
  saveMindShifts([...list, m]);
  return m;
}
export function removeMindShift(id: string): void { saveMindShifts(loadMindShifts().filter((m) => m.id !== id)); }

/**
 * Injected into every conversation: the durable truths to weigh decisions against, and the hard-won
 * revisions not to contradict. The charter handles the blind-spot questioning; this supplies the facts.
 */
export function principlesContextBlock(): string {
  const principles = loadPrinciples();
  const shifts = loadMindShifts().slice(-4);
  if (!principles.length && !shifts.length) return "";
  const lines: string[] = [];
  if (principles.length) {
    lines.push("WHAT IS ALMOST ALWAYS TRUE FOR THEM (living principles — weigh every decision against these; they rarely change):");
    for (const p of principles) lines.push(`- ${p.text}`);
  }
  if (shifts.length) {
    lines.push("HOW YOUR UNDERSTANDING OF WHO THEY ARE HAS CHANGED (hard-won; do not contradict, build on them):");
    for (const m of shifts) lines.push(`- ${m.from ? `you used to think ${m.from}; now: ${m.to}` : m.to}`);
  }
  return lines.join(nl);
}

/* ---- Tags: model emits these RARELY, only when genuinely earned ---- */
export function extractPrincipleTag(text: string): { text?: string; cleaned: string } {
  const raw = text || "";
  const m = raw.match(/\[\[\s*principle\s*:\s*([^\]]+?)\s*\]\]/i);
  if (!m) return { cleaned: raw };
  const cleaned = raw.replace(m[0], "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: (m[1] || "").trim() || undefined, cleaned };
}
export function extractMindShiftTag(text: string): { from?: string; to?: string; cleaned: string } {
  const raw = text || "";
  const m = raw.match(/\[\[\s*mindshift\s*:\s*([^\]]+?)\s*\]\]/i);
  if (!m) return { cleaned: raw };
  const inner = (m[1] || "").trim();
  const parts = inner.split(/->|→|\|/).map((s) => s.trim()).filter(Boolean);
  const from = parts.length > 1 ? parts[0] : undefined;
  const to = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
  const cleaned = raw.replace(m[0], "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { from, to: to || undefined, cleaned };
}
