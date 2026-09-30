import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy", description: "What the Synapse app sees, what it keeps, and what leaves your computer." };

const UPDATED = "September 30, 2026";
const CONTACT = "privacy@synapseadaptive.com";

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-5 py-16">
      <Link href="/" className="text-sm text-muted hover:text-ink">← Synapse</Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink">Privacy</h1>
      <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>
      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-muted">
        <section>
          <h2 className="text-lg font-semibold text-ink">What Synapse sees</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li><b className="text-ink">The window in front.</b> Every few seconds the app notes which program is in front, its window title, and how long your computer has been idle, so it knows whether you&apos;ve been working.</li>
            <li><b className="text-ink">The site you&apos;re on.</b> If you install the browser helper, it tells the app the address and title of the tab you&apos;re looking at, so the app can recognise the sites you listed as distractions.</li>
            <li><b className="text-ink">Your screen, only when you ask.</b> When you send a question with the eye switched on, the app takes one screenshot so Synapse can see what you mean. It isn&apos;t saved.</li>
            <li><b className="text-ink">What you tell it.</b> Your goals, what you&apos;re working on, and your conversations with the orb.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink">Where it&apos;s kept</h2>
          <p className="mt-3">On your computer, in one file in your Windows user folder (<code>%APPDATA%\Synapse\brain.json</code>). Activity is kept for 24 hours; the rest stays until you delete the file or uninstall. There are no accounts and nothing is synced.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink">What leaves your computer</h2>
          <p className="mt-3">When Synapse needs to think — judging a case at the gate, or answering you — the app sends that request (including the relevant context: your goals, recent window titles, and a screenshot if you shared one) through our relay to Google&apos;s Gemini API. The relay adds our API key and passes the answer back. It does not store requests. Google processes them under its Gemini API terms.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink">Contact</h2>
          <p className="mt-3"><a className="text-ink underline" href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
        </section>
      </div>
    </main>
  );
}
