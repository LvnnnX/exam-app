// E2E Fase 7: CSP + security headers tidak mematahkan halaman, KaTeX, tabel, dan upload gambar.
// Usage: node tests/e2e/csp.mjs [baseUrl] (default: http://localhost:3100)
import { chromium } from '@playwright/test';
import pg from 'pg';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const BASE = process.argv[2] || 'http://localhost:3100';
assert.ok(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE), 'local base URL only');
const SHOTS = join(process.env.LOCALAPPDATA || '.', 'Temp');
const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || 'C:/Users/Windows/tools/examapp-storage';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

const violations = [];
const uploaded = [];
const db = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'postgres', user: 'postgres', password: 'password' });
const browser = await chromium.launch({ headless: true });
let failed = false;

function watch(page) {
  page.on('console', (m) => {
    const t = m.text();
    if (/Content Security Policy|Refused to/i.test(t)) violations.push(`${page.url()} :: ${t.slice(0, 200)}`);
  });
  page.on('pageerror', (e) => violations.push(`${page.url()} :: pageerror ${e.message.slice(0, 200)}`));
}

async function step(name, fn) {
  const before = violations.length;
  try {
    await fn();
    assert.equal(violations.length, before, `CSP/console violation:\n${violations.slice(before).join('\n')}`);
    console.log(`PASS ${name}`);
  } catch (e) {
    failed = true;
    console.log(`FAIL ${name}: ${e.message.split('\n').slice(0, 4).join(' | ')}`);
  }
}

try {
  await db.connect();
  const page = await browser.newPage();
  watch(page);

  for (const path of ['/', '/ujian', '/kuis/999999', '/admin/login']) {
    await step(`Halaman ${path} tanpa pelanggaran CSP dan header lengkap`, async () => {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      const h = res.headers();
      assert.match(h['content-security-policy'] || '', /frame-ancestors 'none'/);
      assert.equal(h['x-frame-options'], 'DENY');
      assert.equal(h['x-content-type-options'], 'nosniff');
      assert.ok(h['permissions-policy']?.includes('screen-wake-lock=(self)'));
    });
  }

  await step('Login admin lalu buka /admin/soal', async () => {
    await page.goto(`${BASE}/admin/login`);
    await page.locator('input[type=email]').fill(env.LOCAL_ADMIN_EMAIL);
    await page.locator('input[type=password]').fill(env.LOCAL_ADMIN_PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${BASE}/admin/soal`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Tambah Soal' }).first().click();
    await page.getByText('Tambah Soal Baru').waitFor();
  });

  await step('Sisipkan KaTeX dan tabel di editor', async () => {
    await page.locator('.ProseMirror').first().click();
    await page.locator('button[title="Rumus Matematika (KaTeX)"]').first().click();
    await page.locator('textarea[placeholder^="Contoh"]').fill('\\frac{a}{b} + \\sqrt{x^2}');
    await page.getByRole('button', { name: 'Sisipkan', exact: true }).click();
    await page.locator('.ProseMirror .katex').first().waitFor({ timeout: 5000 });
    const fontOk = await page.evaluate(() => document.fonts.check('16px KaTeX_Main'));
    assert.ok(fontOk, 'KaTeX font loaded');
    await page.locator('.ProseMirror').first().click();
    await page.locator('button[title="Tabel"]').first().click();
    await page.getByRole('button', { name: 'Buat Tabel' }).click();
    await page.locator('.ProseMirror table').first().waitFor({ timeout: 5000 });
  });

  const fileInput = page.locator('input[type=file][accept^="image/"]').first();

  await step('Upload SVG ditolak di client dengan pesan bahasa Indonesia', async () => {
    await fileInput.setInputFiles({ name: 'e2e-f7.png', mimeType: 'image/svg+xml', buffer: SVG });
    await page.getByText('Format gambar tidak didukung').first().waitFor({ timeout: 5000 });
  });

  await step('Upload PNG palsu (isi SVG, MIME png) ditolak magic bytes', async () => {
    await fileInput.setInputFiles({ name: 'e2e-f7.png', mimeType: 'image/png', buffer: SVG });
    await page.getByText('Isi file tidak sesuai format gambar').first().waitFor({ timeout: 5000 });
  });

  await step('Upload PNG asli: nama UUID, ekstensi dari MIME, gambar tampil di bawah CSP', async () => {
    await fileInput.setInputFiles({ name: 'E2E-F7 nama user.GIF', mimeType: 'image/png', buffer: PNG_1X1 });
    const img = page.locator('.ProseMirror img[src*="/exam-images/"]').first();
    await img.waitFor({ timeout: 10000 });
    const src = await img.getAttribute('src');
    const key = src.split('/exam-images/')[1];
    uploaded.push(key);
    assert.match(key, /^images\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/, `key ${key}`);
    await page.waitForFunction(() => document.querySelector('.ProseMirror img[src*="/exam-images/"]')?.naturalWidth > 0, null, { timeout: 5000 });
  });

  await page.screenshot({ path: join(SHOTS, 'e2e-f7-csp-editor.png') });
} catch (e) {
  failed = true;
  console.log(`FAIL setup: ${e.message.split('\n')[0]}`);
} finally {
  for (const key of uploaded) {
    await db.query(`DELETE FROM storage.objects WHERE bucket_id = 'exam-images' AND name = $1`, [key]).catch(() => {});
    const f = join(STORAGE_DIR, 'exam-images', ...key.split('/'));
    if (existsSync(f)) unlinkSync(f);
  }
  await browser.close();
  await db.end().catch(() => {});
}

if (violations.length) console.log(`Violations:\n${violations.join('\n')}`);
process.exit(failed ? 1 : 0);
