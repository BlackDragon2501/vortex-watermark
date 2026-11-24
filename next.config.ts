import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages: export estatico (CF_PAGES lo inyecta Cloudflare); Vercel mantiene standalone.
  output: process.env.CF_PAGES ? "export" : "standalone",
  /* config options here */
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingRoot: process.cwd(),
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
