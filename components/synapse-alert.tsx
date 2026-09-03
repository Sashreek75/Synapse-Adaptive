"use client";

/**
 * SYNAPSE ALERT — the honest interrupt. When Synapse is missing something critical to do its job
 * (right now: no goals to prioritize), it stops and tells you at the top of the app, with the one
 * action that fixes it — rather than silently pretending it can help. Hides itself on the page that
 * resolves the gap, and the moment the gap is filled.
 */

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useHealth } from "@/components/providers/health-store";
import { activeGoals } from "@/lib/goals";
import { detectTopGap, type Gap } from "@/lib/gaps";

export function SynapseAlert() {
  const { profile } = useHealth();
  const pathname = usePathname();
  const router = useRouter();
  const [gap, setGap] = useState<Gap | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const compute = () => {
      let count = 0;
      try { count = activeGoals().length; } catch {}
      setGap(detectTopGap({ onboarded: !!profile.onboardedAt, goalsCount: count }));
    };
    compute();
    window.addEventListener("synapse:goals", compute);
    return () => window.removeEventListener("synapse:goals", compute);
  }, [profile.onboardedAt]);

  useEffect(() => {
    try { setDismissed(!!gap && sessionStorage.getItem(`synapse.gap.dismiss.${gap.id}`) === "1"); } catch { setDismissed(false); }
  }, [gap]);

  if (!gap || dismissed) return null;
  // Don't nag on the page that fixes it.
  if (gap.to && (pathname === gap.to || pathname?.startsWith(`${gap.to}/`))) return null;

  const later = () => {
    try { sessionStorage.setItem(`synapse.gap.dismiss.${gap.id}`, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <div className="sa-rise mb-5 rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4 shadow-soft">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink"><AlertTriangle className="h-4 w-4 text-orange-500" /> {gap.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{gap.body}</p>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={() => router.push(gap.to)}>{gap.cta} <ArrowRight className="h-4 w-4" /></Button>
        <button onClick={later} className="rounded-full px-3 py-1.5 text-sm text-muted hover:text-ink">Later</button>
      </div>
    </div>
  );
}
