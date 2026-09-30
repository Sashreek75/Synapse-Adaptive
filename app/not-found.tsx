import Link from "next/link";
export default function NotFound() {
  return (
    <main className="lp" style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div><h1 style={{ fontSize: 28, margin: 0 }}>Nothing here.</h1><p style={{ color: "#8aa0b8" }}>Synapse lives on your computer, not on this site.</p><Link href="/" className="lp-cta">Back to Synapse</Link></div>
    </main>
  );
}
