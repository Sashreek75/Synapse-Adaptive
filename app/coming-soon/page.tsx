import Link from "next/link";

export const metadata = { title: "Almost ready" };

export default function ComingSoon({ searchParams }: { searchParams: { os?: string } }) {
  const name = searchParams.os === "mac" ? "Mac" : "Windows";
  return (
    <main className="lp" style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: 30, margin: "0 0 12px", letterSpacing: "-.02em" }}>Synapse for {name} is almost ready.</h1>
        <p style={{ color: "#8aa0b8", lineHeight: 1.6 }}>The installer is being built and hasn&apos;t been published yet. Check back soon.</p>
        <p style={{ marginTop: 26 }}><Link href="/" className="lp-cta">Back</Link></p>
      </div>
    </main>
  );
}
