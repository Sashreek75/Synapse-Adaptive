import "server-only";
import crypto from "crypto";
import { env, flags } from "@/env";

/**
 * Server-only Stripe wrapper. Uses Stripe's REST API via fetch (no SDK
 * dependency) so it is genuinely functional once you set STRIPE_SECRET_KEY +
 * STRIPE_PRICE_PRO. Without keys it runs in MOCK mode: checkout "succeeds"
 * locally so you can exercise the entire upgrade → gated-features flow offline.
 */

const API = "https://api.stripe.com/v1";

function form(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

async function stripePost(path: string, params: Record<string, string>) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form(params),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Stripe ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface CheckoutResult {
  url: string;
  mock: boolean;
}

/** Create a subscription Checkout Session for the $10/mo Pro plan. */
export async function createCheckoutSession(opts: {
  email?: string;
  plan?: "pro" | "max";
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutResult> {
  if (!flags.billingLive) {
    // MOCK: bounce back to billing with a flag the client treats as "upgraded".
    const url = new URL(opts.successUrl);
    url.searchParams.set("mock_upgrade", "1");
    url.searchParams.set("plan", opts.plan ?? "pro");
    return { url: url.toString(), mock: true };
  }
  const session = await stripePost("/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": (opts.plan === "max" ? env.STRIPE_PRICE_MAX : env.STRIPE_PRICE_PRO) as string,
    "line_items[0][quantity]": "1",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    ...(opts.email ? { customer_email: opts.email } : {}),
    allow_promotion_codes: "true",
  });
  return { url: session.url as string, mock: false };
}

/** Create a Billing Portal session so users manage/cancel their subscription. */
export async function createPortalSession(opts: {
  customerId: string;
  returnUrl: string;
}): Promise<CheckoutResult> {
  if (!flags.billingLive) return { url: opts.returnUrl, mock: true };
  const session = await stripePost("/billing_portal/sessions", {
    customer: opts.customerId,
    return_url: opts.returnUrl,
  });
  return { url: session.url as string, mock: false };
}

/**
 * Verify a Stripe webhook signature (production-correct, dependency-free).
 * Implements Stripe's `t=...,v1=...` scheme with HMAC-SHA256.
 */
export function verifyWebhook(payload: string, sigHeader: string | null): unknown {
  if (!flags.billingLive || !env.STRIPE_WEBHOOK_SECRET) {
    // MOCK: accept and parse so local webhook simulation works.
    return JSON.parse(payload);
  }
  if (!sigHeader) throw new Error("Missing Stripe-Signature header");
  const parts = Object.fromEntries(sigHeader.split(",").map((kv) => kv.split("=")));
  const timestamp = parts["t"];
  const expected = crypto
    .createHmac("sha256", env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const provided = parts["v1"] ?? "";
  const ok =
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) throw new Error("Invalid Stripe signature");
  return JSON.parse(payload);
}
