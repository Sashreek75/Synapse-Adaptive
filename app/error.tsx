"use client";
import Link from "next/link";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="lp" style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div><h1 style={{ fontSize: 28, margin: 0 }}>Something broke.</h1>
        <p style={{ color: "#8aa0b8" }}><button onClick={reset} className="lp-cta">Try again</button></p><Link href="/">Home</Link></div>
    </main>
  );
}
