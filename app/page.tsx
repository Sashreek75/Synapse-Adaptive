import Link from "next/link";

/**
 * The website is not Synapse. It explains Synapse and hands you the installer. That's all.
 */
const DOWNLOAD = process.env.NEXT_PUBLIC_DOWNLOAD_URL || "/SynapseSetup.exe";

function Orb({ size = 40 }: { size?: number }) {
  return (
    <span className="orb" style={{ ["--orb" as string]: `${size}px` }} aria-hidden>
      <span className="orb-bloom" /><span className="orb-ring" /><span className="orb-core" /><span className="orb-sheen" />
    </span>
  );
}

export default function Home() {
  return (
    <main id="main" className="lp">
      <nav className="lp-nav">
        <Link href="/" className="lp-brand"><Orb size={26} /> Synapse</Link>
        <a href={DOWNLOAD} className="lp-nav-cta">Get Synapse</a>
      </nav>

      <section className="lp-hero">
        <p className="lp-eyebrow">SYNAPSE</p>
        <h1>The layer between what you intend to do and what you actually do.</h1>
        <a href={DOWNLOAD} className="lp-cta" download>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path fill="currentColor" d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13 7.5 1.1v-7H3v5.9Zm8.4 1.2L21 21v-8.4h-9.6v7.1Zm0-15.4v7.2H21V3l-9.6 1.3Z"/></svg>
          Get Synapse for Windows
        </a>
        <p className="lp-fine">Windows 10 &amp; 11 · free while in beta</p>
      </section>

      <section className="lp-demo" aria-label="How Synapse intervenes">
        <div className="lp-screen">
          <div className="lp-doc">
            <div className="lp-doc-title">Research paper — draft 3</div>
            <div className="lp-line w90" /><div className="lp-line w80" /><div className="lp-line w95" /><div className="lp-line w60" />
            <div className="lp-line w85" /><div className="lp-line w70" />
          </div>
          <div className="lp-tab">youtube.com</div>
          <div className="lp-card">
            <div className="lp-card-head"><Orb size={22} /><span>Synapse</span><b className="lp-count">15</b></div>
            <p className="lp-say s1">Hold on. You&apos;re working on your research paper. Why YouTube?</p>
            <p className="lp-me s2">I&apos;ve been writing for an hour and I&apos;m exhausted. Ten minutes.</p>
            <p className="lp-say s3">Fair. Ten minutes.</p>
          </div>
          <div className="lp-dock"><span className="lp-chip">YouTube 9:59</span><Orb size={34} /></div>
        </div>
      </section>

      <section className="lp-points">
        <div><h2>It stays quiet.</h2><p>A small orb at the edge of your screen. While you work, it doesn&apos;t say a thing.</p></div>
        <div><h2>It stops the impulse.</h2><p>Open a distraction and it asks why. A real reason gets you exactly the time you need. &ldquo;I just felt like it&rdquo; doesn&apos;t.</p></div>
        <div><h2>It sees what you&apos;re doing.</h2><p>Click the orb and ask. It already knows your goals and what&apos;s on your screen, so you don&apos;t have to explain.</p></div>
      </section>

      <section className="lp-end">
        <a href={DOWNLOAD} className="lp-cta" download>Get Synapse for Windows</a>
      </section>

      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} Synapse</span>
        <span><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></span>
      </footer>
    </main>
  );
}
