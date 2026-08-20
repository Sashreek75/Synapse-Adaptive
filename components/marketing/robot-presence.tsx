"use client";

/**
 * ROBOT PRESENCE — a very faint, slowly drifting robot behind the landing content. It stays invisible
 * over the hero and fades in only once you scroll past the first section, reading as an underlying
 * presence rather than a picture. Multiply blend drops the image's white field so only a ghost of the
 * figure shows; pointer-events-none and aria-hidden keep it purely decorative.
 */

import { useEffect, useState } from "react";

export function RobotPresence() {
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const vh = window.innerHeight || 800;
      const y = window.scrollY;
      // Invisible through the hero (~0.7vh), ramping to full faintness by ~1.5vh.
      const t = Math.max(0, Math.min(1, (y - vh * 0.7) / (vh * 0.8)));
      setReveal(t);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ opacity: reveal, transition: "opacity .6s ease" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/robot.png"
        alt=""
        className="sa-robot absolute right-[-6%] top-1/2 w-[42vw] max-w-[640px] select-none"
        style={{ mixBlendMode: "multiply", opacity: 0.12 }}
      />
    </div>
  );
}
