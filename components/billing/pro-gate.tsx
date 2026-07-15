"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { useSubscription } from "@/components/providers/subscription-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { WaitlistDialog } from "@/components/billing/waitlist-dialog";
import { env, flags } from "@/env";
import { FEATURE_LABELS, type FeatureKey } from "@/lib/billing/plans";
import { Button } from "@/components/ui/primitives";

/** Same signal as the billing page: Stripe wired = checkout; otherwise waitlist. */
const billingLive = flags.billingLive || !!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/**
 * Wrap any Pro-only UI. Free users see a calm, value-forward upgrade teaser
 * instead of the feature — never a hard wall, never a guilt trip.
 *
 * Works with server-component children (passed through untouched when allowed).
 */
export function ProGate({
  feature,
  children,
  teaser,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
  teaser?: string;
}) {
  const { allows, hydrated, startUpgrade } = useSubscription();
  const { email } = useAuth();
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  // Avoid a flash of the upsell before we know the plan.
  if (!hydrated) return null;
  if (allows(feature)) return <>{children}</>;

  return (
    <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-surface p-6 shadow-soft dark:border-orange-500/20 dark:from-orange-500/5 dark:to-surface">
      <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
        <Sparkles className="h-3.5 w-3.5" /> A Pro feature
      </div>
      <h3 className="mt-3 flex items-center gap-2 text-lg font-semibold text-ink">
        <Lock className="h-4 w-4 text-muted" /> {FEATURE_LABELS[feature]}
      </h3>
      <p className="mt-1.5 text-muted">
        {teaser ?? "This is part of Synapse Adaptive Pro — the AI depth that turns your check-ins into understanding."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={() => (billingLive ? void startUpgrade() : setWaitlistOpen(true))}>
          Upgrade to Pro · $10/mo
        </Button>
        <Link href="/billing">
          <Button variant="outline">Compare plans</Button>
        </Link>
      </div>
      <p className="mt-3 text-xs text-muted">That&apos;s about $60 over 6 months. Cancel anytime.</p>

      <WaitlistDialog plan="pro" open={waitlistOpen} onClose={() => setWaitlistOpen(false)} defaultEmail={email} />
    </div>
  );
}

/** Small inline badge for the current plan. */
export function PlanBadge() {
  const { plan, isFounder, hydrated } = useSubscription();
  if (!hydrated) return null;
  const label = isFounder ? "Founder" : plan === "max" ? "Max" : plan === "pro" ? "Pro" : "Free";
  return (
    <span
      className={
        plan !== "free"
          ? "rounded-full bg-navy-900 px-2.5 py-1 text-xs font-semibold text-white"
          : "rounded-full border bg-surface px-2.5 py-1 text-xs font-medium text-muted"
      }
    >
      {label}
    </span>
  );
}
