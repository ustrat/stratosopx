import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export, served from Cloudflare Workers static assets (see wrangler.jsonc).
  // Partial prerendering (cacheComponents) is not available in export mode.
  output: "export",
  // Shared TypeScript source from packages/core.
  transpilePackages: ["@stratosopx/core"],
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
