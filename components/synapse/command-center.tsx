"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Trophy, TrendingUp, Eye, Brain, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { sessionOpener, type OpenerHighlight } from "@/lib/intelligence";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const toneMeta: Record<OpenerHighlight["tone"], { icon: typeof Eye; cls: string }> = {
  celebrate: { icon: Trophy, cls: "text-orange-500" },
  good: { icon: TrendingUp, cls: "text-emerald-500" },
  watch: { icon: Eye, cls: "text-orange-400" },
  neutral: { icon: Sparkles, cls: "text-navy-400" },
};

/**
 * THE COMMAND CENTER — the first thing the user sees.
 * Not a dashboard header: Synapse itself, greeting you, having already looked
 * over everything, with what stood out and one thing to consider today.
 */
export function CommandCenter() {
  const { profile, series, recentChanges, contextNotes, checkIns, dailyDoneToday, weeksTracked, recommendationLog, recordRecommendation, addContextNote } = useHealth();
  const name = profile.displayName || "there";

  const opener = useMemo(
    () => sessionOpener(profile, series, recentChanges, contextNotes, checkIns, dailyDoneToday, weeksTracked),
    [profile, series, recentChanges, contextNotes, checkIns, dailyDoneToday, weeksTracked],
  );

  // Remember what Synapse suggested, so it can follow up on it later.
  useEffect(() => {
    recordRecommendation({ id: opener.recommendation.id, title: opener.recommendation.title });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opener.recommendation.id]);

  // Follow up on a PREVIOUS suggestion (different from today's, made ≥5 days ago).
  const previousRec = useMemo(() => {
    const prior = [...recommendationLog].reverse().find((r) => r.id !== opener.recommendation.id);
    if (!prior) return null;
    const ageDays = (Date.now() - new Date(prior.date).getTime()) / 864e5;
    return ageDays >= 5 && ageDays <= 45 ? prior : null;
  }, [recommendationLog, opener.recommendation.id]);
  const [followUpDone, setFollowUpDone] = useState(false);
  function answerFollowUp(answer: string) {
    if (!previousRec) return;
    addContextNote(`Follow-up on my earlier suggestion: "${previousRec.title}"`, answer);
    setFollowUpDone(true);
  }

  // Reveal the lines one at a time — Synapse "arriving", not a wall of text.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    const steps = opener.highlights.length + 1;
    const id = setInterval(() => setShown((s) => (s >= steps ? (clearInterval(id), s) : s + 1)), 420);
    return () => clearInterval(id);
  }, [opener]);

  return (
    <section className="sa-rise overflow-hidden rounded-3xl border bg-surface shadow-lift">
      <div className="mesh">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:p-8">
          {/* Synapse, present */}
          <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-center sm:gap-2">
            <SynapseOrb size={92} />
            <div className="sm:text-center">
              <p className="text-sm font-semibold text-ink">Synapse</p>
              <p className="inline-flex items-center gap-1 text-[11px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> here with you
              </p>
            </div>
          </div>

          {/* What Synapse has to say */}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">{copy.greeting(name)}</p>
            <p className="mt-1 text-xl font-medium leading-snug text-ink sm:text-2xl">{opener.lead}</p>

            <ul className="mt-4 space-y-2">
              {opener.highlights.map((h, i) => {
                const meta = toneMeta[h.tone];
                const Icon = meta.icon;
                return (
                  <li
                    key={i}
                    className={cn(
                      "flex items-start gap-2.5 text-[15px] leading-relaxed text-ink transition-all duration-500",
                      i < shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                    )}
                  >
                    <Icon className={cn("mt-1 h-4 w-4 shrink-0", meta.cls)} />
                    <span>{h.text}</span>
                  </li>
                );
              })}
            </ul>

            {opener.memory && (
              <div
                className={cn(
                  "mt-4 flex items-start gap-2.5 rounded-2xl border border-navy-200/50 bg-surface/70 px-4 py-3 text-sm leading-relaxed text-muted transition-all duration-500 dark:border-navy-700/50",
                  shown > opener.highlights.length ? "opacity-100" : "opacity-0",
                )}
              >
                <Brain className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
                <span><span className="font-medium text-ink">Synapse remembers — </span>{opener.memory}</span>
              </div>
            )}

            {previousRec && !followUpDone && (
              <div className="mt-4 rounded-2xl border border-navy-200/50 bg-surface/70 px-4 py-3 dark:border-navy-700/50">
                <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
                  <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
                  <span>A little while ago I suggested <span className="font-medium text-ink">“{previousRec.title.toLowerCase()}”</span> — how did that go?</span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {["It helped", "Didn't notice a difference", "Didn't get to it", "It didn't fit me"].map((a) => (
                    <button key={a} onClick={() => answerFollowUp(a)}
                      className="rounded-full border bg-surface px-3 py-1.5 text-xs text-muted transition-colors hover:border-orange-400 hover:text-ink">
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {followUpDone && (
              <p className="mt-4 rounded-2xl bg-surface/70 px-4 py-3 text-sm text-muted">Thank you — I&apos;ll factor that in. Suggestions that don&apos;t fit you teach me as much as the ones that do.</p>
            )}

            <div className="mt-5 flex flex-wrap gap-2.5">
              {!dailyDoneToday && (
                <Link href="/daily"><Button size="sm">Today&apos;s check-in <ArrowRight className="h-4 w-4" /></Button></Link>
              )}
              <Link href="/dashboard#conversation"><Button size="sm" variant={dailyDoneToday ? "primary" : "outline"}>Talk with Synapse</Button></Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
