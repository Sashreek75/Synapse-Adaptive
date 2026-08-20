"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * CSS/SVG MECH — a sleek orange/blue armored hero, drawn as inline SVG (angular plates, metallic
 * gradients, glowing visor + reactor core + energy strips). Every limb is a separate <g> so it moves
 * independently: head bobs, visor pulses, both arms swing at shoulder + elbow, both legs step at
 * hip + knee (rob-* animations in globals.css). Stylized, not photoreal. Scale the parent to size it.
 */
export function CssRobot({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `${uid}-${n}`;

  return (
    <svg viewBox="0 0 200 320" className={cn("block", className)} style={{ width: 200, height: 320, overflow: "visible", filter: "drop-shadow(0 20px 26px rgba(10,18,36,.5))" }} aria-hidden>
      <defs>
        <linearGradient id={id("or")} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#ffc27a" /><stop offset="45%" stopColor="#f4831a" /><stop offset="100%" stopColor="#b4530a" />
        </linearGradient>
        <linearGradient id={id("or2")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#ef972f" /><stop offset="100%" stopColor="#9c4a09" />
        </linearGradient>
        <linearGradient id={id("bl")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#5cbaf0" /><stop offset="100%" stopColor="#236b9c" />
        </linearGradient>
        <linearGradient id={id("st")} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#495a6e" /><stop offset="100%" stopColor="#1d2733" />
        </linearGradient>
        <radialGradient id={id("core")} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0%" stopColor="#fff1d6" /><stop offset="45%" stopColor="#ff9a3d" /><stop offset="100%" stopColor="#c85f0c" />
        </radialGradient>
        <filter id={id("glow")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* helpers reused below */}
      {(() => {
        const OR = `url(#${id("or")})`, OR2 = `url(#${id("or2")})`, BL = `url(#${id("bl")})`, ST = `url(#${id("st")})`;
        const CYAN = "#bdeeff", GLOW = `url(#${id("glow")})`;

        const Arm = ({ tx, armCls, foreCls }: { tx: number; armCls: string; foreCls: string }) => (
          <g transform={`translate(${tx},100)`}>
            <g className={armCls}>
              {/* pauldron */}
              <path d="M-16,-6 L16,-4 L14,16 L-14,16 Z" fill={OR2} />
              {/* upper arm */}
              <rect x="-11" y="10" width="22" height="40" rx="9" fill={OR} />
              <rect x="-3" y="16" width="6" height="26" rx="3" fill={CYAN} opacity="0.85" filter={GLOW} />
              {/* elbow */}
              <circle cx="0" cy="50" r="7" fill={ST} />
              <g className={foreCls}>
                <rect x="-10" y="52" width="20" height="40" rx="8" fill={OR} />
                <rect x="-9" y="56" width="4" height="26" rx="2" fill="#ffb060" opacity="0.9" filter={GLOW} />
                {/* fist */}
                <path d="M-11,90 L11,90 L13,104 L-13,104 Z" fill={ST} />
              </g>
            </g>
          </g>
        );

        const Leg = ({ tx, legCls, shinCls }: { tx: number; legCls: string; shinCls: string }) => (
          <g transform={`translate(${tx},176)`}>
            <g className={legCls}>
              {/* thigh */}
              <rect x="-13" y="0" width="26" height="52" rx="11" fill={OR} />
              <rect x="-4" y="8" width="8" height="30" rx="4" fill={CYAN} opacity="0.75" filter={GLOW} />
              {/* knee */}
              <circle cx="0" cy="54" r="8" fill={ST} />
              <g className={shinCls}>
                <rect x="-12" y="56" width="24" height="44" rx="10" fill={BL} />
                {/* knee guard */}
                <path d="M-12,58 L12,58 L9,72 L-9,72 Z" fill={OR2} />
                {/* foot */}
                <path d="M-14,98 L14,98 L20,114 L-16,114 Z" fill={ST} />
              </g>
            </g>
          </g>
        );

        return (
          <>
            {/* LEGS (behind torso) */}
            <Leg tx={87} legCls="rob-leg-l" shinCls="rob-shin-l" />
            <Leg tx={113} legCls="rob-leg-r" shinCls="rob-shin-r" />

            {/* TORSO */}
            <path d="M58,74 L142,74 L151,94 L146,142 L128,160 L72,160 L54,142 L49,94 Z" fill={OR} />
            {/* abdomen underlayer */}
            <path d="M72,150 L128,150 L123,182 L77,182 Z" fill={BL} />
            <path d="M84,156 L116,156 L114,176 L86,176 Z" fill={ST} opacity="0.5" />
            {/* chest energy strips */}
            <path d="M66,92 L88,88 L86,96 L64,100 Z" fill={CYAN} opacity="0.8" filter={GLOW} />
            <path d="M134,92 L112,88 L114,96 L136,100 Z" fill={CYAN} opacity="0.8" filter={GLOW} />
            {/* reactor core */}
            <circle className="rob-core" cx="100" cy="118" r="13" fill={`url(#${id("core")})`} filter={GLOW} />
            <circle cx="100" cy="118" r="4" fill="#fff6e6" />

            {/* ARMS (in front of torso) */}
            <Arm tx={44} armCls="rob-arm-l" foreCls="rob-fore-l" />
            <Arm tx={156} armCls="rob-arm-r" foreCls="rob-fore-r" />

            {/* NECK + HEAD */}
            <rect x="90" y="62" width="20" height="14" rx="4" fill={ST} />
            <g className="rob-head">
              {/* crest */}
              <path d="M92,6 L108,6 L112,16 L88,16 Z" fill={OR2} />
              <rect x="97" y="0" width="6" height="7" rx="2" fill="#ff9a3d" filter={GLOW} />
              {/* helmet */}
              <path d="M74,12 L126,12 L133,30 L130,54 L116,66 L84,66 L70,54 L67,30 Z" fill={OR} />
              {/* side vents */}
              <path d="M126,28 L134,30 L133,46 L126,46 Z" fill={ST} />
              <path d="M74,28 L66,30 L67,46 L74,46 Z" fill={ST} />
              {/* visor */}
              <path d="M79,30 L121,30 L124,42 L116,50 L84,50 L76,42 Z" fill={ST} />
              {/* glowing eye slit */}
              <rect className="rob-eye" x="83" y="35" width="34" height="7" rx="3.5" fill={CYAN} filter={GLOW} />
              {/* mouth grille */}
              <rect x="92" y="54" width="16" height="5" rx="2" fill={CYAN} opacity="0.7" filter={GLOW} />
            </g>
          </>
        );
      })()}
    </svg>
  );
}
