"use client";

/**
 * SCROLL CINEMATIC (Three.js) — a 3-act opening, all built from particles (no images):
 *   ACT 1  A swirling vortex of neurons COALESCES into a glowing brain as you fly toward it.
 *   ACT 2  HERO BEAT — the whole brain (blue web + orange synapses) fills the screen, turning.
 *   ACT 3  You whoosh INSIDE, through the neuron network, and zoom into one orange synapse that
 *          blooms into light as "Synapse" arrives.
 * Composition + camera path were tuned against an offline previsualization (see notes in repo).
 * Corner words POP in, one at a time, in their own corner. Scroll scrubs it (~3 scrolls).
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

const smooth = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t; // gentle acceleration for the swoosh

function glowTexture(): THREE.Texture {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.28)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

function noise3(x: number, y: number, z: number) {
  return Math.sin(x * 0.1) * Math.cos(y * 0.11) * 0.5 + Math.sin(z * 0.09 + x * 0.03) * 0.5 + Math.sin((x + z) * 0.07) * 0.3;
}

// Each pops at its scroll point, in its own corner. Bright and quick — "out of nowhere".
const WORDS: { t: string; cls: string; at: number }[] = [
  { t: "Focus", cls: "top-10 left-8", at: 0.05 },
  { t: "Discipline", cls: "top-10 right-8", at: 0.14 },
  { t: "Momentum", cls: "bottom-12 right-8", at: 0.22 },
  { t: "Consistency", cls: "bottom-12 left-8", at: 0.30 },
  { t: "Clarity", cls: "top-1/3 left-9", at: 0.63 },
  { t: "Follow-through", cls: "bottom-1/3 right-9", at: 0.70 },
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

    const D = 900;            // brain center at z = -D
    const CAM_START = 320;    // start back in the vortex
    const HERO = -500;        // brain fills the screen (400 from center) — the "behold" beat
    const INSIDE = -815;      // flown through the surface, inside the network
    const CAM_END = -835;     // zoomed into the synapse light (light sits at ~-895)
    const N = mobile ? 1300 : 2600;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: !mobile, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x04070d, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04070d, 0.0009);
    const camera = new THREE.PerspectiveCamera(74, 1, 1, 5000);
    camera.position.set(0, 0, CAM_START);

    const tex = glowTexture();
    const blue = new THREE.Color(0x53a3ff);
    const cyan = new THREE.Color(0x8fd0ff);
    const orange = new THREE.Color(0xff8a2a);

    const scatter = new Float32Array(N * 3);  // vortex start (relative to the brain-center group)
    const brain = new Float32Array(N * 3);    // brain target (relative)
    const pos = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);

    for (let i = 0; i < N; i++) {
      // ---- vortex: a spiral tunnel funnelling toward the camera ----
      const arm = i % 3;
      const tt = Math.random();
      const ang = tt * Math.PI * 10 + arm * (Math.PI * 2 / 3) + Math.random() * 0.5;
      const rad = 40 + (1 - tt) * 260 + Math.random() * 40;
      scatter[i * 3] = Math.cos(ang) * rad;
      scatter[i * 3 + 1] = Math.sin(ang) * rad;
      scatter[i * 3 + 2] = 300 - tt * 760;

      // ---- brain target: two wrinkled hemispheres + cerebellum + brainstem ----
      const R = Math.random();
      const orangeNode = Math.random() < 0.14;
      let bx: number, by: number, bz: number;
      if (R < 0.80) {
        const lobe = Math.random() < 0.5 ? 1 : -1;
        const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1);
        let X = Math.sin(v) * Math.cos(u) * 95, Y = Math.sin(v) * Math.sin(u) * 74, Z = Math.cos(v) * 118;
        const disp = 6 + 7 * Math.abs(noise3(X, Y, Z));
        const nrm = 1 + disp / 90; X *= nrm; Y *= nrm; Z *= nrm;
        X += lobe * 24;                                  // split into hemispheres
        if (Y > 18 && Math.abs(X) < 14) Y -= 18;         // longitudinal fissure at the top midline
        bx = X; by = Y + 8; bz = Z;
      } else if (R < 0.93) {
        const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1);
        const rr = 40 * (0.85 + 0.15 * Math.sin(u * 8));
        bx = Math.sin(v) * Math.cos(u) * rr * 0.9;
        by = -58 + Math.cos(v) * rr * 0.6;
        bz = -70 + Math.sin(v) * Math.sin(u) * rr * 0.9;
      } else {
        bx = (Math.random() - 0.5) * 10;
        by = -70 - Math.random() * 46;
        bz = -52 + (Math.random() - 0.5) * 10;
      }
      brain[i * 3] = bx; brain[i * 3 + 1] = by; brain[i * 3 + 2] = bz;

      const col = orangeNode ? orange : (Math.random() < 0.5 ? blue : cyan);
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
      pos[i * 3] = scatter[i * 3]; pos[i * 3 + 1] = scatter[i * 3 + 1]; pos[i * 3 + 2] = scatter[i * 3 + 2];
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3);
    geo.setAttribute("position", posAttr);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pointsMat = new THREE.PointsMaterial({ size: mobile ? 8 : 9, map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, opacity: 0.95 });
    const points = new THREE.Points(geo, pointsMat);
    points.position.set(0, 0, -D); // group centered on the brain so it rotates in place
    scene.add(points);

    // filament web — nearby brain points, drawn from the morphing positions each frame
    const SEG = mobile ? 380 : 720;
    const pairs = new Int32Array(SEG * 2);
    for (let s = 0; s < SEG; s++) {
      const a = (Math.random() * N) | 0; let b = a, best = Infinity;
      for (let k = 0; k < 7; k++) {
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

    // bright orange synapse hotspots sitting on the brain (rotate with it)
    const hotspots: THREE.Sprite[] = [];
    for (let h = 0; h < 8; h++) {
      const idx = (Math.random() * N) | 0;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff9a2e, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      sp.scale.set(46, 46, 1);
      sp.position.set(brain[idx * 3], brain[idx * 3 + 1], brain[idx * 3 + 2]);
      points.add(sp);
      hotspots.push(sp);
    }

    // the orange synapse LIGHT we fly into (world space, at brain center-front)
    const lightGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff9a2e, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    lightGlow.scale.set(260, 260, 1); lightGlow.position.set(0, 0, -D + 5);
    scene.add(lightGlow);
    const lightCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    lightCore.scale.set(90, 90, 1); lightCore.position.set(0, 0, -D + 5);
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
      if (p < 0.36) return lerp(CAM_START, HERO, smooth(p, 0, 0.36));       // approach + brain forms
      if (p < 0.52) return HERO;                                            // HERO BEAT: behold the brain
      if (p < 0.82) return lerp(HERO, INSIDE, ease(smooth(p, 0.52, 0.82))); // swoosh inside
      return lerp(INSIDE, CAM_END, smooth(p, 0.82, 1));                     // zoom into the light
    };

    const render = (p: number, t: number) => {
      const morph = smooth(p, 0.06, 0.32); // vortex → brain

      for (let i = 0; i < N; i++) {
        const j = i * 3;
        pos[j] = lerp(scatter[j], brain[j], morph);
        pos[j + 1] = lerp(scatter[j + 1], brain[j + 1], morph);
        pos[j + 2] = lerp(scatter[j + 2], brain[j + 2], morph);
      }
      posAttr.needsUpdate = true;
      for (let s = 0; s < SEG; s++) {
        const a = pairs[s * 2] * 3, b = pairs[s * 2 + 1] * 3, o = s * 6;
        linePos[o] = pos[a]; linePos[o + 1] = pos[a + 1]; linePos[o + 2] = pos[a + 2];
        linePos[o + 3] = pos[b]; linePos[o + 4] = pos[b + 1]; linePos[o + 5] = pos[b + 2];
      }
      lineAttr.needsUpdate = true;

      // swirl fastest while scattered, eases as the brain forms (never reverses)
      points.rotation.y = t * 0.05 * (1 - 0.6 * morph);
      lines.rotation.y = points.rotation.y;

      camera.position.set(Math.sin(t * 0.3) * 6, Math.cos(t * 0.28) * 4, camZ(p));
      camera.lookAt(0, 0, -D);

      const fade = 1 - smooth(p, 0.9, 1);
      pointsMat.opacity = 0.95 * fade;
      lineMat.opacity = 0.24 * morph * fade;
      for (const sp of hotspots) (sp.material as THREE.SpriteMaterial).opacity = morph * 0.7 * fade;

      const arrive = smooth(p, 0.82, 1);
      (lightGlow.material as THREE.SpriteMaterial).opacity = Math.max(morph * 0.18, arrive) * 0.85;
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
    const startT = performance.now();
    const loop = () => {
      if (!visible) { rafRef.current = null; return; }
      render(progress(), (performance.now() - startT) / 1000);
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
      for (const sp of hotspots) (sp.material as THREE.Material).dispose();
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
