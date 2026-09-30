import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { env } from "@/env";
import { rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Start the Pro ($10/mo) upgrade. Returns a Checkout URL to redirect to. */
export async function POST(req: Request) {
  if (rateLimited(req, "checkout", 10, 60_000)) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  let plan: "pro" | "max" = "pro";
  try {
    ({ plan } = await req.json());
  } catch {
    /* body optional */
  }
  try {
    // We do NOT accept a client-supplied email — Stripe Checkout collects and verifies it itself, so
    // nobody can spin up sessions prefilled with someone else's address.
    const { url, mock } = await createCheckoutSession({
      plan: plan === "max" ? "max" : "pro",
      successUrl: `${env.NEXT_PUBLIC_APP_URL}/billing?status=success`,
      cancelUrl: `${env.NEXT_PUBLIC_APP_URL}/billing?status=cancelled`,
    });
    return NextResponse.json({ url, mock });
  } catch (err) {
    console.error("[billing] checkout error", err);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
