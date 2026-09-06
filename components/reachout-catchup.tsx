"use client";

/**
 * REACH-OUT CATCH-UP — the safety net that makes reach-outs reliable whenever the tab is open.
 *
 * True background push (tab fully closed) is delivered by the service worker when the server cron
 * sends it. But if the cron is flaky, or the tab is OPEN-but-unfocused, that push may not surface in
 * time. So this polls the server continuously while the app is open (not only on focus), and shows any
 * due reach-out it hasn't shown on THIS device — UNLESS a push already displayed it (deduped by tag),
 * so it never double-alerts. Result: an open tab always delivers on time, focused or not. Renders nothing.
 */

import { useEffect } from "react";
import { fetchRecentReachouts } from "@/lib/push-client";

const SHOWN_KEY = "synapse.ro.shown.v1";

function loadShown(): string[] {
  try { return JSON.parse(localStorage.getItem(SHOWN_KEY) || "[]"); } catch { return []; }
}
function saveShown(ids: string[]) {
  try { localStorage.setItem(SHOWN_KEY, JSON.stringify(ids.slice(-200))); } catch {}
}

function delayPhrase(min: number): string {
  if (min < 60) return `about ${min} min late`;
  const h = Math.round(min / 60);
  if (h < 24) return `about ${h} hour${h === 1 ? "" : "s"} late`;
  return "over a day late";
}

export function ReachoutCatchup() {
  useEffect(() => {
    let running = false;

    const run = async () => {
      if (running) return;
      running = true;
      try {
        if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
        if (!("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        if (!reg) return;

        const items = await fetchRecentReachouts();
        if (!items.length) return;

        const shown = loadShown();
        const now = Date.now();
        let changed = false;

        for (const it of items) {
          if (shown.includes(it.id)) continue;
          const fired = new Date(it.fireAt).getTime();
          if (Number.isNaN(fired) || fired > now) continue;

          // If a real push already displayed this (same tag) and it's still on screen, don't double-alert.
          let already: Notification[] = [];
          try { already = await reg.getNotifications({ tag: `synapse-ro-${it.id}` }); } catch {}
          if (already.length) { shown.push(it.id); changed = true; continue; }

          const lateMin = Math.round((now - fired) / 60000);
          // Deliver promptly. Only call it out as delayed if it's meaningfully late (computer was off).
          const late = lateMin >= 3 ? `\n(Delayed — this was ${delayPhrase(lateMin)}.)` : "";
          await reg.showNotification(it.title || "Synapse", {
            body: `${it.body}${late}`,
            icon: "/icon.svg",
            badge: "/icon.svg",
            tag: `synapse-ro-${it.id}`, // same tag as the push, so it replaces rather than duplicates
            data: { url: it.url || "/dashboard" },
          });
          shown.push(it.id);
          changed = true;
        }
        if (changed) saveShown(shown);
      } finally {
        running = false;
      }
    };

    run();
    // Poll continuously while the app is open — NOT just on focus — so an open-but-unfocused tab still
    // delivers due reach-outs on time. Cheap: one small POST a minute, and it early-outs when nothing's due.
    const iv = setInterval(run, 45_000);
    const onVis = () => { if (!document.hidden) run(); };
    const onOnline = () => run();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("online", onOnline); };
  }, []);

  return null;
}
