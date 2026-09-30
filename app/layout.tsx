import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://synapse-adaptive.vercel.app";
const title = "Synapse — the layer between what you intend to do and what you actually do";
const description =
  "Synapse is a small orb at the edge of your Windows screen. It stays quiet while you work, stops you at the moment you reach for a distraction, and makes you give a real reason. Get Synapse for Windows.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: title, template: "%s · Synapse" },
  description,
  applicationName: "Synapse",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Synapse", title, description, url: appUrl, locale: "en_US" },
  twitter: { card: "summary_large_image", title, description },
  robots: { index: true, follow: true },
  category: "productivity",
  verification: { google: "IyfD8XLrFQDIbEn3cv9FMGiPi6JtXDhAohKuCA73anc" },
};

export const viewport = { themeColor: "#04070d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
