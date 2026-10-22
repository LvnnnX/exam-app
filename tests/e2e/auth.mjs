// E2E Test Suite Fase 6: Auth Admin, Super Admin Approval, Role Management & RBAC
// Usage: node tests/e2e/auth.mjs [baseUrl] (default: http://localhost:3100)
import { chromium } from '@playwright/test';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const BASE = process.argv[2] || 'http://localhost:3100';
assert.ok(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE), 'local base URL only');
const SHOTS = join(process.env.LOCALAPPDATA || '.', 'Temp');

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const db = new pg.Client({
  host: '127.0.0.1',
  port: 54329,
  database: 'postgres',
  user: 'postgres',
  password: 'password',
});

const results = [];
const ok = (name, detail = '') => {
  results.push(`PASS ${name}${detail ? ` (${detail})` : ''}`);
};

async function dismissDevOverlay(p) {
  await p
    .evaluate(() => {
      document.querySelector('script[data-nextjs-dev-overlay]')?.remove();
      document.querySelectorAll('nextjs-portal').forEach((el) => el.remove());
    })
    .catch(() => {});
}

console.log('='.repeat(60));
console.log('E2E TEST SUITE: FASE 6 (AUTH & SUPER ADMIN APPROVAL)');
console.log('Target URL:', BASE);
console.log('='.repeat(60));

await db.connect();

const TEST_NEW_USER = {
  username: 'guru_e2e_fase6',
  email: 'guru_e2e_fase6@test.local',
  password: 'PasswordSuper123!',
};

// Cleanup data sisa run sebelumnya
await db.query(`DELETE FROM public.admins WHERE username = $1`, [TEST_NEW_USER.username]);
await db.query(`DELETE FROM auth.users WHERE lower(email) = lower($1)`, [TEST_NEW_USER.email]);
await db.query(`DELETE FROM public.admin_login_attempts WHERE lower(identifier) = lower($1)`, [TEST_NEW_USER.email]);

const browser = await chromium.launch({ headless: true });

try {
  // =========================================================================
  // SKENARIO 1: Middleware & Anon Route Protection
  // =========================================================================
  console.log('[1/8] Menguji Middleware: Anon route protection ke /admin/soal');
  const anonCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const anonPage = await anonCtx.newPage();

  await anonPage.goto(`${BASE}/admin/soal`);
  await anonPage.waitForURL((u) => u.pathname.includes('/admin/login'), { timeout: 15000 });
  assert.ok(anonPage.url().includes('/admin/login'), 'Anon harus diredirect ke login');
  assert.ok(anonPage.url().includes('redirect='), 'URL harus menyimpan target redirect');

  await anonPage.screenshot({ path: join(SHOTS, 'auth-01-middleware-redirect.png') });
  ok('Skenario 1: Middleware mengalihkan anonim dari /admin/soal ke /admin/login');
  await anonCtx.close();

  // =========================================================================
  // SKENARIO 2: Registrasi Admin Baru (Status Pending)
  // =========================================================================
  console.log('[2/8] Menguji Registrasi Admin Baru di /admin/register');
  const regCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const regPage = await regCtx.newPage();

  await regPage.goto(`${BASE}/admin/register`);
  await dismissDevOverlay(regPage);

  await regPage.locator('input[name="username"]').fill(TEST_NEW_USER.username);
  await regPage.locator('input[name="email"]').fill(TEST_NEW_USER.email);
  await regPage.locator('input[name="password"]').fill(TEST_NEW_USER.password);
  await regPage.locator('input[name="confirmPassword"]').fill(TEST_NEW_USER.password);

  await regPage.locator('button[type="submit"]').click();

  // Tunggu layar sukses
  const successCard = regPage.locator('[data-testid="register-success-view"]');
  await successCard.waitFor({ timeout: 15000 });
  assert.ok(await successCard.isVisible(), 'Layar permohonan terkirim harus tampil');
  const successText = await successCard.innerText();
  assert.ok(successText.includes('Permohonan Telah Dikirim'), 'Teks permohonan terkirim harus ada');
  assert.ok(successText.includes('Pending'), 'Status pending harus disebutkan');

  await regPage.screenshot({ path: join(SHOTS, 'auth-02-register-pending-screen.png') });
  ok('Skenario 2: Form registrasi admin berhasil dikirim dan menampilkan layar pending');
  await regCtx.close();

  // Verifikasi status di DB
  const dbCheckPending = await db.query(
    `SELECT role, status FROM public.admins WHERE username = $1`,
    [TEST_NEW_USER.username],
  );
  assert.equal(dbCheckPending.rowCount, 1, 'Admin baru harus terdaftar di DB');
  assert.equal(dbCheckPending.rows[0].role, 'admin');
  assert.equal(dbCheckPending.rows[0].status, 'pending');

  // =========================================================================
  // SKENARIO 3: Admin Berstatus Pending Ditolak Login
  // =========================================================================
  console.log('[3/8] Menguji Pencegahan Login untuk Admin Pending');
  const pendLoginCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pendLoginPage = await pendLoginCtx.newPage();

  await pendLoginPage.goto(`${BASE}/admin/login`);
  await dismissDevOverlay(pendLoginPage);

  await pendLoginPage.locator('input[name="email"]').fill(TEST_NEW_USER.email);
  await pendLoginPage.locator('input[name="password"]').fill(TEST_NEW_USER.password);
  await pendLoginPage.locator('button[type="submit"]').click();

  const pendErrAlert = pendLoginPage.locator('[data-testid="login-error-alert"]');
  await pendErrAlert.waitFor({ timeout: 15000 });
  const errText = await pendErrAlert.innerText();
  assert.ok(errText.includes('menunggu persetujuan super admin'), 'Pesan harus menjelaskan status pending');
  assert.ok(pendLoginPage.url().includes('/admin/login'), 'Tetap di login page');

  await pendLoginPage.screenshot({ path: join(SHOTS, 'auth-03-pending-login-blocked.png') });
  ok('Skenario 3: Login admin berstatus pending ditolak dengan pesan informatif');
  await pendLoginCtx.close();

  // =========================================================================
  // SKENARIO 4: Super Admin Login & Masuk Dashboard
  // =========================================================================
  console.log('[4/8] Menguji Login Super Admin');
  const superCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const superPage = await superCtx.newPage();

  await superPage.goto(`${BASE}/admin/login`);
  await dismissDevOverlay(superPage);

  await superPage.locator('input[name="email"]').fill(env.LOCAL_ADMIN_EMAIL);
  await superPage.locator('input[name="password"]').fill(env.LOCAL_ADMIN_PASSWORD);
  await superPage.locator('button[type="submit"]').click();

  await superPage.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
  assert.ok(superPage.url().includes('/admin/soal'), 'Super admin diarahkan ke /admin/soal');

  // Cek navbar memiliki badge super_admin dan link Kelola Admin
  await superPage.waitForSelector('text=super_admin');
  const kelolaLink = superPage.locator('a[href="/admin/kelola-admin"]');
  assert.ok(await kelolaLink.isVisible(), 'Link Kelola Admin harus ada di navbar super admin');

  await superPage.screenshot({ path: join(SHOTS, 'auth-04-super-admin-dashboard.png') });
  ok('Skenario 4: Super admin berhasil login dan memiliki tab Kelola Admin di navbar');

  // =========================================================================
  // SKENARIO 5: Super Admin Menyetujui (Approve) Permohonan Admin Baru
  // =========================================================================
  console.log('[5/8] Menguji Approval Admin di /admin/kelola-admin');
  await superPage.goto(`${BASE}/admin/kelola-admin`);
  await dismissDevOverlay(superPage);

  // Cari kartu pending untuk TEST_NEW_USER
  const pendingUserCard = superPage.getByText(TEST_NEW_USER.username, { exact: true });
  await pendingUserCard.waitFor({ timeout: 15000 });

  // Cari admin id dari DB untuk testid presisi
  const adminIdRow = await db.query(
    `SELECT id FROM public.admins WHERE username = $1`,
    [TEST_NEW_USER.username],
  );
  const newAdminId = adminIdRow.rows[0].id;

  const approveBtn = superPage.locator(`[data-testid="approve-btn-${newAdminId}"]`);
  await approveBtn.waitFor({ timeout: 5000 });
  await approveBtn.click();

  // Banner sukses muncul
  const feedbackAlert = superPage.locator('[data-testid="admin-feedback-alert"]');
  await feedbackAlert.waitFor({ timeout: 10000 });
  const feedbackText = await feedbackAlert.innerText();
  assert.ok(feedbackText.includes('berhasil disetujui'), 'Banner feedback approval harus tampil');

  await superPage.screenshot({ path: join(SHOTS, 'auth-05-super-admin-approve.png') });
  ok('Skenario 5: Super admin menyetujui permohonan admin baru dengan konfirmasi feedback');

  // Verifikasi status di DB menjadi active
  const dbCheckActive = await db.query(
    `SELECT status, reviewed_at FROM public.admins WHERE id = $1`,
    [newAdminId],
  );
  assert.equal(dbCheckActive.rows[0].status, 'active', 'Status di DB harus active setelah approval');
  assert.ok(dbCheckActive.rows[0].reviewed_at, 'reviewed_at harus terisi');

  // =========================================================================
  // SKENARIO 6: Admin yang Baru Disetujui Sekarang Bisa Login
  // =========================================================================
  console.log('[6/8] Menguji Login Admin yang Baru Disetujui');
  const newAdminCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const newAdminPage = await newAdminCtx.newPage();

  await newAdminPage.goto(`${BASE}/admin/login`);
  await dismissDevOverlay(newAdminPage);

  await newAdminPage.locator('input[name="email"]').fill(TEST_NEW_USER.email);
  await newAdminPage.locator('input[name="password"]').fill(TEST_NEW_USER.password);
  await newAdminPage.locator('button[type="submit"]').click();

  await newAdminPage.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
  assert.ok(newAdminPage.url().includes('/admin/soal'), 'Admin baru diarahkan ke /admin/soal');

  // Cek navbar: ada badge 'admin' dan TIDAK ADA link 'Kelola Admin'
  await newAdminPage.waitForSelector('text=admin');
  const kelolaLinkForNormal = newAdminPage.locator('a[href="/admin/kelola-admin"]');
  assert.equal(await kelolaLinkForNormal.count(), 0, 'Admin biasa tidak memiliki link Kelola Admin');

  await newAdminPage.screenshot({ path: join(SHOTS, 'auth-06-approved-admin-login.png') });
  ok('Skenario 6: Admin yang disetujui berhasil login dan masuk ke panel Bank Soal');

  // =========================================================================
  // SKENARIO 7: Admin Biasa Ditolak Akses /admin/kelola-admin (403 Forbidden)
  // =========================================================================
  console.log('[7/8] Menguji 403 Forbidden saat Admin Biasa Membuka /admin/kelola-admin');
  const forbiddenRes = await newAdminPage.goto(`${BASE}/admin/kelola-admin`);
  assert.equal(forbiddenRes?.status(), 403, 'HTTP status /admin/kelola-admin untuk admin biasa harus 403');
  await dismissDevOverlay(newAdminPage);

  const forbiddenCard = newAdminPage.locator('[data-testid="forbidden-card"]');
  await forbiddenCard.waitFor({ timeout: 10000 });
  assert.ok(await forbiddenCard.isVisible(), 'Layar 403 Forbidden harus muncul');
  const forbiddenText = await forbiddenCard.innerText();
  assert.ok(forbiddenText.includes('403'), 'Teks 403 harus ada');
  assert.ok(forbiddenText.includes('Akses Ditolak'), 'Teks Akses Ditolak harus ada');
  assert.ok(forbiddenText.includes('Super Admin'), 'Pesan harus menjelaskan hak akses Super Admin');

  await newAdminPage.screenshot({ path: join(SHOTS, 'auth-07-admin-403-forbidden.png') });
  ok('Skenario 7: Admin biasa diblokir dari /admin/kelola-admin dengan HTTP 403 + layar Forbidden', `status=${forbiddenRes?.status()}`);

  // =========================================================================
  // SKENARIO 8: Logout Admin
  // =========================================================================
  console.log('[8/8] Menguji Logout Admin');
  const logoutBtn = newAdminPage.locator('button[title="Keluar"]');
  await logoutBtn.waitFor({ timeout: 5000 });
  await logoutBtn.click();

  await newAdminPage.waitForURL((u) => u.pathname.includes('/admin/login'), { timeout: 15000 });
  assert.ok(newAdminPage.url().includes('/admin/login'), 'Harus kembali ke /admin/login setelah logout');

  await newAdminPage.screenshot({ path: join(SHOTS, 'auth-08-logout-success.png') });
  ok('Skenario 8: Logout berhasil dan sesi auth terhapus dengan aman');

  await newAdminCtx.close();
  await superCtx.close();
} finally {
  await browser.close();
  await db.query(`DELETE FROM public.admins WHERE username = $1`, [TEST_NEW_USER.username]);
  await db.query(`DELETE FROM auth.users WHERE lower(email) = lower($1)`, [TEST_NEW_USER.email]);
  await db.query(`DELETE FROM public.admin_login_attempts WHERE lower(identifier) = lower($1)`, [TEST_NEW_USER.email]);
  await db.end();
}

console.log('\n' + '='.repeat(60));
console.log('HASIL TEST SUITE E2E FASE 6:');
results.forEach((r) => console.log('  ' + r));
console.log('='.repeat(60));
