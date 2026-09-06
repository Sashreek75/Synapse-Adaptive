import type { MetadataRoute } from "next";

// Strip any trailing slash so we never emit "example.com//sitemap.xml".
const base = (process.env.NEXT_PUBLIC_APP_URL || "https://synapse-adaptive.vercel.app").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // Public, indexable pages only. /login is a utility/auth page, so it's excluded.
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
