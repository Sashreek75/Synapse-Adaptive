"use client";

import { useState } from "react";
import { Check, Minus, Sparkles } from "lucide-react";
import { Card, CardBody, Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";
import { useSubscription } from "@/components/providers/subscription-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { WaitlistDialog } from "@/components/billing/waitlist-dialog";
import { env, flags } from "@/env";
import { PLANS, PLAN_ORDER, FEATURE_LABELS, planAllows, type FeatureKey, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/** Features in the order they deepen Synapse's understanding. */
const COMPARE_ORDER: FeatureKey[] = [
  "weekly_checkin",
  "daily_checkin",
  "dashboard_summary",
  "recent_changes",
  "proactive_insights",
  "ai_chat",
  "appointment_prep",
  "timeline_history",
  "monthly_deep_dive",
  "unlimited_history",
];

/**
 * Billing goes live server-side via flags.billingLive (secret keys). On the
 * client those keys are invisible, so we also accept the NEXT_PUBLIC publishable
 * key as the "Stripe is wired" signal. Until then, upgrades open the waitlist.
 */
const billingLive = flags.billingLive || !!env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

function DepthMeter({ level }: { level: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Understanding depth ${level} of 3`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-7 rounded-full transition-colors",
            i <= level ? "bg-gradient-to-r from-orange-500 to-orange-400" : "bg-line",
          )}
        />
      ))}
    </div>
  );
}

export default function BillingPage() {
  const { plan, isFounder, startUpgrade, openPortal } = useSubscription();
  const { email } = useAuth();
  const [waitlistPlan, setWaitlistPlan] = useState<"pro" | "max" | null>(null);

  function onUpgradeClick(target: PlanId) {
    if (target === "free") return;
    if (billingLive) {
      void startUpgrade(target, email ?? undefined); // Stripe checkout — intact for launch
    } else if (!isFounder) {
      setWaitlistPlan(target); // payments not live yet — waitlist instead
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="flex flex-col items-center text-center">
        <SynapseOrb size={64} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">How well should Synapse understand you?</h1>
        <p className="mt-2 max-w-xl text-muted">
          Every plan is the same Synapse — the difference is how deeply it gets to know you. Start free for as long as you like, and go deeper when the understanding is worth it.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const current = plan === id;
          return (
            <Card key={id} className={cn("relative flex flex-col overflow-hidden sa-card-hover", p.popular && "ring-2 ring-orange-400", current && "ring-2 ring-navy-400")}>
              {p.popular && <div className="absolute right-3 top-3 rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">Most popular</div>}
              <div className={cn("flex flex-1 flex-col", p.popular && "mesh")}>
                <CardBody className="flex flex-1 flex-col">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">{p.name}{id === "max" && <Sparkles className="h-4 w-4 text-orange-500" />}</h2>
                  <div className="mt-2.5"><DepthMeter level={p.depthLevel} /></div>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-ink">{p.understanding}</p>

                  <p className="mt-4 text-3xl font-semibold text-ink">{p.priceLabel}{p.cadence === "monthly" && <span className="text-base font-normal text-muted">/mo</span>}</p>
                  <p className="text-sm text-muted">{p.priceSubLabel}</p>

                  <ul className="mt-5 flex-1 space-y-2">
                    {p.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm text-ink"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {h}</li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    {current ? (
                      id === "free"
                        ? <Button variant="outline" className="w-full" disabled>Your plan</Button>
                        : <Button variant="outline" className="w-full" onClick={openPortal}>Manage billing</Button>
                    ) : id === "free" ? (
                      <Button variant="ghost" className="w-full" disabled>Included</Button>
                    ) : (
                      <Button className="w-full" onClick={() => onUpgradeClick(id)}>{plan === "max" ? "Switch to " + p.name : "Upgrade to " + p.name}</Button>
                    )}
                  </div>
                </CardBody>
              </div>
            </Card>
          );
        })}
      </div>

      {/* What Synapse can do at each tier */}
      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">What Synapse can do at each tier</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-5 py-3 font-medium text-muted">Capability</th>
                  {PLAN_ORDER.map((id) => (
                    <th key={id} className={cn("px-4 py-3 text-center font-semibold", plan === id ? "text-orange-600" : "text-ink")}>
                      {PLANS[id].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ORDER.map((f) => (
                  <tr key={f} className="border-b last:border-0">
                    <td className="px-5 py-3 text-ink">{FEATURE_LABELS[f]}</td>
                    {PLAN_ORDER.map((id) => (
                      <td key={id} className="px-4 py-3 text-center">
                        {planAllows(id as PlanId, f)
                          ? <Check className="mx-auto h-4 w-4 text-emerald-600" />
                          : <Minus className="mx-auto h-4 w-4 text-line" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <p className="text-center text-xs text-muted">
        {billingLive
          ? "Secure payments via Stripe. We'll email a receipt, a heads-up before each renewal, and a gentle nudge if a payment needs attention — never spam."
          : "Payments open soon via Stripe. Join the waitlist and you'll be first in, at launch pricing — never spam."}
      </p>

      <WaitlistDialog
        plan={waitlistPlan ?? "pro"}
        open={waitlistPlan !== null}
        onClose={() => setWaitlistPlan(null)}
        defaultEmail={email}
      />
    </div>
  );
}
