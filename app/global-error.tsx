"use client";

/**
 * Last-resort boundary for errors thrown in the ROOT layout itself (where the normal error.tsx
 * can't render because the layout is what failed). Must ship its own <html>/<body> and can't rely
 * on the app's CSS, so it uses inline styles only.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#04070d", color: "#eef4fb", fontFamily: "system-ui, sans-serif", padding: "24px", textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 600, margin: 0 }}>Something went wrong.</h1>
          <p style={{ color: "#93a6ba", marginTop: 12, maxWidth: 420 }}>We hit an unexpected error loading the app. Please try again.</p>
          <button
            onClick={() => reset()}
            style={{ marginTop: 24, padding: "10px 20px", borderRadius: 12, border: "none", background: "#f97316", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
          {error?.digest && <p style={{ color: "#5f7186", marginTop: 20, fontSize: 12 }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
