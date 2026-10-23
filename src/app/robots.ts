import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/src/lib/site';

// /admin and /kuis/<kode> also send noindex. A disallowed URL is never fetched, so a page linked
// from elsewhere could still be listed URL-only; Search Console "Removals" covers that case.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/ujian'],
      disallow: ['/admin', '/api/', '/kuis/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
