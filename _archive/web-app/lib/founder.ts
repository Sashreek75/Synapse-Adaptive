import { env } from "@/env";

/**
 * Founder accounts get Max for free. Set NEXT_PUBLIC_FOUNDER_EMAILS in .env.local
 * to the exact email(s) you sign in with (comma-separated). Everyone else follows
 * normal plan + paywall rules.
 */
const FOUNDERS = (env.NEXT_PUBLIC_FOUNDER_EMAILS || "")
  .toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

export function isFounder(email?: string | null): boolean {
  return !!email && FOUNDERS.includes(email.toLowerCase());
}
