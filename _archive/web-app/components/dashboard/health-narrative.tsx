"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardBody, Skeleton } from "@/components/ui/primitives";
import { useHealth } from "@/components/providers/health-store";

/** Shows the AI Health Profile narrative; generates it once after onboarding. */
export function HealthNarrative() {
  const { profile, saveProfile, hydrated } = useHealth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hydrated || !profile.onboardedAt || profile.aiSummary) return;
    let active = true; setLoading(true);
    fetch("/api/profile-summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile }) })
      .then((r) => r.json())
      .then((d) => { if (active && d.summary) saveProfile({ aiSummary: d.summary }); })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, profile.onboardedAt, profile.aiSummary]);

  if (!profile.onboardedAt) return null;
  if (!profile.aiSummary) return loading ? <Skeleton className="h-24 w-full rounded-2xl" /> : null;

  return (
    <Card className="sa-rise overflow-hidden">
      <div className="mesh"><CardBody>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-surface/70 px-3 py-1 text-xs font-semibold text-navy-600">
          <Sparkles className="h-3.5 w-3.5 text-orange-500" /> How Synapse sees you
        </div>
        <p className="text-lg leading-relaxed text-ink">{profile.aiSummary}</p>
      </CardBody></div>
    </Card>
  );
}
