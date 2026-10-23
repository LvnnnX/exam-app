import type { Metadata } from 'next';

// Public identity of the site for metadata, robots.txt, sitemap and the share image.
// The apex domain redirects to www, so www is the canonical host.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://www.osn-smandapura.my.id').replace(/\/+$/, '');

export const SITE_NAME = 'Smandapura';
export const SCHOOL_NAME = 'SMAN 2 Amlapura';
export const HOME_TITLE = `Kuis & Latihan Soal OSN · ${SCHOOL_NAME}`;
export const HOME_DESCRIPTION =
  `Gabung kuis live dengan kode dari guru, atau latihan soal OSN secara mandiri (mode Exam dan Survival) `
  + `dengan soal acak per mapel, bab, dan sub-bab. Untuk siswa ${SCHOOL_NAME}.`;

// Canonical + Open Graph for one public page. Page-level openGraph replaces the root one
// (shallow merge), so siteName/locale are repeated here instead of relying on inheritance.
export function publicPage(path: string, title: string, description: string): Metadata {
  return {
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', locale: 'id_ID', siteName: SITE_NAME, url: path, title, description },
  };
}
