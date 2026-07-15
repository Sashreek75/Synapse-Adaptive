import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/billing/stripe";
import { env } from "@/env";
import {
  sendEmail,
  receiptEmail,
  paymentFailedEmail,
  renewalReminderEmail,
  upgradeNudgeEmail,
} from "@/lib/email";

export const runtime = "nodejs";

/**
 * Stripe webhook — the system of record for subscription state and the engine
 * behind "contact them when they need to pay". Stripe drives the lifecycle:
 *
 *   invoice.upcoming           → renewal reminder (a few days before charge)
 *   invoice.payment_succeeded  → receipt
 *   invoice.payment_failed     → "update your card" (access preserved)
 *   checkout.session.completed → entitlement → Pro  (+ later, upgrade nudges)
 *   customer.subscription.deleted → entitlement → Free
 *
 * In production each case also updates the user's plan in the DB (Supabase).
 * Here we focus on the messaging + entitlement seam, which is the hard part.
 */
export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: any;
  try {
    event = verifyWebhook(payload, sig);
  } catch (err) {
    console.error("[billing] webhook verify failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const obj = event?.data?.object ?? {};
  const name: string = obj.customer_name || obj.customer_details?.name || "there";
  const email: string | undefined = obj.customer_email || obj.customer_details?.email;
  const manageUrl = `${env.NEXT_PUBLIC_APP_URL}/settings`;

  try {
    switch (event?.type) {
      case "invoice.upcoming":
        if (email)
          await sendEmail(
            email,
            renewalReminderEmail({
              name,
              renewsOn: new Date((obj.next_payment_attempt ?? Date.now() / 1000) * 1000).toLocaleDateString(),
              manageUrl,
            }),
          );
        break;
      case "invoice.payment_succeeded":
        if (email)
          await sendEmail(
            email,
            receiptEmail({
              name,
              amount: obj.amount_paid ? `$${(obj.amount_paid / 100).toFixed(2)}` : "$10.00",
              date: new Date().toLocaleDateString(),
              manageUrl,
            }),
          );
        break;
      case "invoice.payment_failed":
        if (email) await sendEmail(email, paymentFailedEmail({ name, updateUrl: manageUrl }));
        break;
      case "checkout.session.completed":
        // TODO(persistence): set user plan = "pro", store stripe customer id.
        console.info("[billing] checkout completed → entitle Pro", obj.customer);
        break;
      case "customer.subscription.deleted":
        // TODO(persistence): set user plan = "free".
        console.info("[billing] subscription cancelled → downgrade to Free");
        break;
      case "synapse.upgrade_nudge": // internal trigger (e.g. from a scheduled job)
        if (email) await sendEmail(email, upgradeNudgeEmail({ name, upgradeUrl: `${env.NEXT_PUBLIC_APP_URL}/billing` }));
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[billing] handler error", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
