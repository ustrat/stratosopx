import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export, served from Cloudflare Workers static assets (see wrangler.jsonc).
  // Partial prerendering (cacheComponents) is not available in export mode.
  output: "export",
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
