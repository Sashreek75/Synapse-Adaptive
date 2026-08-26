/**
 * DATED ACTIVITY LOG — precise "what did you do on which day" recall.
 *
 * Context notes are stored with a date, but if they're fed to the model as an undated bag of
 * strings it can't tell Tuesday's physics homework from today's APES extra credit — so it guesses
 * and swaps them. This groups notes by the calendar day they happened, labels each day plainly, and
 * ships a strict instruction: attribute activities ONLY to the day they're logged under, never invent
 * or swap, and admit when a day isn't recorded rather than guess.
 */

export interface DatedNote { date: string; prompt?: string; answer: string }

const NL = "\n";
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function dayLabel(at: number, now: number): string {
  const nice = new Date(at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const diff = Math.round((startOfDay(new Date(now)) - startOfDay(new Date(at))) / 864e5);
  if (diff <= 0) return `Today (${nice})`;
  if (diff === 1) return `Yesterday (${nice})`;
  if (diff < 7) return `${diff} days ago (${nice})`;
  return nice;
}

/**
 * Build a dated, day-grouped log block from context notes (newest day first). Returns "" when there
 * is nothing recent. `days` bounds how far back to look; `cap` bounds total entries.
 */
export function dailyActivityLog(
  notes: DatedNote[],
  now: Date = new Date(),
  opts: { days?: number; cap?: number } = {},
): string {
  const { days = 10, cap = 24 } = opts;
  const cutoff = now.getTime() - days * 864e5;
  const recent = notes.filter((n) => {
    const t = new Date(n.date).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });
  if (!recent.length) return "";

  const trimmed = recent.slice(-cap);
  const byDay = new Map<string, { at: number; items: DatedNote[] }>();
  for (const n of trimmed) {
    const d = new Date(n.date);
    const key = String(startOfDay(d));
    const bucket = byDay.get(key);
    if (bucket) bucket.items.push(n);
    else byDay.set(key, { at: d.getTime(), items: [n] });
  }

  const blocks = [...byDay.values()]
    .sort((a, b) => b.at - a.at)
    .map(({ at, items }) => {
      const lines = items
        .map((n) => `  - ${n.answer.trim()}${n.prompt && n.prompt.trim() ? ` (re: ${n.prompt.trim()})` : ""}`)
        .join(NL);
      return `${dayLabel(at, now.getTime())}:${NL}${lines}`;
    });

  return [
    "DATED ACTIVITY LOG — exactly what they reported doing or told you, grouped by the day it happened. This is your SOURCE OF TRUTH for what happened WHEN. Rules: attribute an activity ONLY to the day it is listed under; never move, merge, invent, or swap what they worked on across days. If they ask about a day that isn't in this log, say you don't have it recorded rather than guessing.",
    ...blocks,
  ].join(NL + NL);
}
