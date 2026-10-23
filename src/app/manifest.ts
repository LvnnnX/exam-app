import type { MetadataRoute } from 'next';
import { HOME_DESCRIPTION, HOME_TITLE, SITE_NAME } from '@/src/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: HOME_TITLE,
    short_name: SITE_NAME,
    description: HOME_DESCRIPTION,
    lang: 'id',
    start_url: '/',
    display: 'standalone',
    background_color: '#e9efee',
    theme_color: '#2a6858',
    icons: [{ src: '/icon.png', sizes: '512x512', type: 'image/png' }],
  };
}
