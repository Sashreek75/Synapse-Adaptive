import { cn } from "@/lib/utils";

/**
 * CSS ROBOT — the friendly orange/blue humanoid, built entirely from divs (no image), so each limb is
 * a real, separately-animatable part: head bobs, eyes blink, both arms swing at the shoulder + elbow,
 * both legs step at the hip + knee (see the rob-* animations in globals.css). Rendered on a fixed
 * 200×300 canvas; scale the parent to size it. Not photoreal — a clean, recognizable mascot.
 */

const ORANGE = "#f4861d";
const ORANGE_HI = "#ffab55";
const BLUE = "#3a9fd6";
const BLUE_DK = "#2b7fb0";
const JOINT = "#28323f";

const orangePart: React.CSSProperties = {
  background: `linear-gradient(150deg, ${ORANGE_HI}, ${ORANGE} 55%, #d9701a)`,
  boxShadow: "inset 0 2px 3px rgba(255,255,255,.35), inset 0 -4px 8px rgba(140,60,10,.35)",
};
const bluePart: React.CSSProperties = {
  background: `linear-gradient(150deg, ${BLUE}, ${BLUE_DK})`,
  boxShadow: "inset 0 2px 3px rgba(255,255,255,.25), inset 0 -4px 8px rgba(20,70,105,.4)",
};

export function CssRobot({ className = "" }: { className?: string }) {
  return (
    <div className={cn("relative", className)} style={{ width: 200, height: 300 }} aria-hidden>
      {/* ===== LEGS (behind torso) ===== */}
      {(["l", "r"] as const).map((side) => (
        <div key={`leg-${side}`} className={`rob-leg-${side} absolute`} style={{ left: side === "l" ? 74 : 100, top: 198, width: 26, height: 122 }}>
          <div className="absolute rounded-[13px]" style={{ ...orangePart, inset: 0, height: 66 }} />
          <div className={`rob-shin-${side} absolute`} style={{ top: 58, left: 1, width: 24, height: 64 }}>
            <div className="absolute rounded-[12px]" style={{ ...bluePart, top: 0, left: 0, width: 24, height: 52 }} />
            <div className="absolute rounded-[6px]" style={{ background: JOINT, bottom: 0, left: -3, width: 30, height: 14 }} />
          </div>
        </div>
      ))}

      {/* ===== TORSO ===== */}
      <div className="absolute rounded-[30px]" style={{ ...orangePart, left: 42, top: 108, width: 116, height: 84 }} />
      {/* blue chest panel */}
      <div className="absolute rounded-[20px]" style={{ ...bluePart, left: 66, top: 118, width: 68, height: 62 }} />
      <div className="absolute rounded-full" style={{ background: JOINT, left: 90, top: 132, width: 20, height: 20 }} />
      <div className="absolute rounded-full" style={{ background: ORANGE_HI, left: 96, top: 138, width: 8, height: 8 }} />
      {/* hips */}
      <div className="absolute rounded-[14px]" style={{ ...orangePart, left: 66, top: 182, width: 68, height: 26 }} />

      {/* ===== ARMS (in front) ===== */}
      {(["l", "r"] as const).map((side) => (
        <div key={`arm-${side}`} className={`rob-arm-${side} absolute`} style={{ left: side === "l" ? 34 : 144, top: 116, width: 22, height: 62 }}>
          <div className="absolute rounded-[11px]" style={{ ...orangePart, inset: 0, height: 56 }} />
          <div className={`rob-fore-${side} absolute`} style={{ top: 50, left: 1, width: 20, height: 58 }}>
            <div className="absolute rounded-[10px]" style={{ ...orangePart, top: 0, left: 0, width: 20, height: 46 }} />
            <div className="absolute rounded-full" style={{ background: JOINT, bottom: 0, left: -2, width: 24, height: 20 }} />
          </div>
        </div>
      ))}

      {/* ===== HEAD ===== */}
      {/* neck */}
      <div className="absolute rounded-[6px]" style={{ ...bluePart, left: 90, top: 96, width: 20, height: 16 }} />
      <div className="rob-head absolute" style={{ left: 56, top: 6, width: 88, height: 96 }}>
        {/* skull */}
        <div className="absolute" style={{ ...orangePart, inset: 0, borderRadius: "46px 46px 42px 42px" }} />
        {/* side headphone */}
        <div className="absolute rounded-[8px]" style={{ background: JOINT, right: -6, top: 34, width: 14, height: 30 }} />
        {/* blue faceplate */}
        <div className="absolute rounded-[28px]" style={{ ...bluePart, left: 12, top: 18, width: 64, height: 62 }} />
        {/* eyes */}
        {[26, 50].map((lx) => (
          <div key={lx} className="rob-eye absolute grid place-items-center rounded-full" style={{ background: "#eaf2f8", left: lx, top: 34, width: 18, height: 18, boxShadow: "inset 0 1px 2px rgba(0,0,0,.2)" }}>
            <span className="rounded-full" style={{ background: "#2f6f9e", width: 9, height: 9 }}>
              <span className="block rounded-full" style={{ background: "#0f2a44", width: 4, height: 4, margin: "2px auto" }} />
            </span>
          </div>
        ))}
        {/* smile */}
        <div className="absolute" style={{ left: 30, top: 60, width: 28, height: 12, borderBottom: `3px solid ${JOINT}`, borderRadius: "0 0 16px 16px" }} />
      </div>
    </div>
  );
}
