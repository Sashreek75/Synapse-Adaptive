import { NextResponse } from "next/server";
import { createPortalSession } from "@/lib/billing/stripe";
import { env, flags } from "@/env";

export const runtime = "nodejs";

/**
 * Open the Stripe Billing Portal so the user can manage or cancel Pro.
 * SECURITY: we must NEVER accept a Stripe customer id from the client (that would let anyone open
 * another customer's portal — an IDOR). The customer id must be derived server-side from the
 * authenticated user's stored Stripe mapping. That mapping isn't persisted yet, so while billing is
 * live this returns 501 until it's wired; in mock mode it just returns the settings page.
 */
export async function POST() {
  if (!flags.billingLive) {
    // Mock mode: no real portal to open — send them back to settings.
    const { url } = await createPortalSession({ customerId: "cus_demo", returnUrl: `${env.NEXT_PUBLIC_APP_URL}/settings` });
    return NextResponse.json({ url, mock: true });
  }
  return NextResponse.json(
    { error: "Billing management isn't available yet — email support and we'll handle it." },
    { status: 501 },
  );
}
