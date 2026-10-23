import type { Metadata } from 'next';
import HomeClient from './HomeClient';
import { HOME_DESCRIPTION, HOME_TITLE, SCHOOL_NAME, SITE_NAME, SITE_URL, publicPage } from '@/src/lib/site';

export const metadata: Metadata = publicPage('/', HOME_TITLE, HOME_DESCRIPTION);

// Only facts the app itself states: site name, language, school name. No address or phone (no source).
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      inLanguage: 'id-ID',
      description: HOME_DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#school` },
    },
    { '@type': 'EducationalOrganization', '@id': `${SITE_URL}/#school`, name: SCHOOL_NAME, url: `${SITE_URL}/` },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <HomeClient />
    </>
  );
}
