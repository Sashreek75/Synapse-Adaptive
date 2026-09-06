/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Type-safety is enforced via `tsc`; keep lint nits from blocking production builds.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        // Long-lived caching for static image/icon assets in /public (they're content-hashed by name
        // when they change, or rarely change at all).
        source: "/:file(.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff|woff2))",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // The service worker must NOT be cached hard, or clients get stuck on an old SW.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
