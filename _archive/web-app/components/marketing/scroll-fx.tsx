"use client";

/**
 * ScrollFX — landing-page object animations (beyond the hero cinematic):
 *   • [data-anim]      staggered reveal (fade/slide/scale/blur) as it enters view
 *   • [data-pop]       springy pop for icons/badges (revealed with their card)
 *   • [data-parallax]  scroll-linked vertical parallax (depth) via --sy
 *   • [data-tilt]      pointer-driven 3D tilt for cards/pictures
 * Everything is gated behind the `js-anim` class this adds to <html>, so the page
 * degrades to fully-visible if JS is off. Respects prefers-reduced-motion.
 */

import { useEffect } from "react";

export function ScrollFX() {
  useEffect(() => {
    const root = document.documentElement;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("js-anim");

    // ── staggered reveal ──
    const reveals = Array.from(document.querySelectorAll<HTMLElement>("[data-anim], [data-pop]"));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        const i = Number(el.dataset.i ?? 0);
        el.style.transitionDelay = `${Math.min(i, 9) * 75}ms`;
        el.classList.add("sa-in");
        io.unobserve(el);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach((el) => io.observe(el));

    // ── scroll parallax ──
    const paras = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    let raf = 0;
    const applyParallax = () => {
      raf = 0;
      const vh = window.innerHeight || 1;
      for (const el of paras) {
        const speed = Number(el.dataset.parallax || "0.1");
        const r = el.getBoundingClientRect();
        const centerOff = (r.top + r.height / 2 - vh / 2) / vh; // ~ -0.6..0.6 across the viewport
        el.style.setProperty("--sy", `${(-centerOff * speed * vh).toFixed(1)}px`);
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(applyParallax); };
    if (paras.length) { window.addEventListener("scroll", onScroll, { passive: true }); applyParallax(); }

    // ── pointer tilt ──
    const tilts = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt]"));
    const cleanups: Array<() => void> = [];
    tilts.forEach((el) => {
      const max = Number(el.dataset.tilt || "9");
      const move = (ev: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width - 0.5;
        const py = (ev.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(1300px) rotateY(${(px * max).toFixed(2)}deg) rotateX(${(-py * max * 0.8).toFixed(2)}deg)`;
      };
      const leave = () => { el.style.transform = ""; };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      cleanups.push(() => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); });
    });

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      cleanups.forEach((f) => f());
      root.classList.remove("js-anim");
    };
  }, []);

  return null;
}
