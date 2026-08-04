"use client";

/**
 * WHO YOU'RE BECOMING — a mirror, not a report.
 *
 * This is the most emotional surface in the product, so it stays emotional. It shows
 * the things that make a person stop and think "that's exactly me" or "I hadn't
 * realised I'd changed" — the direction they're growing in, what Synapse has changed
 * its mind about, the one most-alive thing it can honestly say, what's quietly
 * becoming part of them, and how they tend to work. No confidence chips, no evidence
 * counts, no lifecycle of hypotheses, no charts. The machinery still runs underneath;
 * it just doesn't show its work here.
 */

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { witness } from "@/lib/activity";
import { Sparkles, Compass, Trophy, GitBranch } from "lucide-react";
import { Card, CardBody, Button, SectionLabel, Skeleton } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useHealth } from "@/components/providers/health-store";
import { ChangedMyMind } from "@/components/profile/changed-my-mind";
import type { TrackedHypothesis, Habit, WeeklyFocusReasoning } from "@/types";

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

export default function PlaybookPage() {
  const { hydrated, mind, profile } = useHealth();

  useEffect(() => { witness("you_opened"); }, []);
  const weekly = useMemo(() => {
    const wk = Object.keys(mind.weekly).sort().pop();
    return wk ? mind.weekly[wk] : undefined;
  }, [mind.weekly]);

  if (!hydrated) return <Skeleton className="h-96 w-full rounded-2xl" />;

  const voice = livingVoice(weekly, mind.hypotheses, mind.habits);
  const becoming = mind.habits.filter((h) => h.status === "established" || h.status === "building");
  const nothingYet = !voice && becoming.length === 0 && !mind.playbook.length && !mind.trajectory?.statement && !(profile.goals && profile.goals.length);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center gap-3">
        <SynapseOrb size={44} className="shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Who you&apos;re becoming</h1>
          <p className="text-sm text-muted">{"Not a report on you — a mirror. Here's the person I see taking shape."}</p>
        </div>
      </header>

      <ChangedMyMind />

      {(mind.trajectory?.statement || (profile.goals && profile.goals.length > 0)) && (
        <Card className="overflow-hidden"><div className="mesh"><CardBody className="sm:p-6">
          <SectionLabel className="mb-2 flex items-center gap-1.5"><Compass className="h-3.5 w-3.5 text-orange-500" /> The direction you&apos;re growing in</SectionLabel>
          {mind.trajectory?.statement && <p className="mb-3 text-ink">{`You're working to become: ${mind.trajectory.statement}.`}</p>}
          {profile.goals && profile.goals.length > 0 && (
            <ul className="space-y-1.5">
              {profile.goals.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-ink">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />{g}
                </li>
              ))}
            </ul>
          )}
          {profile.definitionOfBetter && <p className="mt-3 text-sm text-muted">{`What better looks like: ${profile.definitionOfBetter}`}</p>}
        </CardBody></div></Card>
      )}

      {nothingYet ? (
        <Card><CardBody className="py-10 text-center">
          <p className="mx-auto max-w-md text-muted">{"This mirror fills in as we work together — but don't wait for it. Tell me what you're working toward and let's move on something today; I'll notice who you're becoming as we go."}</p>
          <Link href="/daily" className="mt-5 inline-block"><Button>Do today&apos;s check-in <Sparkles className="h-4 w-4" /></Button></Link>
        </CardBody></Card>
      ) : (
        <>
          {/* THE ONE MOST-ALIVE THING — said quietly, as a person would. */}
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

          {/* WHAT'S BECOMING PART OF YOU — habits, stated as identity, no counts. */}
          {becoming.length > 0 && (
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"><Trophy className="h-3.5 w-3.5 text-emerald-600" /> What&apos;s becoming part of you</p>
              <div className="space-y-2">
                {becoming.map((h) => (
                  <Card key={h.id}><CardBody className="p-4">
                    <p className="text-ink">{h.statement}</p>
                  </CardBody></Card>
                ))}
              </div>
            </section>
          )}

          {/* HOW YOU WORK — durable self-recognition, in words. */}
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
        </>
      )}
    </div>
  );
}
