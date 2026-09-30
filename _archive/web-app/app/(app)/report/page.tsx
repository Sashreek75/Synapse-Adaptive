"use client";

/**
 * WEEKLY REVIEW — the one intentionally deep surface. This is the 15–30 minute mode:
 * not "here's what happened" but "here's what we LEARNED, and here's what we're
 * changing." It's where the hidden intelligence becomes visible — reflective, not
 * technical. It resolves to four things worth sitting with, each landing on ONE
 * point, not five:
 *
 *   1. What actually moved?      — outcomes in reality, not activities
 *   2. What held you back?       — the single bottleneck, not every obstacle
 *   3. What I learned about you  — one sentence (this is the moat)
 *   4. What changes next week?   — one strategic adjustment, not a to-do list
 *
 * And it ends the way coaching ends: "Here's what we're changing."
 */

import { useEffect, useMemo, useState } from "react";
import { witness } from "@/lib/activity";
import Link from "next/link";
import { Printer, Sparkles, TrendingUp, MountainSnow, BookOpen, ArrowRight, MessageCircle, CalendarCheck, PencilLine, Eye, Activity, CheckCircle2 } from "lucide-react";
import { Card, CardBody, Button, ConfidenceChip, Skeleton } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { useSubscription } from "@/components/providers/subscription-provider";
import { ProGate } from "@/components/billing/pro-gate";
import { computeStreak } from "@/lib/intelligence";
import { selectWeeklyFocus } from "@/lib/focus";
import { getPath } from "@/lib/paths";
import { activeGoals } from "@/lib/goals";
import { winsLine, driftLine } from "@/lib/commitments";
import { selfReviewLine, openRecommendations, reviewRecommendation, type Recommendation, type RecStatus } from "@/lib/decisions";
import type { Confidence, HealthReport } from "@/types";

const CACHE = "synapse.report.v2";
const PEEK_KEY = "synapse.report.peek";

/**
 * The report PUBLISHES on Sundays. The week key is the date of the Sunday that
 * ends the current week — stable Monday through Sunday.
 */
function currentWeekKey(): string {
  const s = new Date();
  s.setDate(s.getDate() + ((7 - s.getDay()) % 7));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`;
}

export default function WeeklyReportPage() {
  const { hydrated, profile, series, recentChanges, contextNotes, checkIns, hasData, weeksTracked, mind } = useHealth();
  const { plan } = useSubscription();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [reflection, setReflection] = useState("");
  const [peek, setPeek] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  // Synapse reviewing its OWN coaching — the most on-theme "what we learned" there is.
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [selfReview, setSelfReview] = useState<string | null>(null);
  useEffect(() => {
    const s = () => { setSelfReview(selfReviewLine()); setRecs(openRecommendations(40)); };
    s();
    window.addEventListener("synapse:decisions", s);
    return () => window.removeEventListener("synapse:decisions", s);
  }, []);
  const judge = (id: string, status: RecStatus) => { reviewRecommendation(id, status); setRecs(openRecommendations(40)); setSelfReview(selfReviewLine()); };

  const isSunday = new Date().getDay() === 0;
  const weekKey = currentWeekKey();

  useEffect(() => { try { setPeek(localStorage.getItem(PEEK_KEY) === "1"); } catch {} }, []);

  const sig = `${checkIns.length}:${checkIns[checkIns.length - 1]?.id ?? ""}`;
  useEffect(() => {
    if (!hasData) return;
    if (!isSunday && !peek) return;
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE) || "null");
      if (cached?.publishedAt && cached.weekKey === weekKey && cached.report) {
        setReport(cached.report); setPublishedAt(cached.publishedAt); return;
      }
      if (!isSunday && cached && !cached.publishedAt && cached.sig === sig && cached.report) {
        setReport(cached.report); return;
      }
    } catch {}
    setLoading(true);
    fetch("/api/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile: { ...profile, weeksTracked }, series, tier: plan }) })
      .then((r) => r.json()).then((d) => {
        setReport(d.report);
        try {
          if (isSunday) {
            const pub = new Date().toISOString();
            setPublishedAt(pub);
            localStorage.setItem(CACHE, JSON.stringify({ weekKey, sig, report: d.report, notices: d.notices ?? [], publishedAt: pub }));
          } else {
            localStorage.setItem(CACHE, JSON.stringify({ sig, report: d.report, notices: d.notices ?? [] }));
          }
        } catch {}
      })
      .catch(() => {}).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, hasData, peek, isSunday, weekKey]);

  const wins = recentChanges.filter((c) => c.improving);
  const watch = recentChanges.filter((c) => !c.improving);
  const weeklyFocus = useMemo(() => selectWeeklyFocus(series, profile.path, recentChanges), [series, profile.path, recentChanges]);
  const reasoning = mind.weekly[weekKey] ?? null;
  const streak = computeStreak(checkIns);
  const leadGoal = useMemo(() => activeGoals()[0] ?? null, [checkIns.length]);

  // The four things — each resolves to ONE point, with the model's read preferred.
  const moved = {
    head: reasoning?.biggestWin ?? (wins[0] ? `Your ${wins[0].label.toLowerCase()} moved the right way.` : "You kept showing up — and consistency is the outcome that makes every other one measurable."),
    kept: winsLine(),
    metric: wins[0] ? `${wins[0].label}: ${wins[0].framing}` : null,
  };
  const heldBack = reasoning?.biggestConcern
    ?? leadGoal?.bottleneck
    ?? driftLine()
    ?? (watch[0] ? `Your ${watch[0].label.toLowerCase()} slipped — that's the one to keep honest about.` : "Nothing clearly blocked you this week — so the bottleneck now is simply doing the next rep.");
  const learned = reasoning?.mindShift
    ?? reasoning?.surprise?.observation
    ?? mind.playbook[mind.playbook.length - 1]?.statement
    ?? null;
  const change = reasoning?.action
    ?? report?.nextWeek?.[0]
    ?? weeklyFocus?.focusAction
    ?? "Protect one repeatable action — small and daily beats big and occasional.";
  const changeWhy = reasoning?.why ?? weeklyFocus?.why ?? null;

  useEffect(() => { witness("weekly_review_opened"); }, []);

  if (!hydrated) return <Skeleton className="h-96 w-full rounded-2xl" />;
  if (!hasData) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Your weekly review</h1>
        <Card><CardBody className="py-10 text-center"><p className="text-muted">Our first session happens once you have a check-in or two.</p>
          <Link href="/daily" className="mt-5 inline-block"><Button>Start a check-in <Activity className="h-4 w-4" /></Button></Link></CardBody></Card>
      </div>
    );
  }

  // Not Sunday yet, and no peek — the review is still being written.
  if (!isSunday && !peek) {
    const daysLeft = (7 - new Date().getDay()) % 7;
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="sa-rise overflow-hidden"><div className="mesh"><CardBody className="flex flex-col items-center gap-6 py-14 text-center sm:px-10">
          <SynapseOrb size={84} state="thinking" />
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><Sparkles className="h-3.5 w-3.5 text-orange-500" /> Weekly review</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Our session isn&apos;t ready yet</h1>
            <p className="mx-auto mt-2 max-w-md leading-relaxed text-muted">
              I&apos;m still watching this week — we sit down together on Sunday to make sense of it. Every check-in between now and then makes what we learn sharper.
            </p>
            <p className="mt-3 text-sm font-semibold text-orange-600 dark:text-orange-400">{daysLeft === 1 ? "1 more day" : `${daysLeft} more days`}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" onClick={() => { setPeek(true); try { localStorage.setItem(PEEK_KEY, "1"); } catch {} }}>
              Show me the draft anyway <Eye className="h-4 w-4" />
            </Button>
            <Link href="/dashboard"><Button>Back to today</Button></Link>
          </div>
        </CardBody></div></Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {!isSunday && (
        <div className="sa-rise flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold uppercase tracking-wide">Draft</span> — this evolves until Sunday; I may change what I&apos;ve learned as new check-ins land.
          </p>
        </div>
      )}

      {/* Hero — a session, not a recap */}
      <Card className="overflow-hidden sa-rise"><div className="mesh"><CardBody className="sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <SynapseOrb size={60} />
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><Sparkles className="h-3.5 w-3.5 text-orange-500" /> Weekly review</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Week of {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" })}</h1>
              <p className="mt-0.5 text-sm text-muted">Not a recap — here&apos;s what we learned, and what we&apos;re changing. · {streak.totalDays} check-ins so far</p>
              {publishedAt && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <CalendarCheck className="h-3.5 w-3.5" /> Published {new Date(publishedAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
                </span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" className="hidden shrink-0 sm:inline-flex print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        </div>
        {loading && !report ? <Skeleton className="mt-5 h-16 w-full rounded-xl" /> : (
          <>
            <p className="mt-5 text-lg leading-relaxed text-ink">{report?.summary || "I'm pulling your week together…"}</p>
            {report && <div className="mt-3"><ConfidenceChip level={report.overallConfidence as Confidence} /></div>}
          </>
        )}
      </CardBody></div></Card>

      {/* 1 — WHAT ACTUALLY MOVED (outcomes, not activities) */}
      <Section n={1} q="What actually moved?" icon={TrendingUp} tint="text-emerald-600">
        <p className="text-lg leading-relaxed text-ink">{moved.head}</p>
        {(moved.kept || moved.metric) && (
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            {moved.kept && <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {moved.kept}</li>}
            {moved.metric && <li className="flex items-start gap-2"><TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {moved.metric}</li>}
          </ul>
        )}
      </Section>

      {/* 2 — WHAT HELD YOU BACK (one bottleneck) */}
      <Section n={2} q="What held you back?" icon={MountainSnow} tint="text-orange-500">
        <p className="text-lg leading-relaxed text-ink">{heldBack}</p>
        <p className="mt-2 text-sm text-muted">There&apos;s always more than one obstacle. This is the one worth your attention — clear it and the rest tend to loosen.</p>
      </Section>

      {/* 3 — WHAT I LEARNED ABOUT YOU (one sentence — the moat) */}
      <Section n={3} q="What I learned about you" icon={BookOpen} tint="text-orange-500">
        {learned ? (
          <p className="text-xl font-medium leading-snug text-ink">{learned}</p>
        ) : (
          <p className="text-lg leading-relaxed text-muted">Still watching closely — the sharpest thing I can say about you honestly is coming. Keep showing up and it will.</p>
        )}
        {learned && <p className="mt-3 text-sm text-muted">This is the kind of thing worth sitting with — it goes into <Link href="/playbook" className="font-medium text-navy-500 hover:text-navy-600">who you&apos;re becoming</Link>, and it shapes how I coach you next.</p>}

        {(selfReview || recs.length > 0) && (
          <div className="mt-5 rounded-2xl border border-navy-200/50 bg-surface-2 p-4 dark:border-navy-700/50">
            {selfReview && <p className="text-sm leading-relaxed text-ink"><span className="font-semibold">And about my own coaching — </span>{selfReview}</p>}
            {recs.length > 0 && (
              <div className={selfReview ? "mt-3" : ""}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Did last week&apos;s advice actually help?</p>
                <div className="mt-2 space-y-2">
                  {recs.slice(0, 3).map((r) => (
                    <div key={r.id} className="rounded-xl border bg-surface p-3">
                      <p className="text-sm text-ink">{r.text}</p>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => judge(r.id, "worked")} className="rounded-full border border-emerald-300/60 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/15 dark:text-emerald-300">It helped</button>
                        <button onClick={() => judge(r.id, "partial")} className="rounded-full border bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted transition hover:text-ink">Sort of</button>
                        <button onClick={() => judge(r.id, "failed")} className="rounded-full border border-rose-300/60 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-500/15 dark:text-rose-300">It didn&apos;t</button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">I use this to stop repeating what doesn&apos;t work for you — and lean on what does.</p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* 4 — WHAT CHANGES NEXT WEEK (one strategic adjustment) */}
      <Section n={4} q="What changes next week?" icon={ArrowRight} tint="text-navy-500">
        <p className="text-lg leading-relaxed text-ink">{change}</p>
        {changeWhy && <p className="mt-2 text-sm text-muted"><span className="font-semibold text-ink">Why this — </span>{changeWhy}</p>}
        <p className="mt-2 text-sm text-muted">One adjustment, not a to-do list. We&apos;ll see what it moved when we sit down next week.</p>
      </Section>

      {/* THE CLOSE — how coaching ends */}
      <Card className="overflow-hidden sa-rise-2"><div className="mesh"><CardBody className="sm:p-7">
        <div className="flex items-start gap-3">
          <SynapseOrb size={34} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">Here&apos;s what we&apos;re changing</p>
            <p className="mt-1.5 text-lg font-medium leading-snug text-ink">{change}</p>
            <p className="mt-2 text-sm text-muted">That&apos;s the whole plan. Go do it — we&apos;ll talk about how it went.</p>
          </div>
        </div>
      </CardBody></div></Card>

      {/* A human beat — one line for yourself */}
      <Card className="sa-rise-2 print:hidden"><CardBody className="sm:p-6">
        <p className="mb-2 text-sm text-muted">A line for yourself — how did this week actually feel?</p>
        <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={2} placeholder="This week I felt…" className="w-full resize-none rounded-xl border bg-surface px-4 py-2 text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400" />
      </CardBody></Card>

      {/* Go deeper if you want to — reasoning is the Pro depth. */}
      <Card className="sa-rise-2 print:hidden"><CardBody className="sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-orange-500"><Sparkles className="h-4 w-4" /></span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Push back, or go deeper</h2>
        </div>
        <ProGate feature="ai_chat" teaser="Pro unlocks open-ended reasoning over your session.">
          <p className="text-muted">Question a read, disagree with what I learned, or dig into the one thing we&apos;re changing — I&apos;ll walk you through exactly how I got there, using your own data.</p>
          <Link href="/dashboard#conversation" className="mt-4 inline-block"><Button>Reason with me <MessageCircle className="h-4 w-4" /></Button></Link>
        </ProGate>
      </CardBody></Card>

      <p className="px-1 text-center text-xs text-muted">Patterns from your own data — you always make the call.</p>
    </div>
  );
}

function Section({ n, q, icon: Icon, tint, children }: { n: number; q: string; icon: typeof Eye; tint: string; children: React.ReactNode }) {
  return (
    <Card className="sa-rise-2"><CardBody className="sm:p-7">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-navy-500">{n}</span>
        <div className="flex items-center gap-1.5">
          <Icon className={`h-4 w-4 ${tint}`} />
          <h2 className="text-base font-semibold text-ink">{q}</h2>
        </div>
      </div>
      {children}
    </CardBody></Card>
  );
}
