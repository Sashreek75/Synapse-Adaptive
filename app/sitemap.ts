import type { MetadataRoute } from "next";

// Strip any trailing slash so we never emit "example.com//sitemap.xml".
const base = (process.env.NEXT_PUBLIC_APP_URL || "https://synapse-adaptive.vercel.app").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // Only the public marketing page belongs in the index. /login is a utility/auth page, not content.
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
  ];
}
