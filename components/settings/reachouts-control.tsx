"use client";

/**
 * REACH-OUTS — the switch that lets Synapse send an OS notification even when its tab is closed.
 * Talks to lib/push-client: registers the service worker, subscribes to Web Push, registers the
 * device server-side. Honest about state (unsupported / blocked / not set up / on / off).
 */

import { useEffect, useState } from "react";
import { BellRing, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { currentPushStatus, enablePush, disablePush, sendTestPush, type PushStatus } from "@/lib/push-client";

export function ReachOutsControl() {
  const [status, setStatus] = useState<PushStatus | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState(false);

  useEffect(() => { currentPushStatus().then(setStatus).catch(() => setStatus("off")); }, []);

  const turnOn = async () => { setBusy(true); try { setStatus(await enablePush()); } finally { setBusy(false); } };
  const turnOff = async () => { setBusy(true); try { setStatus(await disablePush()); setTested(false); } finally { setBusy(false); } };
  const test = async () => { setBusy(true); try { const ok = await sendTestPush(); setTested(ok); } finally { setBusy(false); } };

  return (
    <div className="mb-4 rounded-xl border bg-surface-2/40 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink"><BellRing className="h-4 w-4 text-orange-500" /> Let Synapse reach out first</p>
          <p className="mt-0.5 text-xs text-muted">
            When it says it&apos;ll check in later, it actually will — an on-screen notification even if this tab is closed (as long as your browser is open).
          </p>
        </div>
        {status === "on" && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-500/10 px-2 py-1 text-[11px] font-semibold text-orange-500"><Check className="h-3 w-3" /> On</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {status === "loading" && <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…</span>}
        {status === "off" && <Button size="sm" onClick={turnOn} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Turn on reach-outs</Button>}
        {status === "on" && (
          <>
            <Button size="sm" variant="outline" onClick={test} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send a test</Button>
            <Button size="sm" variant="ghost" onClick={turnOff} disabled={busy}>Turn off</Button>
            {tested && <span className="text-xs text-muted">Sent — watch for the notification.</span>}
          </>
        )}
        {status === "denied" && <p className="text-xs text-muted">Notifications are blocked for this site in your browser settings. Enable them there, then reload.</p>}
        {status === "unsupported" && <p className="text-xs text-muted">This browser can&apos;t show reach-outs. Try Chrome, Edge, or Firefox on desktop, or add Synapse to your home screen on mobile.</p>}
        {status === "unconfigured" && <p className="text-xs text-muted">Reach-outs aren&apos;t switched on for this deployment yet (missing VAPID keys — see SETUP_PUSH).</p>}
      </div>
    </div>
  );
}
