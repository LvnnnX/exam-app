import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// The home page is the only public page with lasting content; live quiz
// pages exist only for the length of a session and the admin is private.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
