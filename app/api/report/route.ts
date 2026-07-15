import { NextResponse } from "next/server";
import { generateReport, generateProactiveNotices } from "@/ai/pipeline";
import { goalMetricsForPath } from "@/lib/paths";
import type { PlanId } from "@/lib/billing/plans";
import type { MetricKey, MetricSeries, HealthProfile } from "@/types";

export const runtime = "nodejs";

/**
 * Generate the weekly report + proactive notices from the user's REAL data
 * (sent from the client store). Uses Gemini when configured, else the
 * deterministic coach-voice fallback. No server-side fake data anywhere.
 */
export async function POST(req: Request) {
  let profile: HealthProfile & { path?: string };
  let series: MetricSeries[];
  let tier: PlanId = "pro";
  try {
    ({ profile, series, tier = "pro" } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!series?.length) return NextResponse.json({ report: null, notices: [] });
  if (tier !== "free" && tier !== "pro" && tier !== "max") tier = "pro";

  // Proactive-pattern detection follows the user's chosen path (their lens),
  // so what Synapse watches matches what the user said they care about.
  const goalMetrics: MetricKey[] = goalMetricsForPath(profile?.path);

  const [report, notices] = await Promise.all([
    generateReport(series, profile, tier),
    generateProactiveNotices(series, goalMetrics),
  ]);
  return NextResponse.json({ report, notices });
}
