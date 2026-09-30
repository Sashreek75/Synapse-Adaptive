"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { FeatureKey, PlanId } from "@/lib/billing/plans";
import { planAllows } from "@/lib/billing/plans";
import { useAuth } from "@/components/providers/auth-provider";
import { isFounder } from "@/lib/founder";

/**
 * Subscription/entitlement context for the client UI.
 *
 * In production the active plan comes from the server (Supabase, updated by the
 * Stripe webhook) — never trusted from the client. For this keyless demo we
 * persist the tier locally and treat the post-checkout redirect as an upgrade,
 * so the entire gated-features experience is explorable offline. The gating API
 * (`useSubscription().allows`) is identical either way.
 */
interface Ctx {
  plan: PlanId;
  isFounder: boolean;
  hydrated: boolean;
  allows: (feature: FeatureKey) => boolean;
  startUpgrade: (plan?: PlanId, email?: string) => Promise<void>;
  openPortal: () => Promise<void>;
  setPlanLocal: (p: PlanId) => void;
}

const SubscriptionContext = createContext<Ctx | null>(null);
const KEY = "synapse.plan.v1";

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { email } = useAuth();
  const founder = isFounder(email);
  const [storedPlan, setPlan] = useState<PlanId>("free");
  const [hydrated, setHydrated] = useState(false);
  const plan: PlanId = founder ? "max" : storedPlan;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY) as PlanId | null;
      if (stored) setPlan(stored);
      // Treat a successful (or mock) checkout redirect as Pro for the demo.
      const params = new URLSearchParams(window.location.search);
      if (params.get("status") === "success" || params.get("mock_upgrade") === "1") {
        const p = (params.get("plan") as PlanId) || "pro";
        setPlan(p === "max" ? "max" : "pro");
        localStorage.setItem(KEY, p === "max" ? "max" : "pro");
      }
    } catch {}
    setHydrated(true);
  }, []);

  function setPlanLocal(p: PlanId) {
    setPlan(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {}
  }

  async function startUpgrade(target: PlanId = "pro", em?: string) {
    if (founder) return; // founder already has Max
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: target, email: em }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  async function openPortal() {
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  const allows = (feature: FeatureKey) => planAllows(plan, feature);

  return (
    <SubscriptionContext.Provider value={{ plan, isFounder: founder, hydrated, allows, startUpgrade, openPortal, setPlanLocal }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
