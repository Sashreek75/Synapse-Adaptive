import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";
import { VortexBackground } from "@/components/ui/vortex-lazy";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://synapse-adaptive.vercel.app";
const title = "Synapse Adaptive — Your Partner in Follow-Through";
const description =
  "Synapse is your partner in follow-through: it helps you consistently finish what you start on the goals that matter most — bringing clarity when you are overwhelmed, accountability when you are drifting, and support when you are struggling, so your intentions become outcomes. A coach gives advice; a partner stays on the hook until your behaviour changes.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: title, template: "%s · Synapse Adaptive" },
  description,
  applicationName: "Synapse Adaptive",
  keywords: [
    "partner in follow-through", "follow through", "follow-through partner", "execution partner", "accountability partner", "AI accountability partner", "accountability", "accountability app",
    "AI partner for locking in", "lock in", "AI goal tracker", "goal operating system",
    "achieve your goals", "AI coach", "AI productivity partner", "follow through", "momentum",
    "adaptive AI companion", "AI goal planner", "Synapse Adaptive",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Synapse Adaptive",
    title,
    description,
    url: appUrl,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title, description, creator: "@synapseadaptive" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  category: "productivity",
  // Google Search Console (URL-prefix property, "HTML tag" method).
  // Renders <meta name="google-site-verification" content="..."> into <head>.
  verification: {
    google: "IyfD8XLrFQDIbEn3cv9FMGiPi6JtXDhAohKuCA73anc",
  },
};

export const viewport = { themeColor: "#04070d", width: "device-width", initialScale: 1, viewportFit: "cover" as const };

const themeScript = `
(function(){try{
  /* Synapse runs on a single black, navy-and-orange identity. Force the dark theme on and clear any
     stale saved preference so the look is consistent for everyone. */
  document.documentElement.classList.add('dark');
  localStorage.removeItem('theme');
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className={inter.variable}>
        {/* Site-wide living background: a navy+orange neural vortex over black, with a soft scrim
            on top so foreground text and cards stay readable. */}
        <VortexBackground className="opacity-80" />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{ background: "radial-gradient(125% 85% at 50% -5%, rgba(4,7,13,.30), rgba(4,7,13,.74) 72%)" }}
        />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
