"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Trophy, TrendingUp, Eye, MessageCircleQuestion, Sun, Sparkles } from "lucide-react";
import { useHealth } from "@/components/providers/health-store";
import { computeStreak, currentMilestone, curiosityQuestion } from "@/lib/intelligence";
import { selectWeeklyFocus, currentWeekKey, reviewExperiment } from "@/lib/focus";
import { synapseNotifications, type NotifTone } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const SEEN_KEY = "synapse.notifs.seen.v1";
const toneMeta: Record<NotifTone, { icon: typeof Bell; cls: string }> = {
  celebrate: { icon: Trophy, cls: "text-orange-500" },
  good: { icon: TrendingUp, cls: "text-emerald-500" },
  watch: { icon: Eye, cls: "text-orange-400" },
  ask: { icon: MessageCircleQuestion, cls: "text-navy-400" },
  nudge: { icon: Sun, cls: "text-orange-500" },
  info: { icon: Sparkles, cls: "text-navy-400" },
};

export function NotificationsBell() {
  const { hydrated, hasData, dailyDoneToday, weeksTracked, checkIns, recentChanges, series, profile, experiments } = useHealth();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => { try { setSeen(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch {} }, []);

  const items = useMemo(() => {
    if (!hydrated) return [];
    const streak = computeStreak(checkIns);
    const q = hasData ? curiosityQuestion(series, profile.path, recentChanges) : undefined;

    // Decision-Intelligence context: this week's focus + the running experiment.
    const focus = hasData ? selectWeeklyFocus(series, profile.path, recentChanges) : null;
    const wk = currentWeekKey();
    const current = experiments.find((e) => e.weekKey === wk);
    const experimentDay = current ? Math.max(1, Math.floor((Date.now() - new Date(current.startedAt).getTime()) / 864e5) + 1) : null;
    const pastRec = [...experiments].filter((e) => e.weekKey !== wk).sort((a, b) => a.startedAt.localeCompare(b.startedAt)).pop();
    const review = pastRec ? reviewExperiment(pastRec, series) : null;
    const experimentVerdict = review && review.outcome !== "inconclusive" ? review.headline : null;

    return synapseNotifications({
      hasData, dailyDoneToday, weeksTracked, checkInCount: checkIns.length,
      milestone: currentMilestone(streak),
      recentChanges,
      curiosityPrompt: q?.prompt,
      focusTitle: focus?.title,
      focusAction: focus?.focusAction,
      experimentDay,
      experimentVerdict,
    });
  }, [hydrated, hasData, dailyDoneToday, weeksTracked, checkIns, recentChanges, series, profile.path, experiments]);

  const unread = items.filter((i) => !seen.includes(i.id)).length;

  function markSeen() {
    const ids = Array.from(new Set([...seen, ...items.map((i) => i.id)]));
    setSeen(ids);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch {}
  }
  function toggle() { const next = !open; setOpen(next); if (next) markSeen(); }

  return (
    <div className="relative">
      <button onClick={toggle} aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-full border bg-surface text-muted hover:text-ink">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">{unread}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border bg-surface shadow-lift">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Sparkles className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-semibold text-ink">From Synapse</p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {items.length ? items.map((n) => {
                const meta = toneMeta[n.tone]; const Icon = meta.icon;
                return (
                  <Link key={n.id} href={n.href} onClick={() => setOpen(false)}
                    className="flex items-start gap-3 border-b px-4 py-3 last:border-0 hover:bg-surface-2">
                    <span className={cn("mt-0.5 shrink-0", meta.cls)}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs leading-relaxed text-muted">{n.body}</p>}
                    </div>
                  </Link>
                );
              }) : (
                <p className="px-4 py-6 text-center text-sm text-muted">You&apos;re all caught up.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
