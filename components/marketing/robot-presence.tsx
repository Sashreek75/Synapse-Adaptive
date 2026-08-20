"use client";

/**
 * ROBOT PRESENCE — the CSS robot (no image) rendered very large and very faint behind the landing
 * content. It stays invisible over the hero and fades in only once you scroll past the first section,
 * reading as an underlying presence — its limbs drift subtly. pointer-events-none + aria-hidden.
 */

import { useEffect, useState } from "react";
import { CssRobot } from "@/components/marketing/css-robot";

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

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ opacity: reveal, transition: "opacity .6s ease" }}>
      <div className="absolute right-[-4%] top-1/2" style={{ transform: "translateY(-50%) scale(2.7)", opacity: 0.1 }}>
        <CssRobot />
      </div>
    </div>
  );
}
