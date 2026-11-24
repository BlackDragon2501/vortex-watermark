import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages: export estatico (CF_PAGES lo inyecta Cloudflare); Vercel mantiene standalone.
  // Vercel mantiene standalone; cualquier otro hosting (Pages, Workers, etc) exporta estatico.
  output: process.env.VERCEL ? "standalone" : "export",
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
