import type { MetadataRoute } from "next";

// Strip any trailing slash so we never emit "example.com//sitemap.xml".
const base = (process.env.NEXT_PUBLIC_APP_URL || "https://synapse-adaptive.vercel.app").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
}
