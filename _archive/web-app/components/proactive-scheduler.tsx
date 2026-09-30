"use client";

/**
 * PROACTIVE SCHEDULER — makes Synapse initiate on its own. On every app open (when reach-outs are on)
 * it ensures today's and tomorrow's self-started nudges are scheduled, timed to when the person
 * actually works. Uses per-day dedupe keys and a local "already scheduled" set so it never double-posts
 * or resurrects an already-fired one. Renders nothing.
 */

import { useEffect } from "react";
import { useHealth } from "@/components/providers/health-store";
import { activeGoals } from "@/lib/goals";
import { planProactive } from "@/lib/proactive";
import { buildSituation, situationNudge } from "@/lib/situation";
import { loadReachoutPrefs } from "@/lib/reachout-prefs";
import { currentPushStatus, scheduleReachoutAt } from "@/lib/push-client";

const KEY = "synapse.proactive.v1";
const loadSet = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const saveSet = (a: string[]) => { try { localStorage.setItem(KEY, JSON.stringify(a.slice(-40))); } catch {} };

export function ProactiveScheduler() {
  const { checkIns, mind } = useHealth();

  useEffect(() => {
    const run = async () => {
      try {
        if ((await currentPushStatus()) !== "on") return; // only if they've enabled reach-outs
        let topGoal = "";
        try { topGoal = activeGoals()[0]?.title || mind?.trajectory?.statement || ""; } catch { topGoal = mind?.trajectory?.statement || ""; }
        const hours = loadReachoutPrefs().hours;
        // Reach-outs carry the real call, and frequency scales with the day: 2 is the floor, an
        // overload day earns up to 5. Advice comes from the whole-board situation read.
        const sit = buildSituation();
        const nudge = situationNudge();
        const count = sit.topSignal === "overload" ? 5 : sit.topSignal === "conflict" ? 4 : sit.topSignal === "drift" ? 3 : 2;
        const plan = planProactive(new Date(), {
          checkInISOs: (checkIns || []).map((c) => c.date),
          topGoal, hours, count,
          advice: nudge?.advice, followup: nudge?.followup,
        });
        // No explicit schedule and nothing learned yet → don't blind-schedule; the settings prompt asks first.
        if (!plan.length) return;
        const done = loadSet();
        let changed = false;
        for (const p of plan) {
          if (done.includes(p.dedupeKey)) continue; // already scheduled — never re-post (would reset status)
          const ok = await scheduleReachoutAt(new Date(p.fireAt), p.body, { title: p.title, dedupeKey: p.dedupeKey });
          if (ok) { done.push(p.dedupeKey); changed = true; }
        }
        if (changed) saveSet(done);
      } catch {}
    };
    run();
    // Re-run the moment the person gives Synapse their schedule (from the Settings prompt).
    const onPrefs = () => run();
    window.addEventListener("synapse:reachout-prefs", onPrefs);
    return () => window.removeEventListener("synapse:reachout-prefs", onPrefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
