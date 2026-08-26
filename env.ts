import { z } from "zod";

/**
 * Validated environment. Never read process.env directly elsewhere.
 * The app runs fully WITHOUT keys (device mode + deterministic AI fallback).
 * Each integration switches on by adding its key — no code changes.
 */
const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_FOUNDER_EMAILS: z.string().default("support@compliancewatchdog.com"),

  // AI — Google Gemini (free tier)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
  GEMINI_FAST_MODEL: z.string().default("gemini-2.0-flash-lite"),

  // Auth + DB (Supabase) — Google login
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  /** Server-only admin key (waitlist API + scripts). Never NEXT_PUBLIC, never in the client. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  /** Password that unlocks the founder admin dashboard (server-verified). Override in prod. */
  ADMIN_PASSWORD: z.string().default("synapseisthebest"),

  // Billing (Stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_MAX: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Synapse Adaptive <hello@synapseadaptive.com>"),

  // Web Push (VAPID) — lets Synapse reach out first via OS notifications, even when its tab is closed.
  // Generate a keypair with `npx web-push generate-vapid-keys`. Public key is exposed to the client.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:support@compliancewatchdog.com"),
  /** Shared secret the scheduler endpoint requires, so only your cron can trigger sends. */
  CRON_SECRET: z.string().optional(),
});

export const env = schema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_FOUNDER_EMAILS: process.env.NEXT_PUBLIC_FOUNDER_EMAILS,
  GEMINI_API_KEY:
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_FAST_MODEL: process.env.GEMINI_FAST_MODEL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO,
  STRIPE_PRICE_MAX: process.env.STRIPE_PRICE_MAX,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  CRON_SECRET: process.env.CRON_SECRET,
});

export const flags = {
  aiLive: !!env.GEMINI_API_KEY,
  authLive: !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  billingLive: !!env.STRIPE_SECRET_KEY && !!env.STRIPE_PRICE_PRO,
  emailLive: !!env.RESEND_API_KEY,
  pushLive: !!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY,
};
