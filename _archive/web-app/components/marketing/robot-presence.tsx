"use client";

/**
 * ROBOT PRESENCE — the armored mech, rendered very large and very faint behind the landing content.
 * It stays invisible over the hero and fades in only once you scroll past the first section, reading
 * as a looming presence in the dark rather than a foreground graphic. A soft radial mask melts its
 * edges into the background. pointer-events-none + aria-hidden.
 */

import { useEffect, useState } from "react";

export function RobotPresence() {
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const vh = window.innerHeight || 800;
      const y = window.scrollY;
      const t = Math.max(0, Math.min(1, (y - vh * 0.7) / (vh * 0.8)));
      setReveal(t);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const mask = "radial-gradient(58% 60% at 50% 46%, #000 50%, transparent 100%)";

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ opacity: reveal, transition: "opacity .6s ease" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mech-bg.png"
        alt=""
        className="absolute right-[-8%] top-1/2 h-[130vh] max-w-none -translate-y-1/2 select-none"
        style={{ opacity: 0.16, filter: "saturate(.9) contrast(1.05)", WebkitMaskImage: mask, maskImage: mask }}
      />
    </div>
  );
}
