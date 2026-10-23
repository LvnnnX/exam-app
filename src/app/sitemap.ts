import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/src/lib/site';

// Only the two public pages. Quiz rooms live for one session; admin is private.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/ujian`, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
