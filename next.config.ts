import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Dev-only "instant navigation" checks: the framework default validates every page, and nearly every screen here waits for the signed-in
    // user, so each one would report "Could not validate that a segment has instant navigation". Only segments that ask for it are checked.
    // (See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md.)
    instantInsights: { validationLevel: "manual-warning" },
  },
  // The marketing home page and the public Terms / Privacy pages are the prototype's static pages (public/home, public/terms,
  // public/privacy: their own CSS and scripts, no Tailwind base styles). Open to everyone, signed in or not.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/home/index.html" },
        { source: "/terms", destination: "/terms/index.html" },
        { source: "/privacy", destination: "/privacy/index.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  turbopack: {
    // The repo root also has a package-lock.json (the Vite prototype); pin the root to this app.
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
