/**
 * SYNAPSE NOTIFICATIONS — "notifications exist for Synapse."
 * Deterministic, derived entirely from the user's own data + intelligence layer.
 * These are Synapse reaching out: a milestone, a pattern it noticed, a question
 * it wants to ask, a gentle nudge. Pure builder so the bell (and, later, push /
 * email) can share one source of truth.
 */
import type { RecentChange } from "@/types";

export type NotifTone = "celebrate" | "good" | "watch" | "ask" | "nudge" | "info";

export interface SynapseNotification {
  id: string;
  tone: NotifTone;
  title: string;
  body?: string;
  href: string;
}

export interface NotifContext {
  hasData: boolean;
  dailyDoneToday: boolean;
  weeksTracked: number;
  checkInCount: number;
  milestone: string | null;
  recentChanges: RecentChange[];
  curiosityPrompt?: string;
  memory?: string | null;
  /** This week's single focus — the decision the whole app revolves around. */
  focusTitle?: string;
  focusAction?: string;
  /** Days into the current experiment (>=1) — drives the "how's it going?" nudge. */
  experimentDay?: number | null;
  /** A finished experiment's verdict headline, when a result is ready to review. */
  experimentVerdict?: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32);

export function synapseNotifications(ctx: NotifContext): SynapseNotification[] {
  const out: SynapseNotification[] = [];

  if (!ctx.hasData) {
    out.push({ id: "welcome", tone: "info", title: "I'd love to get to know you", body: "Two minutes of setup and I'll start understanding you.", href: "/onboarding" });
    return out;
  }

  // Decision Intelligence leads: the result of last week's experiment, then this
  // week's single focus, then the running experiment's daily nudge.
  if (ctx.experimentVerdict) {
    out.push({ id: `exp-result-${slug(ctx.experimentVerdict)}`, tone: "good", title: "Our experiment result is in", body: ctx.experimentVerdict, href: "/dashboard" });
  }
  if (ctx.focusTitle) {
    out.push({ id: `focus-${slug(ctx.focusTitle)}`, tone: "nudge", title: "This week, let's focus on one thing", body: ctx.focusTitle, href: "/dashboard" });
  }
  if (ctx.experimentDay && ctx.experimentDay >= 2 && !ctx.dailyDoneToday) {
    out.push({ id: `exp-day-${ctx.experimentDay}-${today()}`, tone: "ask", title: `Day ${ctx.experimentDay} of our experiment — how's it going?`, body: ctx.focusAction ?? "A quick check-in tells us whether it's working.", href: "/daily" });
  }

  if (!ctx.dailyDoneToday) {
    out.push({ id: `nudge-daily-${today()}`, tone: "nudge", title: "I think today's a good day for a quick check-in", body: "A 20-second note keeps my read of you sharp.", href: "/daily" });
  }
  if (ctx.milestone) {
    out.push({ id: `milestone-${slug(ctx.milestone)}`, tone: "celebrate", title: "A milestone worth pausing on", body: ctx.milestone, href: "/profile" });
  }

  const sig = ctx.checkInCount;
  const up = ctx.recentChanges.filter((c) => c.improving)[0];
  const watch = ctx.recentChanges.filter((c) => !c.improving)[0];
  if (up) out.push({ id: `up-${up.metric}-${sig}`, tone: "good", title: `Your ${up.label.toLowerCase()} is trending up`, body: up.framing, href: "/report" });
  if (watch) out.push({ id: `watch-${watch.metric}-${sig}`, tone: "watch", title: `Keeping an eye on your ${watch.label.toLowerCase()}`, body: watch.framing, href: "/report" });

  if (ctx.curiosityPrompt) {
    out.push({ id: `ask-${slug(ctx.curiosityPrompt)}-${today()}`, tone: "ask", title: "I have a question for you", body: ctx.curiosityPrompt, href: "/dashboard" });
  }
  out.push({ id: `report-${sig}`, tone: "info", title: "I've finished writing your weekly report", body: "Come see what I make of your week.", href: "/report" });

  return out.slice(0, 6);
}
