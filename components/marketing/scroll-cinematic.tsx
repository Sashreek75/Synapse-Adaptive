"use client";

/**
 * SCROLL CINEMATIC (Three.js) — a 3-act opening, all built from particles (no images):
 *   ACT 1  Scattered, swirling neurons COALESCE into a glowing brain (blue web + orange synapses).
 *   ACT 2  You whoosh INSIDE — flying through the neuron network toward a bright orange synapse.
 *   ACT 3  Zoom into that orange light; it blooms and "Synapse" arrives.
 * Corner words POP in, one at a time, in different corners. Scroll is the scrubber (~3 scrolls end-to-
 * end). Perf-guarded (pixel-ratio capped, paused off-screen, disposed), reduced-motion aware.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

const smooth = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function glowTexture(): THREE.Texture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.6, "rgba(255,255,255,0.25)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

// Each pops at its scroll point, in its own corner. Bright and quick — "out of nowhere".
const WORDS: { t: string; cls: string; at: number }[] = [
  { t: "Focus", cls: "top-10 left-8", at: 0.06 },
  { t: "Discipline", cls: "top-10 right-8", at: 0.17 },
  { t: "Momentum", cls: "bottom-12 right-8", at: 0.28 },
  { t: "Consistency", cls: "bottom-12 left-8", at: 0.39 },
  { t: "Clarity", cls: "top-1/3 left-9", at: 0.50 },
  { t: "Follow-through", cls: "bottom-1/3 right-9", at: 0.60 },
];

export function ScrollCinematic() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;

    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.innerWidth < 768;

    const D = 900;                 // brain center at z = -D
    const CAM_START = 150;
    const CAM_NEAR = -D + 170;     // inside the network
    const CAM_END = -D + 95;       // zoomed near the orange synapse light
    const N = mobile ? 1100 : 2300;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: !mobile, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x04070d, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04070d, 0.0011);
    const camera = new THREE.PerspectiveCamera(72, 1, 1, 4000);
    camera.position.set(0, 0, CAM_START);

    const tex = glowTexture();
    const blue = new THREE.Color(0x53a3ff);
    const orange = new THREE.Color(0xff8a2a);

    // scattered start + brain target for every particle
    const scatter = new Float32Array(N * 3);
    const brain = new Float32Array(N * 3);
    const pos = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const isOrange = new Uint8Array(N);

    for (let i = 0; i < N; i++) {
      // scattered floating field (RELATIVE to the brain-center group, which sits at z=-D)
      scatter[i * 3] = (Math.random() - 0.5) * 560;
      scatter[i * 3 + 1] = (Math.random() - 0.5) * 560;
      scatter[i * 3 + 2] = 260 - Math.random() * 640;

      // brain target (also RELATIVE to the group): split, wrinkled ellipsoid + a small cerebellum
      const lobe = i % 2 === 0 ? 1 : -1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      let R = 120 * (1 + 0.12 * Math.sin(6 * theta) * Math.sin(5 * phi) + 0.06 * Math.sin(9 * phi));
      let bx = Math.sin(phi) * Math.cos(theta) * R * 1.28 + lobe * 30;
      let by = Math.sin(phi) * Math.sin(theta) * R * 0.92 - 6;
      let bz = Math.cos(phi) * R * 1.02;
      if (i % 13 === 0) { // cerebellum lump, lower-back
        const r2 = 42 * Math.random();
        bx = (Math.random() - 0.5) * r2;
        by = -95 - Math.random() * 30 + (Math.random() - 0.5) * r2;
        bz = -70 - Math.random() * 30;
      }
      brain[i * 3] = bx; brain[i * 3 + 1] = by; brain[i * 3 + 2] = bz;

      const orangeNode = Math.random() < 0.17;
      isOrange[i] = orangeNode ? 1 : 0;
      const col = orangeNode ? orange : blue;
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
      pos[i * 3] = scatter[i * 3]; pos[i * 3 + 1] = scatter[i * 3 + 1]; pos[i * 3 + 2] = scatter[i * 3 + 2];
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3);
    geo.setAttribute("position", posAttr);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pointsMat = new THREE.PointsMaterial({ size: mobile ? 7 : 8.5, map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, opacity: 0.9 });
    const points = new THREE.Points(geo, pointsMat);
    points.position.set(0, 0, -D); // group centered on the brain so rotation spins in place
    scene.add(points);

    // filament web — pairs of nearby BRAIN points (drawn from the morphing positions each frame)
    const SEG = mobile ? 320 : 640;
    const pairs = new Int32Array(SEG * 2);
    for (let s = 0; s < SEG; s++) {
      const a = (Math.random() * N) | 0;
      let b = a, best = Infinity;
      for (let k = 0; k < 6; k++) {
        const cand = (Math.random() * N) | 0;
        const dx = brain[a * 3] - brain[cand * 3], dy = brain[a * 3 + 1] - brain[cand * 3 + 1], dz = brain[a * 3 + 2] - brain[cand * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (cand !== a && d < best) { best = d; b = cand; }
      }
      pairs[s * 2] = a; pairs[s * 2 + 1] = b;
    }
    const linePos = new Float32Array(SEG * 6);
    const lineGeo = new THREE.BufferGeometry();
    const lineAttr = new THREE.BufferAttribute(linePos, 3);
    lineGeo.setAttribute("position", lineAttr);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x3f7fe0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    lines.position.set(0, 0, -D);
    scene.add(lines);

    // the orange synapse LIGHT we fly into
    const lightGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff9a2e, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    lightGlow.scale.set(240, 240, 1); lightGlow.position.set(0, 0, -D);
    scene.add(lightGlow);
    const lightCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    lightCore.scale.set(80, 80, 1); lightCore.position.set(0, 0, -D);
    scene.add(lightCore);

    let W = 0, H = 0;
    const resize = () => { W = window.innerWidth; H = window.innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); };
    resize();
    window.addEventListener("resize", resize);

    const progress = (): number => {
      const r = section.getBoundingClientRect();
      const scrollable = r.height - window.innerHeight;
      if (scrollable <= 0) return 0;
      return Math.min(1, Math.max(0, -r.top / scrollable));
    };

    const camZ = (p: number) => {
      if (p < 0.30) return CAM_START;
      if (p < 0.80) return lerp(CAM_START, CAM_NEAR, smooth(p, 0.30, 0.80));
      return lerp(CAM_NEAR, CAM_END, smooth(p, 0.80, 1));
    };

    const render = (p: number, t: number) => {
      const morph = smooth(p, 0.03, 0.30); // scattered → brain

      // morph particle positions
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        pos[j] = lerp(scatter[j], brain[j], morph);
        pos[j + 1] = lerp(scatter[j + 1], brain[j + 1], morph);
        pos[j + 2] = lerp(scatter[j + 2], brain[j + 2], morph);
      }
      posAttr.needsUpdate = true;
      // filaments follow (only meaningful once formed)
      for (let s = 0; s < SEG; s++) {
        const a = pairs[s * 2] * 3, b = pairs[s * 2 + 1] * 3;
        const o = s * 6;
        linePos[o] = pos[a]; linePos[o + 1] = pos[a + 1]; linePos[o + 2] = pos[a + 2];
        linePos[o + 3] = pos[b]; linePos[o + 4] = pos[b + 1]; linePos[o + 5] = pos[b + 2];
      }
      lineAttr.needsUpdate = true;

      // gentle life — swirl fastest while scattered, eases as the brain forms (never reverses)
      points.rotation.y = t * 0.05 * (1 - 0.6 * morph);
      lines.rotation.y = points.rotation.y;

      camera.position.z = camZ(p);
      camera.position.x = Math.sin(t * 0.35) * 6;
      camera.position.y = Math.cos(t * 0.3) * 4;
      camera.lookAt(0, 0, -D);

      const fadeField = 1 - smooth(p, 0.9, 1);
      pointsMat.opacity = 0.9 * fadeField;
      lineMat.opacity = 0.22 * morph * fadeField;

      const arrive = smooth(p, 0.8, 1);
      (lightGlow.material as THREE.SpriteMaterial).opacity = Math.max(morph * 0.25, arrive) * 0.85;
      (lightCore.material as THREE.SpriteMaterial).opacity = arrive * 0.6;

      renderer.render(scene, camera);

      if (titleRef.current) titleRef.current.style.opacity = String(smooth(p, 0.9, 0.99));
      for (let i = 0; i < WORDS.length; i++) {
        const el = wordRefs.current[i]; if (!el) continue;
        const s = WORDS[i].at;
        const op = smooth(p, s, s + 0.02) * (1 - smooth(p, s + 0.09, s + 0.15));
        el.style.opacity = String(op);
        el.style.transform = `scale(${0.6 + 0.4 * smooth(p, s, s + 0.04)})`;
      }
    };

    let visible = true;
    const start = performance.now();
    const loop = () => {
      if (!visible) { rafRef.current = null; return; }
      render(progress(), (performance.now() - start) / 1000);
      rafRef.current = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !reduced && rafRef.current == null) loop(); }, { threshold: 0 });
    io.observe(section);

    if (reduced) render(0.95, 0); else loop();

    return () => {
      window.removeEventListener("resize", resize);
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      geo.dispose(); pointsMat.dispose(); lineGeo.dispose(); lineMat.dispose();
      (lightGlow.material as THREE.Material).dispose(); (lightCore.material as THREE.Material).dispose();
      tex.dispose(); renderer.dispose();
    };
  }, []);

  return (
    <section ref={sectionRef} aria-hidden className="relative h-[340vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#04070d]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* words that pop, one at a time, in their own corner */}
        {WORDS.map((w, i) => (
          <span
            key={w.t}
            ref={(el) => { wordRefs.current[i] = el; }}
            className={`pointer-events-none absolute ${w.cls} text-sm font-semibold uppercase tracking-[0.35em] text-white/80 sm:text-base`}
            style={{ opacity: 0 }}
          >
            {w.t}
          </span>
        ))}

        <div ref={titleRef} className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center opacity-0">
          <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(42% 42% at 50% 48%, rgba(4,7,13,0.62), transparent 72%)" }} />
          <div className="relative" style={{ textShadow: "0 2px 26px rgba(0,0,0,0.9), 0 0 70px rgba(0,0,0,0.7)" }}>
            <div className="text-5xl font-semibold tracking-tight text-white sm:text-7xl">Synapse</div>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/90 sm:text-lg">An AI that learns how you actually operate — and stays on the hook until intention becomes done.</p>
            <p className="mt-8 text-xs uppercase tracking-[0.35em] text-white/60">Keep scrolling</p>
          </div>
        </div>
      </div>
    </section>
  );
}
