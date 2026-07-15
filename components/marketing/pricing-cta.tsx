"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import { WaitlistDialog } from "@/components/billing/waitlist-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { env, flags } from "@/env";

/** Stripe wired = real checkout; otherwise the upgrade opens the waitlist. */
const billingLive = flags.billingLive || !!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/**
 * Pricing CTA for the marketing landing page.
 *
 * Free → "Start free" (into the app). Pro/Max → open the waitlist right here on
 * the landing page (no detour to /login), unless real billing is live, in which
 * case it heads into the app to check out. This is the button the user reported
 * dead-ending at /login — now it does the right thing.
 */
export function PricingCTA({ planId }: { planId: PlanId }) {
  const { email } = useAuth();
  const [open, setOpen] = useState(false);
  const popular = PLANS[planId].popular;
  const variant = popular ? "primary" : "outline";

  if (planId === "free") {
    return (
      <Link href="/login" className="mt-7">
        <Button variant={variant} className="w-full">Start free</Button>
      </Link>
    );
  }

  if (billingLive) {
    return (
      <Link href="/login" className="mt-7">
        <Button variant={variant} className="w-full">Get {PLANS[planId].name}</Button>
      </Link>
    );
  }

  return (
    <>
      <Button variant={variant} className="mt-7 w-full" onClick={() => setOpen(true)}>
        Join the waitlist
      </Button>
      <WaitlistDialog
        plan={planId as "pro" | "max"}
        open={open}
        onClose={() => setOpen(false)}
        defaultEmail={email}
      />
    </>
  );
}
