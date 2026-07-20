"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Printer, TrendingUp, TrendingDown, Eye, Lightbulb, LifeBuoy, Brain, MessageCircle, Activity, Sparkles, ListChecks, PencilLine, CalendarCheck, BookOpen, HelpCircle } from "lucide-react";
import { Card, CardBody, Button, ConfidenceChip, Skeleton } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { InsightExplain } from "@/components/synapse/insight-explain";
import { useHealth } from "@/components/providers/health-store";
import { useSubscription } from "@/components/providers/subscription-provider";
import { ProGate } from "@/components/billing/pro-gate";
import { computeStreak, focusAreas, synapseMemory } from "@/lib/intelligence";
import { selectWeeklyFocus } from "@/lib/focus";
import { getPath } from "@/lib/paths";
import type { Confidence, ProactiveNotice, HealthReport } from "@/types";

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
  const { hydrated, profile, series, recentChanges, providerQuestions, contextNotes, checkIns, hasData, weeksTracked, mind } = useHealth();
  const { plan } = useSubscription();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [notices, setNotices] = useState<ProactiveNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [reflection, setReflection] = useState("");
  const [peek, setPeek] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const isSunday = new Date().getDay() === 0;
  const weekKey = currentWeekKey();

  // The peek choice persists — it's an option, not a nag.
  useEffect(() => {
    try { setPeek(localStorage.getItem(PEEK_KEY) === "1"); } catch {}
  }, []);

  const sig = `${checkIns.length}:${checkIns[checkIns.length - 1]?.id ?? ""}`;
  useEffect(() => {
    if (!hasData) return;
    if (!isSunday && !peek) return; // gated — don't generate what won't be shown
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE) || "null");
      // A PUBLISHED report for this week is frozen — always use it, even if new check-ins land.
      if (cached?.publishedAt && cached.weekKey === weekKey && cached.report) {
        setReport(cached.report); setNotices(cached.notices ?? []); setPublishedAt(cached.publishedAt); return;
      }
      // Pre-Sunday drafts keep the signature-based regeneration.
      if (!isSunday && cached && !cached.publishedAt && cached.sig === sig && cached.report) {
        setReport(cached.report); setNotices(cached.notices ?? []); return;
      }
    } catch {} // corrupted cache → regenerate
    setLoading(true);
    fetch("/api/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile: { ...profile, weeksTracked }, series, tier: plan }) })
      .then((r) => r.json()).then((d) => {
        setReport(d.report); setNotices(d.notices ?? []);
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
  const coach = {
    summary: reasoning?.reasoningSummary,
    win: reasoning?.biggestWin ?? (wins[0] ? `Your ${wins[0].label.toLowerCase()} moved the right way.` : "You kept showing up — consistency is the win that makes everything else measurable."),
    concern: reasoning?.biggestConcern ?? (watch[0] ? `Your ${watch[0].label.toLowerCase()} slipped a little — worth a gentle eye.` : "Nothing's flashing red this week."),
    title: reasoning?.title ?? weeklyFocus?.title,
    action: reasoning?.action ?? weeklyFocus?.focusAction,
    why: reasoning?.why ?? weeklyFocus?.why,
    measure: reasoning?.measure ?? weeklyFocus?.measure,
    experiment: reasoning?.experiment ?? weeklyFocus?.experiment,
    watchFor: reasoning?.watchFor,
    providerNote: reasoning?.providerNote,
    mindShift: reasoning?.mindShift,
  };
  const focus = useMemo(() => focusAreas(series, profile.path), [series, profile.path]);
  const memory = useMemo(() => synapseMemory(profile, contextNotes, recentChanges), [profile, contextNotes, recentChanges]);
  const streak = computeStreak(checkIns);

  // What I learned about you this week — Playbook entries updated in the last 7 days.
  const learnedThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 864e5;
    return mind.playbook.filter((p) => new Date(p.updatedAt).getTime() >= cutoff).slice(-4);
  }, [mind.playbook]);
  const openQuestions = mind.openQuestions.filter((q) => q.status === "open").slice(0, 5);
  const answeredThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 864e5;
    return mind.openQuestions.filter((q) => q.status === "answered" && new Date(q.updatedAt).getTime() >= cutoff).slice(0, 3);
  }, [mind.openQuestions]);

  // Next week: ONE focus, everything else strictly secondary support for it.
  const priorities = useMemo(() => {
    if (report?.nextWeek?.length) return report.nextWeek.slice(0, 3);
    const out: string[] = [];
    if (coach.action) out.push(coach.action);
    if (out.length < 2 && focus.length) out.push(`Keep a gentle eye on ${focus[0].toLowerCase()} — I'll flag it if the trend continues.`);
    if (out.length < 2) out.push("Keep your check-ins steady — consistency is what makes next week's read sharper than this one.");
    return out.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, focus, coach.action]);

  const openQ = providerQuestions.filter((q) => q.status !== "dismissed");
  const providerFromInsights = Array.from(new Set((report?.insights ?? []).flatMap((i) => i.questionsForProvider)));
  const lifestyleNotes = contextNotes.slice(-3).reverse();

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

  // Not Sunday yet, and no peek — the report is still being written.
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
              I&apos;m still gathering this week — we sit down together on Sunday. Every check-in between now and then makes it sharper.
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
      {/* Draft banner (pre-Sunday peek) — honest about the fact this will evolve. */}
      {!isSunday && (
        <div className="sa-rise flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <PencilLine className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold uppercase tracking-wide">Draft</span> — this evolves until Sunday; I may change my read as new check-ins land.
          </p>
        </div>
      )}

      {/* Hero — feels personally written, by Synapse, for you */}
      <Card className="overflow-hidden sa-rise"><div className="mesh"><CardBody className="sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <SynapseOrb size={60} />
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted"><Sparkles className="h-3.5 w-3.5 text-orange-500" /> Weekly review</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{getPath(profile.path).focusNoun.replace(/^\w/, (c) => c.toUpperCase())} · Week of {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" })}</h1>
              <p className="mt-0.5 text-sm text-muted">{streak.totalDays} check-ins so far</p>
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

      {/* THE FLAGSHIP COACHING SESSION — written for one person, not a summary. */}
      <Card className="overflow-hidden sa-rise-2"><CardBody className="sm:p-7">
        {coach.summary && (
          <div className="mb-4 rounded-2xl border border-navy-200/50 bg-surface-2 p-4 dark:border-navy-700/50">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><Brain className="h-3.5 w-3.5 text-navy-400" /> How I read your week</p>
            <p className="mt-1.5 leading-relaxed text-ink">{coach.summary}</p>
            {coach.mindShift && <p className="mt-2 rounded-xl border border-navy-200/60 bg-navy-50/60 p-2.5 text-sm text-ink dark:border-navy-700/50 dark:bg-navy-500/10"><span className="font-semibold">I&apos;ve changed my mind — </span>{coach.mindShift}</p>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"><TrendingUp className="h-3.5 w-3.5" /> Your biggest win</p>
            <p className="mt-1.5 text-ink">{coach.win}</p>
          </div>
          <div className="rounded-2xl border border-orange-200/60 bg-orange-50/50 p-4 dark:border-orange-500/20 dark:bg-orange-500/10">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-300"><TrendingDown className="h-3.5 w-3.5" /> What concerns me most</p>
            <p className="mt-1.5 text-ink">{coach.concern}</p>
          </div>
        </div>

        {coach.title && (
          <div className="mt-5 rounded-2xl border border-navy-200/60 bg-surface-2 p-5 dark:border-navy-700/50">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><Lightbulb className="h-3.5 w-3.5 text-orange-500" /> Your focus this week</p>
            <h3 className="mt-1 text-xl font-semibold text-ink">{coach.title}</h3>
            <p className="mt-2 leading-relaxed text-ink"><span className="font-medium">The one thing: </span>{coach.action}</p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <p className="rounded-xl bg-surface p-3 text-muted"><span className="font-semibold text-ink">Why I chose this — </span>{coach.why}</p>
              <p className="rounded-xl bg-surface p-3 text-muted"><span className="font-semibold text-ink">How we&apos;ll measure — </span>{coach.measure}</p>
            </div>
            {coach.experiment && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-orange-200/60 bg-orange-500/5 p-3 text-sm text-ink dark:border-orange-500/25">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <span><span className="font-semibold">Our experiment: </span>{coach.experiment.hypothesis} {coach.experiment.expectedOutcome}</span>
              </p>
            )}
            {coach.watchFor && <p className="mt-3 text-sm text-muted"><span className="font-semibold text-ink">Watch for this before next week — </span>{coach.watchFor}</p>}
            {coach.providerNote && <p className="mt-2 flex items-start gap-2 text-sm text-muted"><LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span><span className="font-semibold text-ink">Worth keeping an eye on — and getting real help if it continues — </span>{coach.providerNote}</span></p>}
          </div>
        )}
      </CardBody></Card>

      <Chapter q="What improved" icon={TrendingUp}>
        {wins.length ? <ul className="space-y-2.5">{wins.map((w) => <li key={w.metric} className="flex items-start gap-2.5 text-ink"><TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span><b>{w.label}.</b> {w.framing}</span></li>)}</ul>
          : <p className="text-muted">No single metric jumped this week — and steady is its own kind of progress. Consistency is what makes the trends I find trustworthy.</p>}
      </Chapter>

      <Chapter q="What changed, and why" icon={Brain}>
        {report?.insights?.length ? (
          <div className="space-y-4">
            {report.insights.filter((i) => i.category !== "education").slice(0, 3).map((i) => (
              <div key={i.id}>
                <p className="text-ink">{i.observation}</p>
                <InsightExplain insight={i} className="mt-1.5" />
              </div>
            ))}
          </div>
        ) : <p className="text-muted">Not enough movement to explain yet — a couple more check-ins and the connections get clearer.</p>}
        {notices.length ? (
          <div className="mt-4 space-y-2 border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Patterns across your weeks</p>
            {notices.map((n) => (
              <div key={n.id} className="rounded-xl bg-surface-2 p-3"><p className="text-ink">{n.observation}</p><InsightExplain insight={n} className="mt-1.5" /></div>
            ))}
          </div>
        ) : null}
      </Chapter>

      {(report?.insights ?? []).some((i) => i.alternativeExplanation) && (
        <Chapter q="Possible explanations" icon={Brain}>
          <p className="mb-3 text-sm text-muted">The honest version of the story — for each pattern, here&apos;s another explanation I&apos;m still considering.</p>
          <ul className="space-y-2.5">
            {(report?.insights ?? []).filter((i) => i.alternativeExplanation).slice(0, 3).map((i) => (
              <li key={`alt-${i.id}`} className="flex items-start gap-2.5 text-muted">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-300" />
                <span>{i.alternativeExplanation}</span>
              </li>
            ))}
          </ul>
        </Chapter>
      )}

      <Chapter q="What deserves attention" icon={Eye}>
        {watch.length || focus.length ? (
          <>
            {watch.map((w) => <p key={w.metric} className="flex items-start gap-2.5 text-ink"><TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /><span><b>{w.label}.</b> {w.framing}</span></p>)}
            {focus.length > 0 && <p className="mt-3 text-sm text-muted">I&apos;m keeping a gentle eye on: {focus.join(", ")}.</p>}
          </>
        ) : <p className="text-muted">Nothing needs watching right now — a good place to be.</p>}
      </Chapter>

      {(learnedThisWeek.length > 0 || answeredThisWeek.length > 0) && (
        <Chapter q="What I learned about you" icon={BookOpen}>
          <ul className="space-y-2.5">
            {answeredThisWeek.map((q) => (
              <li key={q.id} className="flex items-start gap-2.5 text-ink">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span><span className="text-muted">I&apos;d been wondering: &ldquo;{q.question}&rdquo;</span> {q.answer}</span>
              </li>
            ))}
            {learnedThisWeek.map((p) => (
              <li key={p.id} className="flex items-start gap-2.5 text-ink">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <span>{p.statement}{p.evidence && <span className="text-xs text-muted"> — {p.evidence}</span>}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">These go into <Link href="/playbook" className="font-medium text-navy-500 hover:text-navy-600">your Playbook</Link> — the understanding we&apos;re building compounds.</p>
        </Chapter>
      )}

      {openQuestions.length > 0 && (
        <Chapter q="Questions I'm still working on" icon={HelpCircle}>
          <ul className="space-y-2.5">
            {openQuestions.map((q) => (
              <li key={q.id} className="flex items-start gap-2.5 text-ink">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                <span>{q.question}{q.whyItMatters && <span className="block text-sm text-muted">{q.whyItMatters}</span>}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">I&apos;ll work on these through our conversations, your check-ins, and small experiments — never tests for their own sake.</p>
        </Chapter>
      )}

      <Chapter q="Open questions worth chasing down" icon={HelpCircle}>
        {openQ.length || providerFromInsights.length ? (
          <ul className="space-y-2">
            {openQ.map((q) => <li key={q.id} className="flex items-start gap-2.5 text-ink"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />{q.text}</li>)}
            {providerFromInsights.filter((q) => !openQ.some((o) => o.text === q)).map((q) => <li key={q} className="flex items-start gap-2.5 text-muted"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-line" />“{q}”</li>)}
          </ul>
        ) : <p className="text-muted">Nothing open yet — bring up whatever&apos;s on your mind and I&apos;ll help you get to the bottom of it.</p>}
      </Chapter>

      <Chapter q="What you've told me" icon={MessageCircle}>
        {memory && <p className="leading-relaxed text-ink">{memory}</p>}
        {lifestyleNotes.length ? (
          <ul className={`${memory ? "mt-3 " : ""}space-y-1.5`}>{lifestyleNotes.map((n) => <li key={n.id} className="text-sm text-muted">You mentioned: <span className="text-ink">“{n.answer}”</span></li>)}</ul>
        ) : !memory ? <p className="text-muted">As you answer my check-in questions, I&apos;ll connect what you tell me to your trends here.</p> : null}
      </Chapter>

      <Chapter q="Next week's priorities" icon={ListChecks}>
        <ol className="space-y-2.5">
          {priorities.map((p, i) => (
            <li key={p} className="flex items-start gap-3 text-ink">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-navy-500">{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">Small and repeatable beats big and occasional — we&apos;ll see what moved next week.</p>
      </Chapter>

      <Chapter q="Your reflection" icon={MessageCircle}>
        <p className="mb-2 text-sm text-muted">A line for yourself — a moment to mark how this week actually felt.</p>
        <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={2} placeholder="This week I felt…" className="w-full resize-none rounded-xl border bg-surface px-4 py-2 text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400" />
      </Chapter>

      {/* Reason with Synapse about this report — open-ended reasoning is the Pro depth. */}
      <Card className="sa-rise-2 print:hidden"><CardBody className="sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-orange-500"><Sparkles className="h-4 w-4" /></span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Reason with me about this session</h2>
        </div>
        <ProGate feature="ai_chat" teaser="Pro unlocks open-ended reasoning over your session.">
          <p className="text-muted">Question a read, push back on a conclusion, or go deeper on any pattern — I&apos;ll walk you through exactly how I got there, using your own data.</p>
          <Link href="/dashboard#conversation" className="mt-4 inline-block"><Button>Reason with me <MessageCircle className="h-4 w-4" /></Button></Link>
        </ProGate>
      </CardBody></Card>

      <p className="px-1 text-center text-xs text-muted">Patterns from your own data — you always make the call.</p>
    </div>
  );
}

function Chapter({ q, icon: Icon, children }: { q: string; icon: typeof Eye; children: React.ReactNode }) {
  return (
    <Card className="sa-rise-2"><CardBody className="sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-orange-500"><Icon className="h-4 w-4" /></span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{q}</h2>
      </div>
      {children}
    </CardBody></Card>
  );
}
