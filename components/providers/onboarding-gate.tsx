"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHealth } from "@/components/providers/health-store";

/**
 * New users must complete the onboarding quiz first. Until profile.onboardedAt
 * is set, every app route redirects to /onboarding. After it's set, the tour
 * (FeatureTour) takes over on the dashboard.
 */
export function OnboardingGate() {
  const { hydrated, profile } = useHealth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (!profile.onboardedAt && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [hydrated, profile.onboardedAt, pathname, router]);

  return null;
}
