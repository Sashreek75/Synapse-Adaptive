import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL || "https://synapse-adaptive.vercel.app";

/** Let search engines crawl the public marketing site; keep the signed-in app + API out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/daily", "/stats", "/report", "/playbook", "/goals", "/workspaces", "/tools", "/settings", "/billing", "/onboarding"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
