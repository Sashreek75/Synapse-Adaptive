/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Type-safety is enforced via `tsc`; keep lint nits from blocking production builds.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
