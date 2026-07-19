import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/auth-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const title = "Synapse Adaptive — Your adaptive AI partner";
const description =
  "Synapse Adaptive helps you understand how your body and mind are functioning over time — what changed, why it might have changed, and what's worth discussing with your provider. Not another tracker.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: title, template: "%s · Synapse Adaptive" },
  description,
  applicationName: "Synapse Adaptive",
  keywords: ["adaptive AI", "AI coach", "self-understanding", "habits", "focus", "personal growth"],
  openGraph: {
    type: "website",
    siteName: "Synapse Adaptive",
    title,
    description,
    url: appUrl,
  },
  twitter: { card: "summary_large_image", title, description },
  robots: { index: true, follow: true },
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
