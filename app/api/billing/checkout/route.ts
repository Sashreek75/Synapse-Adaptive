import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/billing/stripe";
import { env } from "@/env";

export const runtime = "nodejs";

/** Start the Pro ($10/mo) upgrade. Returns a Checkout URL to redirect to. */
export async function POST(req: Request) {
  let email: string | undefined;
  let plan: "pro" | "max" = "pro";
  try {
    ({ email, plan } = await req.json());
  } catch {
    /* body optional */
  }
  try {
    const { url, mock } = await createCheckoutSession({
      email,
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
