import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://synapse-adaptive.vercel.app";
const title = "Synapse Adaptive — AI Accountability Partner for Your Goals";
const description =
  "Synapse is an AI goal operating system and accountability partner. It remembers what you're working toward, helps you lock in and follow through, adapts when life changes, and never lets your important goals quietly disappear. ChatGPT helps you think — Synapse helps you achieve.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: title, template: "%s · Synapse Adaptive" },
  description,
  applicationName: "Synapse Adaptive",
  keywords: [
    "AI accountability partner", "accountability", "AI accountability", "accountability app",
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

export const viewport = { themeColor: "#0b1f3a", width: "device-width", initialScale: 1, viewportFit: "cover" as const };

const themeScript = `
(function(){try{
  var t = localStorage.getItem('theme');
  if(!t){ t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  if(t==='dark'){ document.documentElement.classList.add('dark'); }
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className={inter.variable}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
