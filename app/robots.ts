import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// /admin and /quiz/<code> stay crawlable on purpose: their pages carry
// `noindex`, and a crawler has to fetch a page to see that. Blocking them
// here would let a linked URL be listed without its content.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
