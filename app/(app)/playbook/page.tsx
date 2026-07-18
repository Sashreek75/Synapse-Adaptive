"use client";

/**
 * WHAT SYNAPSE HAS LEARNED ABOUT YOU — the Experience-phase surface that REVEALS
 * the (frozen) intelligence engine. This screen only makes sense because Synapse
 * has spent weeks studying one person: it shows the living relationship — theories
 * forming and being confirmed, minds changed, habits that are paying off, and the
 * questions still open — rather than a dashboard of numbers. Reads only from the
 * persisted `mind`; it never recomputes intelligence.
 */

import { useMemo } from "react";
import Link from "next/link";
import { Sparkles, GitBranch, Lightbulb, RefreshCw, Trophy, HelpCircle, Check, CheckCircle2, FlaskConical, Compass, Repeat } from "lucide-react";
import { Card, CardBody, Button, SectionLabel, ConfidenceChip } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import type { TrackedHypothesis, Habit, HypothesisStatus, WeeklyFocusReasoning } from "@/types";

/* ── Lifecycle presentation — warm headings, ordered as a story ─────────────── */
const LIFECYCLE: { status: HypothesisStatus; heading: string; blurb: string; icon: typeof Lightbulb; tint: string }[] = [
  { status: "confirmed", heading: "Ideas we've confirmed", blurb: "Held up long enough that I trust them.", icon: CheckCircle2, tint: "text-emerald-600" },
  { status: "supported", heading: "What I'm learning about you", blurb: "Evidence is building for these.", icon: Compass, tint: "text-orange-500" },
  { status: "testing", heading: "Things I'm testing right now", blurb: "We're running a small test to find out.", icon: FlaskConical, tint: "text-navy-500" },
  { status: "forming", heading: "Things we're figuring out", blurb: "Early hunches I'm still watching.", icon: Lightbulb, tint: "text-navy-400" },
  { status: "weakened", heading: "Ideas I'm rethinking", blurb: "New data is pushing back on these.", icon: RefreshCw, tint: "text-amber-600" },
  { status: "rejected", heading: "Ideas I changed my mind about", blurb: "I thought these mattered — the evidence said otherwise. That's worth knowing.", icon: RefreshCw, tint: "text-slate-500" },
];

function evidenceLine(h: TrackedHypothesis): string {
  const s = h.supportingObservations;
  const base = `${s} observation${s === 1 ? "" : "s"} behind this`;
  return h.contradictingObservations > 0 ? `${base} · some pushback too` : base;
}

/** The single most "alive" thing Synapse can honestly say right now, drawn only
 * from what it has already recorded. Shown quietly — never manufactured. */
function livingVoice(weekly: WeeklyFocusReasoning | undefined, hypotheses: TrackedHypothesis[], habits: Habit[]): { title: string; body: string } | null {
  if (weekly?.mindShift) return { title: "I've changed my mind.", body: weekly.mindShift };
  const confirmed = hypotheses.find((h) => h.status === "confirmed");
  if (weekly?.surprise) return { title: "I noticed something.", body: weekly.surprise.observation };
  if (confirmed) return { title: "I think we've figured something out.", body: confirmed.statement };
  const established = habits.find((h) => h.status === "established");
  if (established) return { title: "Something's becoming a habit.", body: established.statement };
  const supported = hypotheses.find((h) => h.status === "supported");
  if (supported) return { title: "I've been thinking about you.", body: supported.statement };
  return null;
}

const HABIT_STYLE: Record<Habit["status"], { chip: string; label: string }> = {
  established: { chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", label: "Sticking" },
  building: { chip: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", label: "Building" },
  lapsed: { chip: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", label: "Slipped lately" },
};

export default function PlaybookPage() {
  const { hydrated, mind, weeksTracked } = useHealth();

  const weekly = useMemo(() => {
    const wk = Object.keys(mind.weekly).sort().pop();
    return wk ? mind.weekly[wk] : undefined;
  }, [mind.weekly]);

  const byStatus = useMemo(() => {
    const g = new Map<HypothesisStatus, TrackedHypothesis[]>();
    for (const h of mind.hypotheses) {
      if (!g.has(h.status)) g.set(h.status, []);
      g.get(h.status)!.push(h);
    }
    return g;
  }, [mind.hypotheses]);

  if (!hydrated) return null;

  const voice = livingVoice(weekly, mind.hypotheses, mind.habits);
  const activeHabits = mind.habits.filter((h) => h.status !== "lapsed");
  const lapsedHabits = mind.habits.filter((h) => h.status === "lapsed");
  const openQ = mind.openQuestions.filter((q) => q.status === "open");
  const answeredQ = mind.openQuestions.filter((q) => q.status === "answered");
  const confirmedCount = (byStatus.get("confirmed") ?? []).length;

  const nothingYet = !mind.hypotheses.length && !mind.habits.length && !weekly && !openQ.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <SynapseOrb size={44} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">What I&apos;ve learned about you</h1>
          <p className="text-sm text-muted">{"Everything here is earned from your own check-ins — it gets sharper the longer we work together."}</p>
        </div>
      </header>

      {nothingYet ? (
        <Card><CardBody className="py-10 text-center">
          <p className="mx-auto max-w-md text-muted">{"I'm still getting to know you. Check in for a couple of weeks and this page fills up with what I'm noticing, the theories I'm forming, and what turns out to actually help you."}</p>
          <Link href="/daily" className="mt-5 inline-block"><Button>Do today&apos;s check-in <Sparkles className="h-4 w-4" /></Button></Link>
        </CardBody></Card>
      ) : (
        <>
          {/* THE LIVING VOICE — the one most alive thing, quietly. */}
          {voice && (
            <Card className="overflow-hidden"><div className="mesh"><CardBody className="sm:p-6">
              <div className="flex items-start gap-3">
                <SynapseOrb size={34} state="idle" className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-ink">{voice.title}</p>
                  <p className="mt-1 text-ink/90">{voice.body}</p>
                </div>
              </div>
            </CardBody></div></Card>
          )}

          {/* RECENT DISCOVERY — the non-obvious thing, with why it's non-obvious. */}
          {weekly?.surprise && (
            <Card><CardBody className="sm:p-6">
              <SectionLabel className="mb-2 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-orange-500" /> A recent discovery</SectionLabel>
              <p className="text-ink">{weekly.surprise.observation}</p>
              <p className="mt-1.5 text-sm text-muted">{weekly.surprise.whyNonObvious}</p>
              <div className="mt-3 flex items-center gap-2">
                <ConfidenceChip level={weekly.surprise.confidence} />
                <span className="text-xs text-muted">{weekly.surprise.recurrence}</span>
              </div>
            </CardBody></Card>
          )}

          {/* THEORIES BY LIFECYCLE — forming → confirmed → rethought. The heart of
              "this thing is observing, updating, and revising." */}
          {LIFECYCLE.filter((l) => (byStatus.get(l.status) ?? []).length > 0).map((l) => {
            const Icon = l.icon;
            const items = byStatus.get(l.status)!;
            const muted = l.status === "rejected" || l.status === "weakened";
            return (
              <section key={l.status}>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><Icon className={`h-3.5 w-3.5 ${l.tint}`} /> {l.heading}</p>
                <p className="mb-2 text-xs text-muted">{l.blurb}</p>
                <div className="space-y-2">
                  {items.map((h) => (
                    <Card key={h.id}><CardBody className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className={muted ? "text-muted line-through decoration-slate-300" : "text-ink"}>{h.statement}</p>
                        {!muted && <div className="shrink-0"><ConfidenceChip level={h.confidence} /></div>}
                      </div>
                      {!muted && <p className="mt-1.5 text-xs text-muted">{evidenceLine(h)}</p>}
                      {h.status === "testing" && h.suggestedExperiment && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-surface-2 p-2.5 text-xs text-ink"><FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-navy-500" /> {h.suggestedExperiment}</p>
                      )}
                    </CardBody></Card>
                  ))}
                </div>
              </section>
            );
          })}

          {/* HABITS THAT SEEM TO BE HELPING — where the loop pays off. */}
          {(activeHabits.length > 0 || lapsedHabits.length > 0) && (
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><Trophy className="h-3.5 w-3.5 text-emerald-600" /> Habits that seem to be helping</p>
              <div className="space-y-2">
                {[...activeHabits, ...lapsedHabits].map((h) => {
                  const st = HABIT_STYLE[h.status];
                  return (
                    <Card key={h.id}><CardBody className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className={h.status === "lapsed" ? "text-muted" : "text-ink"}>{h.statement}</p>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${st.chip}`}>{st.label}</span>
                      </div>
                      {h.reinforcements > 0 && h.status !== "lapsed" && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted"><Repeat className="h-3.5 w-3.5" /> {"Held up across "}{h.reinforcements}{h.reinforcements === 1 ? " experiment" : " experiments"}</p>
                      )}
                    </CardBody></Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* QUESTIONS I'M WATCHING — makes "still figuring you out" visible. */}
          {(openQ.length > 0 || answeredQ.length > 0) && (
            <Card><CardBody className="sm:p-6">
              <SectionLabel className="mb-2 flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5 text-orange-500" /> Questions I&apos;m watching</SectionLabel>
              {openQ.length ? (
                <ul className="space-y-2.5">
                  {openQ.slice(0, 5).map((q) => (
                    <li key={q.id} className="flex items-start gap-2.5 text-ink">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                      <span>{q.question}{q.whyItMatters && <span className="block text-sm text-muted">{q.whyItMatters}</span>}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">{"Nothing open right now — I'll add questions as your patterns raise them."}</p>}
              {answeredQ.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Ones we&apos;ve answered</p>
                  <ul className="space-y-2">
                    {answeredQ.slice(-4).map((q) => (
                      <li key={q.id} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="text-sm"><span className="text-muted">{q.question}</span>{q.answer && <span className="block text-ink">{q.answer}</span>}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody></Card>
          )}

          {/* HOW YOU WORK — the durable Playbook learnings, condensed (no graphs). */}
          {mind.playbook.length > 0 && (
            <Card><CardBody className="sm:p-6">
              <SectionLabel className="mb-2 flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5 text-orange-500" /> How you work</SectionLabel>
              <ul className="space-y-2">
                {mind.playbook.slice(-8).map((e) => (
                  <li key={e.id} className="flex items-start gap-2 text-ink">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-300" />
                    <span>{e.statement}</span>
                  </li>
                ))}
              </ul>
            </CardBody></Card>
          )}

          {/* PROGRESS — growth, stated in words, not charts. */}
          <p className="flex items-start gap-2 rounded-2xl bg-surface-2 p-3 text-xs text-muted">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
            {weeksTracked > 0
              ? `We've been at this across ${weeksTracked} check-in${weeksTracked === 1 ? "" : "s"}${confirmedCount ? ` — ${confirmedCount} idea${confirmedCount === 1 ? "" : "s"} confirmed so far` : ""}. This is yours, it compounds, and it follows you.`
              : "This is yours and it compounds — the longer we work together, the sharper it gets."}
          </p>
        </>
      )}
    </div>
  );
}
