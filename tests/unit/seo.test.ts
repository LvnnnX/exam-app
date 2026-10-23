import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HOME_TITLE, SITE_URL, publicPage } from '../../src/lib/site.ts';

describe('seo: site identity', () => {
  it('canonical host is www without trailing slash', () => {
    assert.equal(SITE_URL, process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') || 'https://www.osn-smandapura.my.id');
    assert.ok(!SITE_URL.endsWith('/'));
  });

  it('home title carries the keywords and no invented claims', () => {
    assert.match(HOME_TITLE, /OSN/);
    assert.match(HOME_TITLE, /SMAN 2 Amlapura/);
    assert.doesNotMatch(HOME_TITLE, /\d+\s*(juara|medali|siswa|soal)|terbaik|#1/i);
  });

  it('publicPage keeps locale and siteName after the shallow openGraph merge', () => {
    const m = publicPage('/ujian', 'T', 'D');
    assert.deepEqual(m.alternates, { canonical: '/ujian' });
    assert.equal((m.openGraph as { locale?: string }).locale, 'id_ID');
    assert.equal(m.openGraph?.siteName, 'Smandapura');
    assert.equal(m.openGraph?.url, '/ujian');
  });
});
