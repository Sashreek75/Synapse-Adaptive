"use client";

/**
 * REACH-OUTS — the switch that lets Synapse send an OS notification even when its tab is closed, PLUS
 * the honesty layer: the moment you turn it on, if Synapse doesn't actually know your daily rhythm, it
 * STOPS and says so — it won't guess and risk pinging you during class. It asks when to check in, and
 * only then starts initiating. (This "tell the user when I'm missing info" pattern is how Synapse acts
 * like it IS the app, not a bot bolted onto it.)
 */

import { useEffect, useState } from "react";
import { BellRing, Loader2, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useHealth } from "@/components/providers/health-store";
import { currentPushStatus, enablePush, disablePush, sendTestPush, type PushStatus } from "@/lib/push-client";
import { hasTimingInfo } from "@/lib/proactive";
import { hasReachoutSchedule, saveReachoutPrefs } from "@/lib/reachout-prefs";
import { cn } from "@/lib/utils";

const TIME_CHOICES: { label: string; hour: number }[] = [
  { label: "Early morning", hour: 7 },
  { label: "Midday", hour: 12 },
  { label: "After school", hour: 15 },
  { label: "Late afternoon", hour: 17 },
  { label: "Evening", hour: 19 },
  { label: "Night", hour: 21 },
];

function fmtHour(h: number): string {
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${am ? "am" : "pm"}`;
}

export function ReachOutsControl() {
  const { checkIns } = useHealth();
  const [status, setStatus] = useState<PushStatus | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState(false);
  const [needsInfo, setNeedsInfo] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [savedSched, setSavedSched] = useState(false);

  const missingSchedule = () =>
    !hasReachoutSchedule() && !hasTimingInfo({ checkInISOs: (checkIns || []).map((c) => c.date) });

  useEffect(() => {
    currentPushStatus().then((s) => {
      setStatus(s);
      if (s === "on" && missingSchedule()) setNeedsInfo(true);
    }).catch(() => setStatus("off"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const turnOn = async () => {
    setBusy(true);
    try {
      const s = await enablePush();
      setStatus(s);
      if (s === "on" && missingSchedule()) setNeedsInfo(true);
    } finally { setBusy(false); }
  };
  const turnOff = async () => { setBusy(true); try { setStatus(await disablePush()); setTested(false); setNeedsInfo(false); } finally { setBusy(false); } };
  const test = async () => { setBusy(true); try { setTested(await sendTestPush()); } finally { setBusy(false); } };

  const togglePick = (h: number) =>
    setPicked((p) => (p.includes(h) ? p.filter((x) => x !== h) : p.length >= 2 ? [p[1], h] : [...p, h]));

  const saveSchedule = () => {
    if (!picked.length) return;
    saveReachoutPrefs(picked);
    try { window.dispatchEvent(new Event("synapse:reachout-prefs")); } catch {}
    setNeedsInfo(false);
    setSavedSched(true);
  };

  return (
    <div className="mb-4 rounded-xl border bg-surface-2/40 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink"><BellRing className="h-4 w-4 text-orange-500" /> Let Synapse reach out first</p>
          <p className="mt-0.5 text-xs text-muted">
            When it says it&apos;ll check in later, it actually will — an on-screen notification even if this tab is closed. It also starts the conversation for you a couple of times a day, timed to when you actually work.
          </p>
        </div>
        {status === "on" && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-500/10 px-2 py-1 text-[11px] font-semibold text-orange-500"><Check className="h-3 w-3" /> On</span>}
      </div>

      {/* Honest interrupt: on, but Synapse doesn't know when to reach out yet. */}
      {status === "on" && needsInfo && (
        <div className="mt-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink"><AlertTriangle className="h-4 w-4 text-orange-500" /> One thing before I start</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            I don&apos;t actually know your daily rhythm yet, so I won&apos;t guess and risk pinging you during class or a meeting. When should I check in? Pick one or two.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {TIME_CHOICES.map((c) => (
              <button key={c.hour} type="button" onClick={() => togglePick(c.hour)}
                className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  picked.includes(c.hour) ? "border-orange-500 bg-orange-500/15 text-ink" : "bg-surface text-muted hover:text-ink")}>
                {c.label} <span className="opacity-70">· {fmtHour(c.hour)}</span>
              </button>
            ))}
          </div>
          <Button size="sm" className="mt-3" disabled={!picked.length} onClick={saveSchedule}>Set my check-in times</Button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {status === "loading" && <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</span>}
        {status === "off" && <Button size="sm" onClick={turnOn} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Turn on reach-outs</Button>}
        {status === "on" && (
          <>
            <Button size="sm" variant="outline" onClick={test} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send a test</Button>
            <Button size="sm" variant="ghost" onClick={turnOff} disabled={busy}>Turn off</Button>
            {savedSched && <span className="text-xs text-muted">Set — I&apos;ll check in around those times.</span>}
            {tested && !savedSched && <span className="text-xs text-muted">Sent — watch for the notification.</span>}
          </>
        )}
        {status === "denied" && <p className="text-xs text-muted">Notifications are blocked for this site in your browser settings. Enable them there, then reload.</p>}
        {status === "unsupported" && <p className="text-xs text-muted">This browser can&apos;t show reach-outs. Try Chrome, Edge, or Firefox on desktop, or add Synapse to your home screen on mobile.</p>}
        {status === "unconfigured" && <p className="text-xs text-muted">Reach-outs aren&apos;t switched on for this deployment yet (missing VAPID keys — see SETUP_PUSH).</p>}
      </div>
    </div>
  );
}
