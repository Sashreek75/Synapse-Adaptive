import "server-only";

/**
 * Tiny in-memory rate limiter for API routes. Not distributed (per serverless instance), so it's a
 * mitigation — not a hard guarantee — against cost/DoS abuse of the unauthenticated model endpoints
 * and brute-force of the admin endpoint. For a hard guarantee across instances, back this with a
 * shared store (Upstash/Redis) later; the call sites don't change.
 */

interface Bucket { count: number; reset: number }
const store = new Map<string, Bucket>();
let lastSweep = 0;

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

/** Returns true if the request is OVER the limit (should be rejected with 429). */
export function rateLimited(req: Request, name: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  // Occasional cleanup so the map can't grow unbounded.
  if (now - lastSweep > 60_000) { lastSweep = now; for (const [k, b] of store) if (now > b.reset) store.delete(k); }

  const key = `${name}:${clientIp(req)}`;
  const b = store.get(key);
  if (!b || now > b.reset) { store.set(key, { count: 1, reset: now + windowMs }); return false; }
  b.count++;
  return b.count > limit;
}
