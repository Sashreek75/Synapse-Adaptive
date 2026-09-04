"use client";

/**
 * SCROLL CINEMATIC (Three.js) — the movie-theater opening.
 *
 * A true-3D volumetric field of navy/orange "neurons" with synapse links. As you scroll the tall
 * runway, the camera flies forward THROUGH the network toward a glowing Synapse orb at the far end;
 * near the end the orb fills the view and the title arrives. Scroll is the scrubber — scroll back and
 * you fly back out. Perf-guarded (pixel-ratio capped, paused when off-screen, disposed on unmount)
 * and reduced-motion aware (renders the arrival frame, no animation).
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

const smooth = (x: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A soft round glow sprite texture (white→transparent), tinted per-use via sprite color. */
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
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function ScrollCinematic() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;

    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.innerWidth < 768;

    const DEPTH = 900;
    const CAM_START = 70;
    const CAM_END = -DEPTH + 80;
    const N = mobile ? 600 : 1400;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: !mobile, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x04070d, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04070d, 0.0016);
    const camera = new THREE.PerspectiveCamera(70, 1, 1, 3000);
    camera.position.set(0, 0, CAM_START);

    const tex = glowTexture();

    // --- neurons (points) ---
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const navy = new THREE.Color(0x5a96f0);
    const orange = new THREE.Color(0xff9638);
    for (let i = 0; i < N; i++) {
      const r = 20 + Math.random() * 90;
      const ang = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(ang) * r * (0.6 + Math.random() * 0.8);
      positions[i * 3 + 1] = Math.sin(ang) * r * (0.6 + Math.random() * 0.8);
      positions[i * 3 + 2] = 30 - Math.random() * (DEPTH + 30);
      const col = i % 3 === 0 ? navy : orange;
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const pointsMat = new THREE.PointsMaterial({
      size: mobile ? 7 : 9, map: tex, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, opacity: 0.95,
    });
    const points = new THREE.Points(geo, pointsMat);
    scene.add(points);

    // --- synapse links ---
    const SEG = mobile ? 220 : 480;
    const linePos = new Float32Array(SEG * 6);
    for (let s = 0; s < SEG; s++) {
      const a = (Math.random() * N) | 0;
      const b = (a + 1 + ((Math.random() * 6) | 0)) % N;
      for (let k = 0; k < 3; k++) { linePos[s * 6 + k] = positions[a * 3 + k]; linePos[s * 6 + 3 + k] = positions[b * 3 + k]; }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x5a78d0, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    // --- the orb at the far end ---
    const orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff9a44, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    orbGlow.scale.set(320, 320, 1); orbGlow.position.set(0, 0, -DEPTH);
    scene.add(orbGlow);
    const orbCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    orbCore.scale.set(120, 120, 1); orbCore.position.set(0, 0, -DEPTH);
    scene.add(orbCore);

    let W = 0, H = 0;
    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const progress = (): number => {
      const r = section.getBoundingClientRect();
      const scrollable = r.height - window.innerHeight;
      if (scrollable <= 0) return 0;
      return Math.min(1, Math.max(0, -r.top / scrollable));
    };

    const render = (p: number, t: number) => {
      const eased = smooth(p, 0, 1);
      camera.position.z = CAM_START + (CAM_END - CAM_START) * eased;
      camera.position.x = Math.sin(t * 0.5) * 5;
      camera.position.y = Math.cos(t * 0.4) * 4;
      camera.lookAt(0, 0, camera.position.z - 200);
      points.rotation.z = t * 0.02;
      lines.rotation.z = points.rotation.z;

      const fade = 1 - smooth(p, 0.85, 1);
      pointsMat.opacity = 0.95 * fade;
      lineMat.opacity = 0.14 * fade;

      const arrive = smooth(p, 0.7, 1);
      (orbGlow.material as THREE.SpriteMaterial).opacity = arrive;
      (orbCore.material as THREE.SpriteMaterial).opacity = arrive * 0.9;

      renderer.render(scene, camera);
      if (titleRef.current) titleRef.current.style.opacity = String(smooth(p, 0.8, 0.98));
    };

    let visible = true;
    const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !reduced && rafRef.current == null) loop(); }, { threshold: 0 });
    io.observe(section);

    const start = performance.now();
    const loop = () => {
      if (!visible) { rafRef.current = null; return; }
      render(progress(), (performance.now() - start) / 1000);
      rafRef.current = requestAnimationFrame(loop);
    };
    if (reduced) render(0.92, 0); else loop();

    return () => {
      window.removeEventListener("resize", resize);
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      geo.dispose(); pointsMat.dispose(); lineGeo.dispose(); lineMat.dispose();
      (orbGlow.material as THREE.Material).dispose(); (orbCore.material as THREE.Material).dispose();
      tex.dispose(); renderer.dispose();
    };
  }, []);

  return (
    <section ref={sectionRef} aria-hidden className="relative h-[280vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#04070d]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div ref={titleRef} className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center opacity-0">
          <div>
            <div className="text-5xl font-semibold tracking-tight text-white sm:text-7xl">Synapse</div>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/70 sm:text-lg">An AI that learns how you actually operate — and stays on the hook until intention becomes done.</p>
            <p className="mt-8 text-xs uppercase tracking-[0.35em] text-white/40">Keep scrolling</p>
          </div>
        </div>
      </div>
    </section>
  );
}
