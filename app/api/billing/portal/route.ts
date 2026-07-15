import { NextResponse } from "next/server";
import { createPortalSession } from "@/lib/billing/stripe";
import { env } from "@/env";

export const runtime = "nodejs";

/** Open the Stripe Billing Portal so the user can manage or cancel Pro. */
export async function POST(req: Request) {
  let customerId = "";
  try {
    ({ customerId } = await req.json());
  } catch {
    /* optional */
  }
  try {
    const { url } = await createPortalSession({
      customerId: customerId || "cus_demo",
      returnUrl: `${env.NEXT_PUBLIC_APP_URL}/settings`,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[billing] portal error", err);
    return NextResponse.json({ error: "Could not open billing portal" }, { status: 500 });
  }
}
