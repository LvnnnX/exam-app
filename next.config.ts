import type { NextConfig } from 'next';

const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321').origin;
const supabaseWs = supabaseOrigin.replace(/^http/, 'ws');
const isDev = process.env.NODE_ENV === 'development';

// ponytail: script-src 'unsafe-inline' for Next App Router inline bootstrap scripts. A per-request
// nonce via src/proxy.ts would drop it but forces every page dynamic (no static/ISR) and widens the
// proxy matcher beyond /admin. Upgrade to nonce + 'strict-dynamic' if an XSS sink ever appears;
// DOMPurify on save and render is the primary XSS control today.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), screen-wake-lock=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=15552000' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  // Lets parallel local builds (e.g. one agent on :3100, another on :3101) not clobber each other's .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    // forbidden() in /admin/kelola-admin: real HTTP 403 for non super admins.
    authInterrupts: true,
    optimizePackageImports: ['lucide-react', 'katex'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
