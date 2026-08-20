"use client";

/**
 * ORB DUST — a canvas particle animation for the intro. Orange and navy-blue "powder" fades in
 * around a circle, swirls with waves and swooshes (a vortex of glowing motes), then spirals inward
 * and condenses into a hot point — right as the Synapse orb is revealed on top of it. Additive
 * ("lighter") blending makes the motes glow and pile into white-hot light at the moment of lock-in.
 * Respects prefers-reduced-motion (draws a single calm ring instead of animating).
 */

import { useEffect, useRef } from "react";

const smoothstep = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The moment the dust has fully collapsed into the orb (seconds from mount).
const CONDENSE_END = 3.4;

export function OrbDust({ size = 380 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.34; // ring radius

    const N = 210;
    const ORANGE: [number, number, number] = [255, 150, 55];
    const NAVY: [number, number, number] = [86, 148, 240];

    type P = {
      ang0: number; radJit: number; orbSpeed: number; waveAmp: number;
      waveFreq: number; wavePhase: number; sz: number; col: [number, number, number];
      px: number; py: number; hasPrev: boolean;
    };
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const ps: P[] = Array.from({ length: N }).map((_, i) => ({
      ang0: Math.random() * Math.PI * 2,
      radJit: rand(-0.16, 0.16),
      orbSpeed: rand(0.7, 1.25),
      waveAmp: R * rand(0.05, 0.16),
      waveFreq: rand(1.4, 3.6),
      wavePhase: Math.random() * Math.PI * 2,
      sz: rand(1.1, 2.8),
      col: i % 5 < 3 ? ORANGE : NAVY, // slight orange majority
      px: 0, py: 0, hasPrev: false,
    }));

    const posAt = (p: P, t: number) => {
      const formT = smoothstep(t, 0, 0.95);
      const condenseT = smoothstep(t, 2.3, CONDENSE_END);
      const scatterR = R * 2.3;
      const ringR = R * (1 + p.radJit);
      let r = scatterR + (ringR - scatterR) * formT;
      // waves + swooshes while it swirls (damped as it condenses)
      r += p.waveAmp * Math.sin(t * p.waveFreq + p.wavePhase) * formT * (1 - condenseT);
      // spiral inward to a near-point
      r = r + (R * 0.03 - r) * Math.pow(condenseT, 1.5);
      // spin faster as it collapses
      const ang = p.ang0 + t * p.orbSpeed * (1 + condenseT * 2.4);
      return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
    };

    const dot = (x: number, y: number, r: number, col: [number, number, number], a: number) => {
      const [cr, cg, cb] = col;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      // soft halo
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * 0.22})`;
      ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
    };

    const drawFrame = (t: number) => {
      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = "lighter";

      const formIn = smoothstep(t, 0, 0.9);
      const fadeOut = 1 - smoothstep(t, 3.15, 3.55);
      const condenseT = smoothstep(t, 2.3, CONDENSE_END);
      const bright = 0.55 + 0.65 * condenseT;

      for (const p of ps) {
        const { x, y } = posAt(p, t);
        const a = Math.min(1, 0.9 * formIn * fadeOut);
        // swoosh trail from previous position
        if (p.hasPrev) {
          const [cr, cg, cb] = p.col;
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${a * 0.4})`;
          ctx.lineWidth = p.sz;
          ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(x, y); ctx.stroke();
        }
        dot(x, y, p.sz, p.col, Math.min(1, a * bright));
        p.px = x; p.py = y; p.hasPrev = true;
      }

      // central bloom that swells as everything collapses — the bridge into the orb
      if (condenseT > 0) {
        const br = R * (0.12 + condenseT * 0.7);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, br);
        g.addColorStop(0, `rgba(255,225,180,${0.9 * condenseT * fadeOut})`);
        g.addColorStop(0.4, `rgba(255,150,60,${0.5 * condenseT * fadeOut})`);
        g.addColorStop(1, "rgba(120,150,230,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, br, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const reduced = typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      drawFrame(1.4); // a calm formed ring, no motion
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }

    const start = performance.now();
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      drawFrame(t);
      if (t < 4.2) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [size]);

  return <canvas ref={canvasRef} aria-hidden style={{ width: size, height: size }} className="pointer-events-none" />;
}
