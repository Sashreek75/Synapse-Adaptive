import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Synapse Adaptive collects, uses, and protects your data.",
};

const UPDATED = "September 6, 2026";
const CONTACT = "privacy@synapseadaptive.com";

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-5 py-16 sm:py-20">
      <Link href="/" className="text-sm text-muted transition-colors hover:text-ink">← Back to home</Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>

      <div className="prose-invert mt-8 space-y-8 text-[15px] leading-relaxed text-muted">
        <section>
          <p>Synapse Adaptive (&ldquo;Synapse,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is an AI companion that helps you follow through on your goals. This policy explains what we collect, why, and the control you have. We built Synapse to be private by design: your data is yours, and we never sell it.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">What we collect</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li><b className="text-ink">Account information.</b> If you create an account, our authentication provider (Supabase) stores your email and a securely hashed password, or your Google account identifier if you sign in with Google.</li>
            <li><b className="text-ink">What you tell Synapse.</b> Your goals, check-ins, planner notes, commitments, and messages to the assistant. Much of this is stored locally on your device; if you&apos;re signed in, a snapshot is synced to your private account so it follows you across devices.</li>
            <li><b className="text-ink">Usage signals.</b> Lightweight information about how you interact with the app (for example, when you last engaged) so Synapse can be a useful companion.</li>
            <li><b className="text-ink">Notifications.</b> If you turn on reach-outs, we store the push subscription your browser provides so we can deliver them.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">How we use it</h2>
          <p className="mt-3">We use your information only to provide and improve Synapse: to remember your goals and progress, to generate personalized guidance, to send the reach-outs you&apos;ve asked for, and to keep the service secure. We do not use your personal content to train third-party models, and we do not sell or rent your data to anyone.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">AI processing</h2>
          <p className="mt-3">To generate responses, relevant context from your account is sent to our AI provider (Google&apos;s Gemini API) to produce a reply, which is returned to you. This processing happens to answer your request; the content you share is handled under that provider&apos;s terms and is not used by us to build advertising profiles.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Service providers</h2>
          <p className="mt-3">We rely on a small set of processors to run Synapse: Supabase (authentication and encrypted data storage), Google Gemini (AI responses), Stripe (payments, if you subscribe), and Resend (transactional email such as receipts). Each receives only the data needed to perform its function.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Your choices and rights</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li><b className="text-ink">Access and export.</b> You can view and export the data associated with your account.</li>
            <li><b className="text-ink">Deletion.</b> You can delete your data or your entire account at any time; deletion removes your synced snapshot from our systems.</li>
            <li><b className="text-ink">Notifications.</b> Reach-outs are opt-in and can be turned off in Settings or in your browser at any time.</li>
            <li><b className="text-ink">Local data.</b> Data stored on your device can be cleared from your browser.</li>
          </ul>
          <p className="mt-3">To make a request, contact us at <a href={`mailto:${CONTACT}`} className="text-orange-400 hover:underline">{CONTACT}</a>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Data retention &amp; security</h2>
          <p className="mt-3">We keep your data for as long as your account is active or as needed to provide the service, and delete it on request. We use industry-standard measures — encryption in transit, row-level access controls so one account can never read another&apos;s data — to protect your information. No system is perfectly secure, but we take this seriously.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Children</h2>
          <p className="mt-3">Synapse is not directed to children under 13 (or the minimum age in your region), and we do not knowingly collect their data.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Changes</h2>
          <p className="mt-3">We may update this policy as the product evolves. We&apos;ll revise the date above and, for material changes, notify you in the app.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Contact</h2>
          <p className="mt-3">Questions? Email <a href={`mailto:${CONTACT}`} className="text-orange-400 hover:underline">{CONTACT}</a>.</p>
        </section>

        <p className="border-t pt-6 text-sm">See also our <Link href="/terms" className="text-orange-400 hover:underline">Terms of Service</Link>.</p>
      </div>
    </main>
  );
}
