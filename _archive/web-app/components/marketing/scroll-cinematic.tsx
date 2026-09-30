"use client";

/**
 * SCROLL CINEMATIC (Three.js) — a curved 3-act flight, all particles (no images):
 *   ACT 1  You START inside a swirling vortex facing you; scrolling condenses it into a brain.
 *   ACT 2  HERO — the whole brain (blue web + orange synapses) fills the screen; an orange
 *          synapse light glows in the lower-right.
 *   ACT 3  You bank down-right and fly THROUGH the interior neural nerve fibers into that
 *          orange light, which blooms as "Synapse" arrives.
 * Composition + curved camera path were tuned frame-by-frame against an offline previsualization.
 * Corner words POP in one at a time. Scroll scrubs it (~3 scrolls).
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
  { t: "Discipline", cls: "top-10 right-8", at: 0.13 },
  { t: "Momentum", cls: "bottom-12 left-8", at: 0.21 },
  { t: "Consistency", cls: "top-1/3 right-9", at: 0.55 },
  { t: "Clarity", cls: "top-1/3 left-9", at: 0.63 },
  { t: "Follow-through", cls: "bottom-1/4 left-10", at: 0.71 },
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

    const D = 900;                    // brain-center group at z = -D
    const N = mobile ? 1300 : 2600;
    const LIGHT: [number, number, number] = [132, -92, -885]; // orange synapse: lower-right, inside the brain

    // curved camera path (world). straight through the vortex, then bank down-right to the light.
    const CP = [0, 0.34, 0.54, 0.78, 1.0];
    const CV: [number, number, number][] = [[0, 0, 330], [0, 0, -500], [26, -20, -685], [92, -70, -826], [126, -88, -858]];
    const camAt = (p: number, out: [number, number, number]) => {
      if (p <= CP[0]) { out[0] = CV[0][0]; out[1] = CV[0][1]; out[2] = CV[0][2]; return; }
      for (let i = 1; i < CP.length; i++) {
        if (p <= CP[i]) {
          const t = smooth(p, CP[i - 1], CP[i]);
          out[0] = lerp(CV[i - 1][0], CV[i][0], t);
          out[1] = lerp(CV[i - 1][1], CV[i][1], t);
          out[2] = lerp(CV[i - 1][2], CV[i][2], t);
          return;
        }
      }
      out[0] = CV[CV.length - 1][0]; out[1] = CV[CV.length - 1][1]; out[2] = CV[CV.length - 1][2];
    };

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: !mobile, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x04070d, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04070d, 0.0009);
    const camera = new THREE.PerspectiveCamera(74, 1, 1, 5000);

    const tex = glowTexture();
    const blue = new THREE.Color(0x53a3ff);
    const cyan = new THREE.Color(0x8fd0ff);
    const orange = new THREE.Color(0xff8a2a);

    const scatter = new Float32Array(N * 3);
    const brain = new Float32Array(N * 3);
    const pos = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);

    const clampEll = (v: [number, number, number]) => {
      const q = (v[0] / 128) ** 2 + (v[1] / 98) ** 2 + (v[2] / 150) ** 2;
      if (q > 1) { const k = 1 / Math.sqrt(q); v[0] *= k; v[1] *= k; v[2] *= k; }
      return v;
    };

    // ---- interior nerve fibers: random-walk strands through the brain volume ----
    const STR = mobile ? 34 : 60, L = 14, SP = STR * L;
    for (let s = 0; s < STR; s++) {
      let x = (Math.random() - 0.5) * 150, y = (Math.random() - 0.5) * 120 - 8, z = (Math.random() - 0.5) * 200;
      let dx = Math.random() - 0.5, dy = Math.random() - 0.5, dz = Math.random() - 0.5;
      for (let l = 0; l < L; l++) {
        const idx = s * L + l;
        const v = clampEll([x, y, z]);
        brain[idx * 3] = v[0]; brain[idx * 3 + 1] = v[1]; brain[idx * 3 + 2] = v[2];
        const node = l === 0 || Math.random() < 0.14;
        const col = node ? orange : cyan;
        colors[idx * 3] = col.r; colors[idx * 3 + 1] = col.g; colors[idx * 3 + 2] = col.b;
        dx += (Math.random() - 0.5) * 0.6; dy += (Math.random() - 0.5) * 0.6; dz += (Math.random() - 0.5) * 0.6;
        const m = Math.hypot(dx, dy, dz) || 1, step = 20;
        x += dx / m * step; y += dy / m * step; z += dz / m * step;
      }
    }
    // ---- surface: hemispheres + cerebellum + brainstem (the silhouette) ----
    for (let i = SP; i < N; i++) {
      const R = Math.random();
      let bx: number, by: number, bz: number;
      if (R < 0.72) {
        const lobe = Math.random() < 0.5 ? 1 : -1;
        const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1);
        let X = Math.sin(v) * Math.cos(u) * 95, Y = Math.sin(v) * Math.sin(u) * 74, Z = Math.cos(v) * 118;
        const disp = 6 + 7 * Math.abs(noise3(X, Y, Z)); const nrm = 1 + disp / 90; X *= nrm; Y *= nrm; Z *= nrm;
        X += lobe * 24; if (Y > 18 && Math.abs(X) < 14) Y -= 18;
        bx = X; by = Y + 8; bz = Z;
      } else if (R < 0.9) {
        const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1), rr = 40 * (0.85 + 0.15 * Math.sin(u * 8));
        bx = Math.sin(v) * Math.cos(u) * rr * 0.9; by = -58 + Math.cos(v) * rr * 0.6; bz = -70 + Math.sin(v) * Math.sin(u) * rr * 0.9;
      } else {
        bx = (Math.random() - 0.5) * 10; by = -70 - Math.random() * 46; bz = -52 + (Math.random() - 0.5) * 10;
      }
      brain[i * 3] = bx; brain[i * 3 + 1] = by; brain[i * 3 + 2] = bz;
      const col = Math.random() < 0.13 ? orange : blue;
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    // ---- vortex start for every point: spiral tunnel, wide + close near camera, narrowing far ----
    for (let i = 0; i < N; i++) {
      const tt = Math.random(), arm = i % 3;
      const ang = tt * Math.PI * 14 + arm * (Math.PI * 2 / 3) + Math.random() * 0.4;
      const rad = 45 + (1 - tt) * 300 + Math.random() * 30;
      scatter[i * 3] = Math.cos(ang) * rad;
      scatter[i * 3 + 1] = Math.sin(ang) * rad;
      scatter[i * 3 + 2] = 1160 - tt * 1160; // local; group at -D → world +260..-900
      pos[i * 3] = scatter[i * 3]; pos[i * 3 + 1] = scatter[i * 3 + 1]; pos[i * 3 + 2] = scatter[i * 3 + 2];
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3);
    geo.setAttribute("position", posAttr);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pointsMat = new THREE.PointsMaterial({ size: mobile ? 7 : 8, map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, opacity: 0.95 });
    const points = new THREE.Points(geo, pointsMat);
    points.position.set(0, 0, -D); // group centered on the brain — rotate.z spins the vortex in place
    scene.add(points);

    // ---- nerve fiber lines: strand-consecutive (the fibers) + a little surface web ----
    const SURF_WEB = mobile ? 150 : 280;
    const nLines = STR * (L - 1) + SURF_WEB;
    const pairs = new Int32Array(nLines * 2);
    let pc = 0;
    for (let s = 0; s < STR; s++) for (let l = 1; l < L; l++) { pairs[pc * 2] = s * L + l; pairs[pc * 2 + 1] = s * L + l - 1; pc++; }
    for (let w = 0; w < SURF_WEB; w++) {
      const a = SP + ((Math.random() * (N - SP)) | 0); let b = a, best = Infinity;
      for (let k = 0; k < 6; k++) {
        const cand = SP + ((Math.random() * (N - SP)) | 0);
        const dx = brain[a * 3] - brain[cand * 3], dy = brain[a * 3 + 1] - brain[cand * 3 + 1], dz = brain[a * 3 + 2] - brain[cand * 3 + 2];
        const d = dx * dx + dy * dy + dz * dz;
        if (cand !== a && d < best) { best = d; b = cand; }
      }
      pairs[pc * 2] = a; pairs[pc * 2 + 1] = b; pc++;
    }
    const linePos = new Float32Array(nLines * 6);
    const lineGeo = new THREE.BufferGeometry();
    const lineAttr = new THREE.BufferAttribute(linePos, 3);
    lineGeo.setAttribute("position", lineAttr);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x4f9be8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    lines.position.set(0, 0, -D);
    scene.add(lines);

    // ---- the orange synapse LIGHT we fly into (world space, lower-right) ----
    const lightGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff9a2e, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    lightGlow.scale.set(230, 230, 1); lightGlow.position.set(LIGHT[0], LIGHT[1], LIGHT[2]);
    scene.add(lightGlow);
    const lightCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    lightCore.scale.set(82, 82, 1); lightCore.position.set(LIGHT[0], LIGHT[1], LIGHT[2]);
    scene.add(lightCore);

    const resize = () => { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); };
    resize();
    window.addEventListener("resize", resize);

    const progress = (): number => {
      const r = section.getBoundingClientRect();
      const scrollable = r.height - window.innerHeight;
      if (scrollable <= 0) return 0;
      return Math.min(1, Math.max(0, -r.top / scrollable));
    };

    const cp: [number, number, number] = [0, 0, 0];
    const render = (p: number, t: number) => {
      const morph = smooth(p, 0.06, 0.34); // vortex → brain

      for (let i = 0; i < N; i++) {
        const j = i * 3;
        pos[j] = lerp(scatter[j], brain[j], morph);
        pos[j + 1] = lerp(scatter[j + 1], brain[j + 1], morph);
        pos[j + 2] = lerp(scatter[j + 2], brain[j + 2], morph);
      }
      posAttr.needsUpdate = true;
      for (let s = 0; s < nLines; s++) {
        const a = pairs[s * 2] * 3, b = pairs[s * 2 + 1] * 3, o = s * 6;
        linePos[o] = pos[a]; linePos[o + 1] = pos[a + 1]; linePos[o + 2] = pos[a + 2];
        linePos[o + 3] = pos[b]; linePos[o + 4] = pos[b + 1]; linePos[o + 5] = pos[b + 2];
      }
      lineAttr.needsUpdate = true;

      // vortex swirl (pinwheel around the axis), eases off as the brain forms
      points.rotation.z = t * 0.12 * (1 - 0.7 * morph);
      lines.rotation.z = points.rotation.z;

      camAt(p, cp);
      camera.position.set(cp[0] + Math.sin(t * 0.3) * 4, cp[1] + Math.cos(t * 0.26) * 3, cp[2]);
      const lt = smooth(p, 0.46, 0.86);
      camera.lookAt(lerp(0, LIGHT[0], lt), lerp(0, LIGHT[1], lt), lerp(-D, LIGHT[2], lt));

      const fade = 1 - smooth(p, 0.88, 1);
      pointsMat.opacity = 0.95 * fade;
      lineMat.opacity = (0.16 + 0.2 * smooth(p, 0.4, 0.72)) * morph * fade; // nerves brighten as you fly through

      const arrive = smooth(p, 0.8, 1);
      (lightGlow.material as THREE.SpriteMaterial).opacity = Math.max(smooth(p, 0.34, 0.6) * 0.5, arrive) * 0.9;
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
      (lightGlow.material as THREE.Material).dispose(); (lightCore.material as THREE.Material).dispose();
      tex.dispose(); renderer.dispose();
    };
  }, []);

  return (
    <section ref={sectionRef} aria-hidden className="relative h-[340vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#04070d]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

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
