import type { NextConfig } from "next";

const securityHeaders = [
  // SECURITY: Baseline OWASP security headers required by SECURITY.md.
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Strict-Transport-Security tells browsers to refuse downgraded HTTP for
  // two years and to include subdomains. Only emitted in production so local
  // http://localhost:3000 dev sessions are not pinned.
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        { key: "X-DNS-Prefetch-Control", value: "off" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      ]
    : []),
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const longCacheHeaders = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

const nextConfig: NextConfig = {
  // Disable the X-Powered-By: Next.js fingerprint.
  poweredByHeader: false,
  // Compress responses at the edge. No-op when fronted by a CDN that already
  // compresses, but avoids serving uncompressed bytes from origin.
  compress: true,
  // Disable client-side source maps so production bundles don't ship
  // un-minified TypeScript to the browser.
  productionBrowserSourceMaps: false,
  experimental: {
    // Drop console.* in production except errors and warnings to keep the
    // bundle slim and avoid leaking debug data via the browser console.
    optimizePackageImports: ["lucide-react", "framer-motion", "katex"],
  },
  compiler: {
    removeConsole: { exclude: ["error", "warn"] },
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Static mount SVGs and bundled images can be cached aggressively.
      // /_next/static already gets immutable headers from Next; only override
      // /public assets we treat as immutable.
      { source: "/mounts/(.*)", headers: longCacheHeaders },
      { source: "/horse.svg", headers: longCacheHeaders },
    ];
  },
};

export default nextConfig;
