// Public identity of the site, used by metadata, robots.txt, the sitemap,
// and the share image. The apex domain redirects to www, so www is canonical.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://www.osn-smandapura.my.id').replace(/\/+$/, '');

export const SITE_NAME = 'Smandapura Shuffled Exam';

export const SITE_TAGLINE = 'Latihan soal OSK dan OSN 2026 Smandapura';

export const SITE_DESCRIPTION =
  'Latihan soal OSK dan OSN 2026 untuk siswa Smandapura. Ujian dengan soal acak per mapel, bab, dan sub-bab, '
  + 'ujian terjadwal dengan kode akses, dan kuis live bersama guru.';
