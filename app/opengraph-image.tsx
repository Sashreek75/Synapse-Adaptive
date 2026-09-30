import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Synapse — the layer between what you intend to do and what you actually do";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "#04070d", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: "radial-gradient(circle at 32% 26%, #ffffffb0, transparent 45%), radial-gradient(circle at 70% 80%, #f97316, #24557d 60%, #0a2033)", boxShadow: "0 0 60px rgba(249,115,22,0.5)" }} />
          <div style={{ fontSize: 34, letterSpacing: 10, color: "#f97316", fontWeight: 700 }}>SYNAPSE</div>
        </div>
        <div style={{ marginTop: 44, fontSize: 70, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000, letterSpacing: -2 }}>
          The layer between what you intend to do and what you actually do.
        </div>
        <div style={{ marginTop: 30, fontSize: 30, color: "#8aa0b8" }}>Get Synapse for Windows</div>
      </div>
    ),
    { ...size },
  );
}
