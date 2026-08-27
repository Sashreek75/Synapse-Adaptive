"use client";

/**
 * REACH-OUT CATCH-UP — the offline safety net.
 *
 * If a reach-out came due while the computer was closed, the push service may or may not deliver it
 * on reconnect. This makes it reliable: whenever the app opens (or regains focus), it asks the server
 * for reach-outs whose time already passed, and shows any it hasn't shown on THIS device yet —
 * noting that it was delayed because the computer was off. Renders nothing.
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
          const lateMin = Math.round((now - fired) / 60000);
          // Under ~3 min late it likely arrived on time via push — don't double-alert.
          if (lateMin < 3) { shown.push(it.id); changed = true; continue; }

          const body = `${it.body}\n(Delayed — your computer was off; this was ${delayPhrase(lateMin)}.)`;
          await reg.showNotification(it.title || "Synapse", {
            body,
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
    const onVis = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return null;
}
