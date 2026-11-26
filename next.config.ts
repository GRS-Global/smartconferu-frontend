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
  // Baseline security headers on every page (BUG-007 in docs/qa/BUG_REPORT.md). The CSP is deliberately the safe part only (framing, <base>,
  // plugins, form targets): a script-src / connect-src policy would have to list the API, fonts, images and Next's inline scripts, and is a
  // separate piece of work. HSTS is left to the host / CDN (it must only be sent over HTTPS).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
        ],
      },
    ];
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
