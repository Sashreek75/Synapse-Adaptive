"use client";

/**
 * PUSH — client side. Registers the service worker, asks for notification permission, subscribes to
 * Web Push with our VAPID public key, and hands the subscription to the server so the scheduler can
 * reach this device later. Everything degrades quietly if the browser doesn't support push.
 */

import { env } from "@/env";
import { getSupabase } from "@/lib/supabase/client";

export type PushStatus = "unsupported" | "denied" | "unconfigured" | "off" | "on";

export function pushSupported(): boolean {
  return typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
}

function vapidKey(): string | null {
  return env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function accessToken(): Promise<string | null> {
  try {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  } catch { return null; }
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  return existing ?? navigator.serviceWorker.register("/sw.js");
}

/** Where we stand right now, without prompting. */
export async function currentPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  if (!vapidKey()) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? "on" : "off";
  } catch { return "off"; }
}

function serialize(sub: PushSubscription): { endpoint: string; p256dh: string; auth: string } | null {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, p256dh, auth };
}

/** Ask permission, subscribe, and register the device with the server. Returns the resulting status. */
export async function enablePush(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  const key = vapidKey();
  if (!key) return "unconfigured";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource }));

  const payload = serialize(sub);
  if (!payload) return "off";
  const token = await accessToken();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, subscription: payload, ua: navigator.userAgent }),
  });
  return res.ok ? "on" : "off";
}

/** Unsubscribe this device and tell the server to forget it. */
export async function disablePush(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      const token = await accessToken();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, endpoint }),
      });
    }
  } catch {}
  return "off";
}

/**
 * Schedule a future reach-out (called when Synapse promises to check in later). Requires the user to
 * be signed in; returns false quietly otherwise. Whether it actually arrives depends on reach-outs
 * being turned on for at least one device by fire time.
 */
export async function scheduleReachout(
  minutes: number,
  message: string,
  opts: { url?: string; title?: string; dedupeKey?: string } = {},
): Promise<boolean> {
  try {
    const token = await accessToken();
    if (!token) return false;
    const res = await fetch("/api/push/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token, minutes, body: message,
        title: opts.title || "Synapse", url: opts.url || "/dashboard", dedupeKey: opts.dedupeKey,
      }),
    });
    return res.ok;
  } catch { return false; }
}

/** Schedule a reach-out at an absolute time (used for user-requested "check on me at 7:30"). */
export async function scheduleReachoutAt(
  fireAt: Date,
  message: string,
  opts: { url?: string; title?: string; dedupeKey?: string } = {},
): Promise<boolean> {
  try {
    const token = await accessToken();
    if (!token) return false;
    const res = await fetch("/api/push/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token, fireAt: fireAt.toISOString(), body: message,
        title: opts.title || "Synapse", url: opts.url || "/dashboard", dedupeKey: opts.dedupeKey,
      }),
    });
    return res.ok;
  } catch { return false; }
}

export interface RecentReachout { id: string; title: string; body: string; url: string | null; fireAt: string }

/** Reach-outs that already came due in the last 24h (for the offline catch-up on app open). */
export async function fetchRecentReachouts(): Promise<RecentReachout[]> {
  try {
    const token = await accessToken();
    if (!token) return [];
    const res = await fetch("/api/push/recent", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { reachouts?: RecentReachout[] };
    return Array.isArray(data.reachouts) ? data.reachouts : [];
  } catch { return []; }
}

/** Fire a server-sent test notification to confirm the whole loop works. */
export async function sendTestPush(): Promise<boolean> {
  const token = await accessToken();
  const res = await fetch("/api/push/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return res.ok;
}
