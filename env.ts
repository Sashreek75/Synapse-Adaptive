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

  // Billing (Stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_MAX: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Synapse Adaptive <hello@synapseadaptive.com>"),
});

export const env = schema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_FOUNDER_EMAILS: process.env.NEXT_PUBLIC_FOUNDER_EMAILS,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  GEMINI_FAST_MODEL: process.env.GEMINI_FAST_MODEL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO,
  STRIPE_PRICE_MAX: process.env.STRIPE_PRICE_MAX,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
});

export const flags = {
  aiLive: !!env.GEMINI_API_KEY,
  authLive: !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  billingLive: !!env.STRIPE_SECRET_KEY && !!env.STRIPE_PRICE_PRO,
  emailLive: !!env.RESEND_API_KEY,
};
