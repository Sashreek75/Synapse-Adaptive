"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { SynapseOrb } from "@/components/synapse/orb";
import { flags } from "@/env";

/**
 * Route protection for the signed-in app.
 *
 * When Supabase auth is configured (flags.authLive), every /(app) route requires
 * a live session. The moment the user signs out — or lands here without a session —
 * we send them back to the landing page AND withhold the protected UI so their data
 * never flashes on screen. This is what makes "Sign out" actually mean something:
 * no lingering on the dashboard, no seeing your data while logged out.
 *
 * In device mode (no Supabase keys) there is no account to sign in/out of, so the
 * gate stays out of the way and the app remains fully usable offline.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { ready, email } = useAuth();
  const router = useRouter();

  const blocked = flags.authLive && ready && !email;

  useEffect(() => {
    if (blocked) router.replace("/"); // signed out (or never signed in) → landing
  }, [blocked, router]);

  // Auth is live but we don't yet have a confirmed session: render a calm
  // placeholder instead of the dashboard, so protected data is never shown.
  if (flags.authLive && (!ready || !email)) {
    return (
      <div className="grid min-h-screen place-items-center">
        <SynapseOrb size={64} state="thinking" />
      </div>
    );
  }

  return <>{children}</>;
}
