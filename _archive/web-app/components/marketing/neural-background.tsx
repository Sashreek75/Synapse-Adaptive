"use client";

import { useEffect, useRef } from "react";

/**
 * NEURAL BACKGROUND — the landing hero's signature visual.
 *
 * A brain, drawn as a living point-cloud network: nodes sampled inside a brain
 * silhouette, connected by proximity links, with synaptic pulses firing between
 * them — and neurons that break away, flow outward, and connect to the ambient
 * field around the headline. Pure canvas, no libraries.
 *
 * - Theme-aware (watches the `dark` class on <html>) so light mode looks right.
 * - Respects prefers-reduced-motion: renders a single static frame.
 * - Pauses when offscreen or the tab is hidden.
 *
 * `focus` places the brain center as a fraction of the canvas (0..1).
 */
export function NeuralBackground({
  className = "",
  focus = { x: 0.72, y: 0.44 },
  opacity = 1,
}: {
  className?: string;
  focus?: { x: number; y: number };
  opacity?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const canvas: HTMLCanvasElement = ref.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dark = document.documentElement.classList.contains("dark");
    let raf = 0;
    let visible = true;
    let w = 0, h = 0, dpr = 1;

    /* Brain silhouette (side profile, facing right), normalized 0..1. */
    const OUTLINE: [number, number][] = [
      [0.06, 0.52], [0.09, 0.38], [0.16, 0.26], [0.28, 0.15], [0.42, 0.09],
      [0.57, 0.07], [0.71, 0.09], [0.83, 0.15], [0.91, 0.25], [0.955, 0.37],
      [0.955, 0.49], [0.91, 0.59], [0.87, 0.63], [0.895, 0.71], [0.84, 0.80],
      [0.74, 0.83], [0.665, 0.79], [0.60, 0.84], [0.49, 0.86], [0.38, 0.82],
      [0.29, 0.79], [0.19, 0.73], [0.11, 0.64],
    ];

    interface Node { x: number; y: number; ax: number; ay: number; vx: number; vy: number; r: number; brain: boolean; }
    interface Pulse { a: Node; b: Node; t: number; speed: number; }
    interface Flow { x: number; y: number; vx: number; vy: number; life: number; max: number; trail: { x: number; y: number }[]; }

    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let flows: Flow[] = [];
    let brainPath: Path2D | null = null;
    let bx = 0, by = 0, bs = 1; // brain offset + scale
    let cx = 0, cy = 0;         // brain center (px)
    let breath = 0;

    const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

    function buildBrainPath(): Path2D {
      const p = new Path2D();
      OUTLINE.forEach(([nx, ny], i) => {
        const px = bx + nx * bs, py = by + ny * bs;
        if (i === 0) p.moveTo(px, py);
        else p.lineTo(px, py);
      });
      p.closePath();
      return p;
    }

    function seed() {
      nodes = []; pulses = []; flows = [];
      const size = Math.min(w, h) * 0.62;
      bs = size;
      bx = w * focus.x - size * 0.5;
      by = h * focus.y - size * 0.47;
      cx = bx + size * 0.5;
      cy = by + size * 0.47;
      brainPath = buildBrainPath();

      // Brain nodes — rejection-sample inside the silhouette.
      const brainCount = w < 640 ? 34 : 52;
      let guard = 0;
      while (nodes.length < brainCount && guard++ < 4000) {
        const x = bx + Math.random() * bs;
        const y = by + Math.random() * bs;
        if (ctx.isPointInPath(brainPath, x * dpr, y * dpr)) {
          nodes.push({ x, y, ax: x, ay: y, vx: 0, vy: 0, r: rand(1.2, 2.6), brain: true });
        }
      }
      // Ambient field nodes across the rest of the canvas.
      const ambientCount = w < 640 ? 16 : 26;
      for (let i = 0; i < ambientCount; i++) {
        const x = Math.random() * w, y = Math.random() * h;
        nodes.push({ x, y, ax: x, ay: y, vx: rand(-0.08, 0.08), vy: rand(-0.06, 0.06), r: rand(1, 2), brain: false });
      }
      // Synaptic pulses between nearby brain nodes.
      const brainNodes = nodes.filter((n) => n.brain);
      for (let i = 0; i < 7; i++) {
        const a = brainNodes[Math.floor(Math.random() * brainNodes.length)];
        if (!a) break;
        const near = brainNodes.filter((n) => n !== a && dist(a, n) < bs * 0.28);
        if (near.length) pulses.push({ a, b: near[Math.floor(Math.random() * near.length)], t: Math.random(), speed: rand(0.004, 0.011) });
      }
    }

    function spawnFlow() {
      const brainNodes = nodes.filter((n) => n.brain);
      if (!brainNodes.length) return;
      const src = brainNodes[Math.floor(Math.random() * brainNodes.length)];
      const dx = src.x - cx, dy = src.y - cy;
      const m = Math.hypot(dx, dy) || 1;
      const sp = rand(0.35, 0.7);
      flows.push({
        x: src.x, y: src.y,
        vx: (dx / m) * sp + rand(-0.12, 0.12),
        vy: (dy / m) * sp + rand(-0.12, 0.12),
        life: 0, max: rand(340, 560), trail: [],
      });
    }

    /* Theme palettes — light mode leans navy-on-light, dark leans ice-blue. */
    function palette() {
      return dark
        ? { node: "170,199,229", link: "124,157,191", outline: "124,157,191", pulse: "251,146,60", flow: "249,115,22", nodeA: 0.75, linkK: 0.35, outlineA: 0.14 }
        : { node: "29,52,80", link: "57,82,113", outline: "57,82,113", pulse: "234,88,12", flow: "234,88,12", nodeA: 0.55, linkK: 0.22, outlineA: 0.10 };
    }

    function draw() {
      const P = palette();
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.globalAlpha = opacity;

      // Links (proximity web).
      const R_BRAIN = bs * 0.24, R_FIELD = Math.min(w, h) * 0.22;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const R = a.brain && b.brain ? R_BRAIN : R_FIELD;
          const d = dist(a, b);
          if (d > R) continue;
          const base = a.brain && b.brain ? P.linkK * 1.6 : P.linkK;
          ctx.strokeStyle = `rgba(${P.link},${((1 - d / R) * base).toFixed(3)})`;
          ctx.lineWidth = a.brain && b.brain ? 0.8 : 0.6;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }

      // Breathing brain outline — subtle, so the silhouette reads.
      if (brainPath) {
        ctx.save();
        ctx.translate(cx, cy);
        const s = 1 + Math.sin(breath) * 0.008;
        ctx.scale(s, s);
        ctx.translate(-cx, -cy);
        ctx.strokeStyle = `rgba(${P.outline},${P.outlineA})`;
        ctx.lineWidth = 1.2;
        ctx.stroke(brainPath);
        ctx.restore();
      }

      // Nodes.
      for (const n of nodes) {
        ctx.fillStyle = `rgba(${P.node},${(n.brain ? P.nodeA : P.nodeA * 0.7).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }

      // Synaptic pulses traveling along brain links.
      for (const p of pulses) {
        const x = p.a.x + (p.b.x - p.a.x) * p.t;
        const y = p.a.y + (p.b.y - p.a.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
        g.addColorStop(0, `rgba(${P.pulse},0.9)`);
        g.addColorStop(1, `rgba(${P.pulse},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      }

      // Outflowing neurons + trails + their connections to the field.
      for (const f of flows) {
        const fade = Math.min(1, Math.min(f.life / 40, (f.max - f.life) / 60));
        for (let i = 0; i < f.trail.length; i++) {
          const t = f.trail[i];
          ctx.fillStyle = `rgba(${P.flow},${(fade * 0.28 * (i / f.trail.length)).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(t.x, t.y, 1.1, 0, Math.PI * 2); ctx.fill();
        }
        let linked = 0;
        for (const n of nodes) {
          if (linked >= 2) break;
          const d = dist(f, n);
          if (d < R_FIELD * 0.7) {
            ctx.strokeStyle = `rgba(${P.flow},${(fade * (1 - d / (R_FIELD * 0.7)) * 0.4).toFixed(3)})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(n.x, n.y); ctx.stroke();
            linked++;
          }
        }
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 6);
        g.addColorStop(0, `rgba(${P.flow},${(fade * 0.95).toFixed(3)})`);
        g.addColorStop(1, `rgba(${P.flow},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(f.x, f.y, 6, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    }

    function step() {
      breath += 0.012;
      for (const n of nodes) {
        if (n.brain) {
          n.vx += (n.ax - n.x) * 0.0025 + rand(-0.02, 0.02);
          n.vy += (n.ay - n.y) * 0.0025 + rand(-0.02, 0.02);
          n.vx *= 0.94; n.vy *= 0.94;
        } else {
          if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20;
          if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;
        }
        n.x += n.vx; n.y += n.vy;
      }
      for (const p of pulses) {
        p.t += p.speed;
        if (p.t >= 1) {
          const brainNodes = nodes.filter((n) => n.brain);
          p.a = p.b;
          const near = brainNodes.filter((n) => n !== p.a && dist(p.a, n) < bs * 0.28);
          p.b = near.length ? near[Math.floor(Math.random() * near.length)] : brainNodes[Math.floor(Math.random() * brainNodes.length)];
          p.t = 0; p.speed = rand(0.004, 0.011);
        }
      }
      for (const f of flows) { f.life++; f.x += f.vx; f.y += f.vy; f.trail.push({ x: f.x, y: f.y }); if (f.trail.length > 22) f.trail.shift(); }
      flows = flows.filter((f) => f.life < f.max && f.x > -30 && f.x < w + 30 && f.y > -30 && f.y < h + 30);
      if (flows.length < (w < 640 ? 5 : 9) && Math.random() < 0.035) spawnFlow();
    }

    function frame() {
      if (!visible || document.hidden) { raf = requestAnimationFrame(frame); return; }
      step(); draw();
      raf = requestAnimationFrame(frame);
    }

    function resize() {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reduced) { for (let i = 0; i < 90; i++) step(); draw(); }
    }

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(canvas);
    const mo = new MutationObserver(() => {
      const next = document.documentElement.classList.contains("dark");
      if (next !== dark) { dark = next; if (reduced) draw(); }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    resize();
    if (!reduced) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect(); mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none ${className}`} />;
}
