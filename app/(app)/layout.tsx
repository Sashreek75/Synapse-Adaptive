import Link from "next/link";
import { SynapseOrb } from "@/components/synapse/orb";
import { RoomsMenu } from "@/components/shell/app-nav";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { HealthProvider } from "@/components/providers/health-store";
import { SubscriptionProvider } from "@/components/providers/subscription-provider";
import { AuthGuard } from "@/components/providers/auth-gate";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { OnboardingGate } from "@/components/providers/onboarding-gate";
import { FeatureTour } from "@/components/tour/feature-tour";
import { FocusCompanion } from "@/components/focus/focus-companion";

/**
 * THE FRAME — deliberately almost nothing.
 *
 * Founding doc: "The user should never feel like they're opening software. They
 * should feel like they're opening a conversation with someone who knows them."
 * So the shell is a single calm bar (Synapse, present) and a full-height stage
 * for the conversation. No sidebar, no widget rail, no tab bar — every room lives
 * behind one quiet menu so the AI is the only thing asking for attention.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <HealthProvider>
      <SubscriptionProvider>
        <AuthGuard>
          <AnimatedBackground />
          <OnboardingGate />
          <FeatureTour />
          <div className="flex h-[100dvh] flex-col">
            <header className="sticky top-0 z-40 shrink-0 border-b glass pt-[env(safe-area-inset-top)]">
              <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:h-16 sm:px-5">
                <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold text-ink">
                  <SynapseOrb size={26} />
                  <span>Synapse</span>
                </Link>
                <div className="flex items-center gap-1">
                  <NotificationsBell />
                  <RoomsMenu />
                </div>
              </div>
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto overscroll-none">
              <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-5 sm:py-9">
                {children}
              </div>
            </main>
          </div>
          <FocusCompanion />
        </AuthGuard>
      </SubscriptionProvider>
    </HealthProvider>
  );
}
