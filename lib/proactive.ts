/**
 * PROACTIVE INITIATION — Synapse shows up for you; you don't have to remember to open it.
 *
 * This pure planner produces the day's self-initiated reach-outs (at least two): a morning "here's
 * the one thing" nudge and a "lock-in" nudge anchored to when you actually tend to work (learned from
 * your check-in times, falling back to evening). Messages are decision-forward — they point at your
 * top goal and pull you into one move — never a question you have to answer. The scheduler that calls
 * this primes today AND tomorrow, so even a day you never open the app still gets its nudges.
 */

export interface PlannedReachout { fireAt: string; title: string; body: string; dedupeKey: string }

/** Median hour-of-day the person is active, from check-in timestamps. null when too little data. */
export function typicalActiveHour(checkInISOs: string[]): number | null {
  const hrs = checkInISOs
    .map((d) => new Date(d).getHours())
    .filter((h) => Number.isFinite(h));
  if (hrs.length < 3) return null;
  hrs.sort((a, b) => a - b);
  return hrs[Math.floor(hrs.length / 2)];
}

function at(now: Date, dayOffset: number, hour: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const iso = (d: Date) => d.toISOString();
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Gentle rotation so daily nudges don't read identically.
function planLine(topGoal: string, variant: number): string {
  const g = topGoal ? ` Your focus: ${topGoal}.` : "";
  const lines = topGoal
    ? [
        `New day.${g} Tap in — I'll give you the first move.`,
        `Fresh start.${g} Open me and we'll pick the one thing that matters today.`,
        `Morning.${g} One move to start — tap in and I'll name it.`,
      ]
    : [
        "New day — tap in and I'll tell you the one thing to lock in first.",
        "Fresh start. Open me and we'll pick today's one move.",
        "Morning — let's choose the single thing that moves you today.",
      ];
  return lines[variant % lines.length];
}

function lockInLine(topGoal: string, variant: number): string {
  const lines = topGoal
    ? [
        `Around your usual time to lock in. One move on ${topGoal} — tap in and I'll keep it tight.`,
        `This is when you tend to work. Tap in — I'll line up the next step on ${topGoal}.`,
        `Time to make today count. ${topGoal} — tap in for the one move.`,
      ]
    : [
        "Around your usual time to lock in — tap in and I'll pick today's one move with you.",
        "This is when you tend to work. Tap in — let's make today count.",
        "Time to make today count — tap in for your one move.",
      ];
  return lines[variant % lines.length];
}

/**
 * Do we have enough to time reach-outs WELL? True only if the person gave us explicit hours OR we've
 * learned their active hour from enough check-ins. When false, we must NOT blind-schedule (a 9am ping
 * could land in class) — the UI interrupts and asks instead.
 */
export function hasTimingInfo(opts: { checkInISOs?: string[]; hours?: number[] }): boolean {
  if (opts.hours && opts.hours.length > 0) return true;
  return typicalActiveHour(opts.checkInISOs || []) != null;
}

/**
 * Build the proactive reach-outs for today + tomorrow at the hours we actually know are safe. Explicit
 * `hours` (what the person told us) win; otherwise we use the single learned active hour. If we know
 * NEITHER, we return [] — Synapse should ask before it pings, never guess into someone's school day.
 * Only future slots matter; the caller dedupes by key, so calling this on every app open is safe.
 */
const LADDER = [8, 12, 15, 18, 21];

/** Grow a base set of hours up to `desired` count by filling in spread-out times (for busy days that
 * warrant more check-ins). Keeps them ≥1h apart. */
function expandTimes(base: number[], desired: number): number[] {
  const out = [...base];
  for (const h of LADDER) {
    if (out.length >= desired) break;
    if (!out.some((x) => Math.abs(x - h) < 1)) out.push(h);
  }
  return out.sort((a, b) => a - b).slice(0, desired);
}

export function planProactive(
  now: Date,
  opts: { checkInISOs?: string[]; topGoal?: string; hours?: number[]; advice?: string; followup?: string; count?: number } = {},
): PlannedReachout[] {
  const topGoal = (opts.topGoal || "").trim().slice(0, 80);

  let base: number[];
  if (opts.hours && opts.hours.length > 0) {
    base = Array.from(new Set(opts.hours.filter((h) => h >= 0 && h <= 23))).sort((a, b) => a - b).slice(0, 5);
  } else {
    const active = typicalActiveHour(opts.checkInISOs || []);
    // Prefer their learned active hour; otherwise DON'T stay silent — initiating is the whole point.
    // Fall back to safe-ish defaults (midday + evening); they can refine exact times in Settings.
    base = active != null ? [active] : [12, 19];
  }
  // Frequency scales with the day: 2 is the floor, a crunch day earns up to 5.
  const desired = Math.min(5, Math.max(base.length, opts.count ?? base.length));
  const times = expandTimes(base, desired);

  const out: PlannedReachout[] = [];
  for (let day = 0; day <= 1; day++) {
    const dayKey = ymd(at(now, day, 12));
    const variant = new Date(dayKey).getDate();
    times.forEach((h, idx) => {
      const d = at(now, day, h);
      if (d.getTime() <= now.getTime() + 120_000) return; // past
      const isFirst = idx === 0;
      const isLast = idx === times.length - 1;
      let body: string;
      if (isFirst) body = opts.advice || planLine(topGoal, variant);          // lead with the real call
      else if (isLast) body = opts.followup || lockInLine(topGoal, variant + idx); // close with the follow-up
      else body = opts.advice ? "Quick check — is the priority still moving? Protect the one thing, let the rest wait." : lockInLine(topGoal, variant + idx);
      out.push({ fireAt: iso(d), title: "Synapse", body, dedupeKey: `pro-${isFirst ? "plan" : `s${idx}`}-${dayKey}` });
    });
  }
  return out;
}
