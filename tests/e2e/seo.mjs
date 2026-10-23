// E2E SEO: robots.txt, sitemap.xml, home metadata + JSON-LD, noindex on /admin and /kuis, /ujian H1.
// Usage: node tests/e2e/seo.mjs [baseUrl] (default: http://localhost:3100). Read-only, no DB writes.
import assert from 'node:assert/strict';

const BASE = process.argv[2] || 'http://localhost:3100';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.osn-smandapura.my.id').replace(/\/+$/, '');
let failed = false;

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failed = true;
    console.log(`FAIL ${name}: ${e.message}`);
  }
}
const get = async (path) => {
  const r = await fetch(BASE + path, { redirect: 'manual' });
  return { status: r.status, type: r.headers.get('content-type') || '', body: await r.text() };
};
const meta = (html, attr, key) =>
  html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1]?.replace(/&amp;/g, '&');

await check('robots.txt: allow public, disallow private, absolute sitemap', async () => {
  const { status, body } = await get('/robots.txt');
  assert.equal(status, 200);
  for (const line of ['Allow: /', 'Allow: /ujian', 'Disallow: /admin', 'Disallow: /api/', 'Disallow: /kuis/']) {
    assert.ok(body.split('\n').includes(line), `missing "${line}"`);
  }
  assert.ok(body.includes(`Sitemap: ${SITE}/sitemap.xml`), 'sitemap not absolute');
});

await check('sitemap.xml: exactly / and /ujian', async () => {
  const { status, body } = await get('/sitemap.xml');
  assert.equal(status, 200);
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  assert.deepEqual(locs, [`${SITE}/`, `${SITE}/ujian`]);
});

await check('home: title, description, canonical, OG, Twitter, JSON-LD', async () => {
  const { status, body } = await get('/');
  assert.equal(status, 200);
  const title = body.match(/<title>([^<]*)<\/title>/)?.[1]?.replace(/&amp;/g, '&');
  assert.equal(title, 'Kuis & Latihan Soal OSN · SMAN 2 Amlapura');
  assert.ok((meta(body, 'name', 'description') || '').length > 50, 'description too short');
  assert.ok(body.includes(`<link rel="canonical" href="${SITE}"`), 'canonical');
  assert.equal(meta(body, 'property', 'og:locale'), 'id_ID');
  assert.equal(meta(body, 'property', 'og:title'), title);
  assert.ok(meta(body, 'property', 'og:image')?.startsWith(`${SITE}/opengraph-image`), 'og:image absolute');
  assert.equal(meta(body, 'name', 'twitter:card'), 'summary_large_image');
  assert.ok(!/<meta name="robots"[^>]*noindex/.test(body), 'home must be indexable');
  const ld = JSON.parse(body.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  const types = ld['@graph'].map((n) => n['@type']).sort();
  assert.deepEqual(types, ['EducationalOrganization', 'WebSite']);
  assert.equal(ld['@graph'].find((n) => n['@type'] === 'EducationalOrganization').name, 'SMAN 2 Amlapura');
});

await check('og image: 1200x630 PNG', async () => {
  const r = await fetch(BASE + '/opengraph-image');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  const buf = Buffer.from(await r.arrayBuffer());
  assert.deepEqual([buf.readUInt32BE(16), buf.readUInt32BE(20)], [1200, 630]);
});

await check('icons + manifest served', async () => {
  for (const p of ['/favicon.ico', '/icon.png', '/apple-icon.png', '/manifest.webmanifest']) {
    assert.equal((await get(p)).status, 200, p);
  }
});

await check('/ujian: own title, canonical, one H1 in server HTML', async () => {
  const { status, body } = await get('/ujian');
  assert.equal(status, 200);
  assert.match(body, /<title>Latihan Soal OSN Mandiri: Mode Exam &amp; Survival · Smandapura<\/title>/);
  assert.ok(body.includes(`<link rel="canonical" href="${SITE}/ujian"`), 'canonical');
  assert.equal((body.match(/<h1[\s>]/g) || []).length, 1, 'expected exactly one <h1>');
});

await check('/admin/login: noindex,nofollow and its own title', async () => {
  const { status, body } = await get('/admin/login');
  assert.equal(status, 200);
  assert.equal(meta(body, 'name', 'robots'), 'noindex, nofollow');
  assert.match(body, /<title>Login Admin · Smandapura<\/title>/);
});

await check('/kuis/<kode>: noindex,nofollow', async () => {
  const { body } = await get('/kuis/000000');
  assert.equal(meta(body, 'name', 'robots'), 'noindex, nofollow');
});

process.exit(failed ? 1 : 0);
