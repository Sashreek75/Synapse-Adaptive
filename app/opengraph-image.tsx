import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Synapse Adaptive — AI accountability partner that helps you achieve your goals";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Branded social-share card, generated at the edge. Delete this file if a build ever
 *  complains about "next/og" — the rest of the SEO setup does not depend on it. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%", width: "100%", display: "flex", flexDirection: "column",
          justifyContent: "center", padding: "80px",
          background: "linear-gradient(135deg, #0b1f3a 0%, #12294a 55%, #1c1230 100%)",
          color: "white", fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 72, height: 72, borderRadius: 999, background: "#f97316", boxShadow: "0 0 60px rgba(249,115,22,0.6)" }} />
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Synapse Adaptive</div>
        </div>
        <div style={{ marginTop: 48, fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxWidth: 960, letterSpacing: -2 }}>
          The AI that helps you actually achieve your goals.
        </div>
        <div style={{ marginTop: 32, fontSize: 32, color: "#c9d4e6", maxWidth: 960 }}>
          Your accountability partner and goal operating system. ChatGPT helps you think — Synapse helps you achieve.
        </div>
      </div>
    ),
    { ...size },
  );
}
