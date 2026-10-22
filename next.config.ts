import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
