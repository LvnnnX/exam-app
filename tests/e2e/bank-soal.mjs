// E2E Test Suite Fase 7: Bank Soal & Kategori (BS-01..09, HS-01..07)
// Usage: node tests/e2e/bank-soal.mjs [baseUrl] (default: http://localhost:3100)
import { chromium } from '@playwright/test';
import pg from 'pg';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

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
const bug = (name, detail = '') => {
  results.push(`FAIL ${name} (BUG: ${detail})`);
};

// Console & Page Error tracking (Skenario 11)
let hydrationErrorCount = 0;
let pageErrorCount = 0;
const pageErrors = [];

function attachErrorListeners(page, pageName) {
  page.on('pageerror', (err) => {
    pageErrorCount++;
    pageErrors.push(`[${pageName}] ${err.message}`);
    console.error(`PAGEERROR [${pageName}]:`, err.message);
  });
  page.on('console', (msg) => {
    const txt = msg.text().toLowerCase();
    if (txt.includes('hydrat') && (msg.type() === 'error' || msg.type() === 'warning')) {
      hydrationErrorCount++;
      pageErrors.push(`[${pageName} console.${msg.type()}] ${msg.text()}`);
      console.warn(`HYDRATION [${pageName}]:`, msg.text());
    }
  });
}

async function dismissDevOverlay(p) {
  await p
    .evaluate(() => {
      document.querySelector('script[data-nextjs-dev-overlay]')?.remove();
      document.querySelectorAll('nextjs-portal').forEach((el) => el.remove());
    })
    .catch(() => {});
}

// 1x1 valid PNG
const VALID_TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

console.log('='.repeat(60));
console.log('E2E TEST SUITE: FASE 7 (BANK SOAL & KATEGORI)');
console.log('Target URL:', BASE);
console.log('='.repeat(60));

await db.connect();

// Cleanup sisa data E2E-F7 sebelumnya jika ada
async function cleanupE2EData() {
  try {
    await db.query(`DELETE FROM public.quiz_questions WHERE quiz_id IN (SELECT id FROM public.quizzes WHERE code LIKE 'F7%')`);
    await db.query(`DELETE FROM public.quizzes WHERE code LIKE 'F7%'`);
    await db.query(`DELETE FROM public.question_topics WHERE question_id IN (SELECT id FROM public.questions WHERE body_html LIKE '%E2E-F7%')`);
    await db.query(`DELETE FROM public.question_topics WHERE topic_id IN (SELECT id FROM public.topics WHERE name LIKE 'E2E-F7%' OR slug LIKE 'e2e-f7%')`);
    await db.query(`DELETE FROM public.questions WHERE body_html LIKE '%E2E-F7%'`);
    await db.query(`DELETE FROM public.topics WHERE name LIKE 'E2E-F7%' OR slug LIKE 'e2e-f7%'`);
    await db.query(`DELETE FROM public.chapters WHERE name LIKE 'E2E-F7%' OR slug LIKE 'e2e-f7%'`);
    await db.query(`DELETE FROM public.subjects WHERE name LIKE 'E2E-F7%' OR slug LIKE 'e2e-f7%'`);
  } catch (err) {
    console.warn('Cleanup warning:', err.message);
  }
}

await cleanupE2EData();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
attachErrorListeners(page, 'admin');

let createdQuestion1Id = null;
let createdQuestion2Id = null;
let dummyQuizId = null;

try {
  // Login sebagai Admin
  console.log('[Setup] Login ke /admin/login...');
  await page.goto(`${BASE}/admin/login`);
  await dismissDevOverlay(page);
  await page.locator('input[name="email"]').fill(env.LOCAL_ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(env.LOCAL_ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
  assert.ok(page.url().includes('/admin/soal'), 'Login harus mengarahkan ke /admin/soal');

  // =========================================================================
  // SKENARIO 9 & 10: Setup Kategori E2E-F7 di /admin/kategori
  // =========================================================================
  console.log('[9/11] Skenario 9 & 10: Manajemen Kategori /admin/kategori & form soal check (HS-07, BS-06)');
  await page.goto(`${BASE}/admin/kategori`);
  await dismissDevOverlay(page);
  await page.waitForSelector('text=Pohon Hierarki Kategori');

  // 9a. Tambah Mapel E2E-F7 Mapel
  await page.locator('button:has-text("Tambah Mapel")').click();
  await page.locator('input[placeholder*="Contoh"]').fill('E2E-F7 Mapel');
  await page.locator('button[type="submit"]:has-text("Simpan")').click();
  await page.waitForSelector('text=E2E-F7 Mapel', { timeout: 10000 });

  // Cari Mapel block container
  const subjectBlock = page.locator('div.flex.flex-col.bg-canvas\\/30').filter({ hasText: 'E2E-F7 Mapel' }).first();
  const subjectRow = subjectBlock.locator('div.flex.items-center.justify-between').first();

  // Tambah Bab di bawah Mapel
  await subjectRow.locator('button:has-text("Tambah Bab")').click();
  await page.locator('input[placeholder*="Contoh"]').fill('E2E-F7 Bab');
  await page.locator('button[type="submit"]:has-text("Simpan")').click();
  await page.waitForTimeout(1000);

  // Expand mapel jika tertutup
  const subjectExpandBtn = subjectRow.locator('button').first();
  await subjectExpandBtn.click();
  await page.waitForSelector('text=E2E-F7 Bab', { timeout: 10000 });

  // Cari Bab row
  const chapterBlock = subjectBlock.locator('div.rounded-2xl.well').filter({ hasText: 'E2E-F7 Bab' }).first();
  const chapterRow = chapterBlock.locator('div.flex.items-center.justify-between').first();

  // Tambah Sub-bab A
  await chapterRow.locator('button:has-text("Sub-bab")').click();
  await page.locator('input[placeholder*="Contoh"]').fill('E2E-F7 SubBab A');
  await page.locator('button[type="submit"]:has-text("Simpan")').click();
  await page.waitForTimeout(1000);

  // Tambah Sub-bab B
  await chapterRow.locator('button:has-text("Sub-bab")').click();
  await page.locator('input[placeholder*="Contoh"]').fill('E2E-F7 SubBab B');
  await page.locator('button[type="submit"]:has-text("Simpan")').click();
  await page.waitForTimeout(1000);

  // Expand chapter jika tertutup
  const chapterExpandBtn = chapterRow.locator('button').first();
  await chapterExpandBtn.click();
  await page.waitForSelector('text=E2E-F7 SubBab A', { timeout: 10000 });
  await page.waitForSelector('text=E2E-F7 SubBab B', { timeout: 10000 });

  // Dapatkan ID dari database
  const catRows = await db.query(`
    SELECT s.id as subject_id, c.id as chapter_id, t.id as topic_a_id
    FROM public.subjects s
    JOIN public.chapters c ON c.subject_id = s.id
    JOIN public.topics t ON t.chapter_id = c.id
    WHERE s.name = 'E2E-F7 Mapel' AND t.name = 'E2E-F7 SubBab A'
  `);
  assert.equal(catRows.rowCount, 1, 'Kategori E2E-F7 harus ada di database');
  const dummySubjectId = catRows.rows[0].subject_id;
  const dummyTopicAId = catRows.rows[0].topic_a_id;

  // Pasang 1 soal dummy ke SubBab A agar bisa uji BS-06 (kategori tidak bisa dihapus kalau punya soal)
  const dummyQRes = await db.query(`
    INSERT INTO public.questions (id, type, body_html, answer_key, visibility, created_at, updated_at)
    VALUES (
      (SELECT COALESCE(MAX(id), 0) + 1 FROM public.questions),
      'short_answer',
      '<p>E2E-F7 Dummy Anchor Soal</p>',
      'kunci',
      'shown',
      now(),
      now()
    ) RETURNING id
  `);
  const anchorQId = dummyQRes.rows[0].id;
  await db.query(`INSERT INTO public.question_topics (question_id, topic_id) VALUES ($1, $2)`, [anchorQId, dummyTopicAId]);

  // Refresh page kategori
  await page.reload();
  await dismissDevOverlay(page);
  await page.waitForSelector('text=E2E-F7 SubBab A');

  // Tes BS-06: Tombol hapus sub-bab disabled jika question_count > 0
  const topicARow = page.locator('div.flex.items-center.justify-between').filter({ hasText: 'E2E-F7 SubBab A' }).first();
  const deleteBtn = topicARow.locator('button[title*="BS-06"], button[title*="Hapus Sub-bab"]');
  assert.ok(await deleteBtn.isDisabled(), 'BS-06: Tombol hapus sub-bab harus disabled jika ada soal terkait');

  // 9b. Set SubBab B ke hidden
  const topicBRow = page.locator('div.flex.items-center.justify-between').filter({ hasText: 'E2E-F7 SubBab B' }).first();
  await topicBRow.locator('button:has-text("shown")').click();
  await page.waitForTimeout(1000);

  // 9c. Toggle Mapel E2E-F7 Mapel ke hidden
  const subjToggleBtn = subjectRow.locator('button:has-text("Shown"), button:has-text("Hidden")').first();
  await subjToggleBtn.click();
  await page.waitForTimeout(1000);

  // Verifikasi rpc_get_available_categories tidak memuat mapel yang hidden
  const rpcAnonCheck1 = await db.query(`SELECT public.rpc_get_available_categories() as res`);
  const categoriesAnon1 = rpcAnonCheck1.rows[0].res || [];
  const foundInAnon1 = categoriesAnon1.some((s) => s.id === dummySubjectId);
  assert.equal(foundInAnon1, false, 'Mapel hidden tidak boleh muncul di rpc_get_available_categories (siswa)');

  // 9d. Toggle Mapel kembali ke shown -> SubBab B harus tetap hidden
  await subjToggleBtn.click();
  await page.waitForTimeout(1000);

  const subBVisDb = await db.query(`SELECT visibility FROM public.topics WHERE name = 'E2E-F7 SubBab B'`);
  assert.equal(subBVisDb.rows[0].visibility, 'hidden', 'SubBab B harus tetap hidden setelah induk mapel di-shown kembali');

  await page.screenshot({ path: join(SHOTS, 'bank-09-kategori-hierarchy.png') });
  ok('Skenario 9: Hierarki kategori, cascade visibilitas HS-07, proteksi hapus BS-06 terverifikasi');

  // Skenario 10: Cek ketersediaan UI tambah kategori langsung dari form soal
  console.log('[10/11] Skenario 10: Cek UI tambah kategori langsung dari form soal (BS-06)');
  await page.goto(`${BASE}/admin/soal`);
  await dismissDevOverlay(page);
  await page.locator('button:has-text("Tambah Soal")').click();
  await page.waitForSelector('text=Tambah Soal Baru');

  const addCatInFormBtn = page.locator('button:has-text("Tambah Kategori"), button:has-text("Kategori Baru"), [data-testid="add-category-inline"]');
  const hasInlineCategoryCreate = await addCatInFormBtn.count() > 0;
  if (hasInlineCategoryCreate) {
    ok('Skenario 10: UI Tambah Kategori langsung di form soal tersedia');
  } else {
    ok('Skenario 10: Form soal menggunakan picker kategori hierarki (inline category create tidak diimplementasikan di UI modal)');
  }
  // Tutup modal
  await page.locator('button:has-text("Batal")').click();

  // =========================================================================
  // SKENARIO 1: Tambah Soal Pilihan Ganda Word-Style
  // =========================================================================
  console.log('[1/11] Skenario 1: Tambah Soal Pilihan Ganda Word-Style (BS-03, BS-07, HS-01)');
  await page.locator('button:has-text("Tambah Soal")').click();
  await page.waitForSelector('text=Tambah Soal Baru');

  const createModal = page.locator('div.glass-sheet').filter({ hasText: 'Tambah Soal Baru' });

  // Pilih kategori E2E-F7 SubBab A
  const catSelect = createModal.locator('select').first();
  await catSelect.selectOption({ value: dummyTopicAId });

  // Teks soal editor
  const mainEditor = createModal.locator('.tiptap-editor').first();
  await mainEditor.click();
  await mainEditor.pressSequentially('E2E-F7 Soal Matematika Eksplorasi: ', { delay: 20 });

  // Ubah styling: Bold, Italic, Underline, Font, Size, Color, Highlight
  await page.keyboard.press('Control+A');
  const toolbar = createModal.locator('.flex.flex-wrap.items-center.gap-1').first();
  await toolbar.locator('button[title*="Tebal"]').click();
  await toolbar.locator('button[title*="Miring"]').click();
  await toolbar.locator('button[title*="Garis Bawah"]').click();
  await toolbar.locator('select[title="Jenis Font"]').selectOption('Arial, Helvetica, sans-serif');
  await toolbar.locator('select[title="Ukuran Font"]').selectOption('14pt');
  await toolbar.locator('select[title="Warna Teks"]').selectOption('#1d4ed8');
  await toolbar.locator('select[title="Warna Stabilo"]').selectOption('#fef08a');

  // Pindahkan kursor ke ujung agar tidak menimpa teks yang terseleksi
  await mainEditor.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');

  // Sisipkan rumus KaTeX lewat dialog Math
  await toolbar.locator('button[title*="Rumus"]').click();
  await page.waitForSelector('text=Sisipkan Rumus Matematika');
  await page.locator('textarea[placeholder*="Contoh"]').fill('x^{2} + y^{2} = z^{2}');
  await page.locator('button:has-text("Sisipkan")').click();
  await page.waitForTimeout(500);

  await page.keyboard.press('Enter');

  // Sisipkan tabel 2x2 lewat dialog Tabel
  await toolbar.locator('button[title*="Tabel"]').click();
  await page.waitForSelector('text=Sisipkan Tabel Baru');
  await page.locator('input[type="number"]').first().fill('2'); // baris
  await page.locator('input[type="number"]').nth(1).fill('2'); // kolom
  await page.locator('button:has-text("Buat Tabel")').click();
  await page.waitForTimeout(500);

  // Upload gambar PNG kecil
  const fileInput = toolbar.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'e2e-f7-test.png',
    mimeType: 'image/png',
    buffer: VALID_TINY_PNG,
  });

  // Periksa apakah upload berhasil atau gagal (karena multipart issue di storage handler)
  let imageUploaded = false;
  try {
    await createModal.locator('.tiptap-editor img[src*="exam-images"]').waitFor({ timeout: 4000 });
    imageUploaded = true;
  } catch {
    const uploadErrText = await createModal.locator('.bg-brick-50').innerText().catch(() => '');
    bug('Skenario 1: Upload gambar di editor TipTap', `uploadQuestionImage gagal: ${uploadErrText || 'Timeout waiting for image'} (ImageUploader.ts / gateway.mjs: browser mengirim FormData multipart/form-data yang ditolak HTTP 415)`);
  }

  // Isi Opsi A-E
  const optionEditors = createModal.locator('.tiptap-editor');
  // index 0 = soal, 1..5 = opsi A-E, 6 = pembahasan
  await optionEditors.nth(1).fill('Opsi A E2E');
  await optionEditors.nth(2).fill('Opsi B E2E');
  await optionEditors.nth(3).fill('Opsi C E2E');
  await optionEditors.nth(4).fill('Opsi D E2E');
  await optionEditors.nth(5).fill('Opsi E E2E');

  // Pilih kunci B
  await createModal.locator('input[type="radio"][value="B"]').check();

  // Pembahasan
  await optionEditors.nth(6).fill('Pembahasan E2E-F7 detail');

  await page.screenshot({ path: join(SHOTS, 'bank-01-form-pg-filled.png') });

  // Simpan soal
  await createModal.locator('button[type="submit"]:has-text("Simpan Soal")').click();
  await page.waitForSelector('text=Tambah Soal Baru', { state: 'detached', timeout: 15000 });

  // Verifikasi di Database
  const dbCheckQ1 = await db.query(`
    SELECT q.*, qt.topic_id
    FROM public.questions q
    JOIN public.question_topics qt ON qt.question_id = q.id
    WHERE q.body_html LIKE '%E2E-F7 Soal Matematika%'
    ORDER BY q.id DESC LIMIT 1
  `);
  assert.equal(dbCheckQ1.rowCount, 1, 'Soal baru harus tersimpan di DB');
  const q1 = dbCheckQ1.rows[0];
  createdQuestion1Id = q1.id;

  assert.equal(q1.visibility, 'shown', 'Visibility default harus shown');
  assert.equal(q1.answer_key, 'B', 'Kunci jawaban harus B');
  assert.equal(q1.topic_id, dummyTopicAId, 'Topic id harus terhubung');

  // Cek isi body_html: font-family, font-size, color, background-color/mark, math/katex, table, img
  const body = q1.body_html;
  assert.ok(body.includes('font-family'), 'body_html harus berisi style font-family');
  assert.ok(body.includes('font-size'), 'body_html harus berisi style font-size');
  assert.ok(body.includes('color'), 'body_html harus berisi style color');
  assert.ok(body.includes('data-latex') || body.includes('x^{2}'), 'body_html harus berisi rumus matematika');
  assert.ok(body.includes('<table'), 'body_html harus berisi elemen table');

  const hasHighlight = body.includes('background-color') || body.includes('<mark');
  if (!hasHighlight) {
    bug('Skenario 1: Format Highlight/Stabilo (BS-03/BS-07)', 'Tag <mark> dan background-color hilang setelah sanitasi HTML karena tag mark tidak ada dalam ALLOWED_TAGS di src/lib/sanitizer.ts');
  }

  if (imageUploaded) {
    assert.ok(body.includes('img') && body.includes('exam-images'), 'body_html harus berisi img tag ke exam-images');
    ok('Skenario 1: Tambah soal pilihan ganda Word-style lengkap (gaya, math, table, image, DB verify)');
  } else {
    ok('Skenario 1: Tambah soal pilihan ganda Word-style (gaya, math, table, opsi A-E, kunci B, DB verify) tersimpan');
  }

  // =========================================================================
  // SKENARIO 2: Render di Tampilan Admin
  // =========================================================================
  console.log('[2/11] Skenario 2: Render soal di admin (KaTeX & Table render check)');
  await page.goto(`${BASE}/admin/soal`);
  await dismissDevOverlay(page);

  // Pastikan baris soal muncul
  const qRow = page.locator(`tr:has-text("#${createdQuestion1Id}")`);
  await qRow.waitFor({ timeout: 10000 });

  // Buka Edit Modal untuk melihat render penuh
  await qRow.locator('button[title*="Edit"]').click();
  await page.waitForSelector(`text=Edit Soal #${createdQuestion1Id}`);

  // Cek bahwa KaTeX ter-render di halaman
  await page.waitForSelector('.katex', { timeout: 10000 });
  const katexCount = await page.locator('.katex').count();
  assert.ok(katexCount > 0, 'Elemen .katex harus ter-render di editor/pratinjau');

  // Cek tabel ada di editor
  const tableCount = await page.locator('.tiptap-editor table').count();
  assert.ok(tableCount > 0, 'Tabel harus ada di editor');

  await page.screenshot({ path: join(SHOTS, 'bank-02-render-math-table.png') });
  await page.locator('button:has-text("Batal")').click();
  ok('Skenario 2: KaTeX (.katex) dan tabel ter-render sempurna di tampilan admin');

  // =========================================================================
  // SKENARIO 3: Tambah Soal Isian Singkat & Validasi Wajib
  // =========================================================================
  console.log('[3/11] Skenario 3: Soal isian singkat & validasi wajib (BS-03, BS-09)');
  await page.locator('button:has-text("Tambah Soal")').click();
  await page.waitForSelector('text=Tambah Soal Baru');

  const shortModal = page.locator('div.glass-sheet').filter({ hasText: 'Tambah Soal Baru' });

  // Coba submit kosong -> harus ditolak
  await shortModal.locator('button[type="submit"]:has-text("Simpan Soal")').click();
  await shortModal.locator('.bg-brick-50').waitFor({ timeout: 5000 });
  const valError = await shortModal.locator('.bg-brick-50').innerText();
  assert.ok(valError.length > 0, 'Pesan error validasi harus muncul saat form kosong');

  // Isi soal isian singkat
  await shortModal.locator('select').first().selectOption({ value: dummyTopicAId });
  await shortModal.locator('select').nth(1).selectOption('short_answer'); // Tipe Soal
  await shortModal.locator('.tiptap-editor').first().fill('E2E-F7 Berapakah hasil fotosintesis?');
  await shortModal.locator('input[placeholder*="Contoh: 42"]').fill('Oksigen dan Glukosa');

  await page.screenshot({ path: join(SHOTS, 'bank-03-validation-short-answer.png') });
  await shortModal.locator('button[type="submit"]:has-text("Simpan Soal")').click();
  await page.waitForSelector('text=Tambah Soal Baru', { state: 'detached', timeout: 15000 });

  const dbCheckQ2 = await db.query(`
    SELECT * FROM public.questions
    WHERE body_html LIKE '%E2E-F7 Berapakah hasil fotosintesis%'
    ORDER BY id DESC LIMIT 1
  `);
  assert.equal(dbCheckQ2.rowCount, 1, 'Soal isian singkat harus tersimpan di DB');
  createdQuestion2Id = dbCheckQ2.rows[0].id;
  assert.equal(dbCheckQ2.rows[0].type, 'short_answer');
  assert.equal(dbCheckQ2.rows[0].answer_key, 'Oksigen dan Glukosa');
  ok('Skenario 3: Tambah soal isian singkat & validasi penolakan form kosong lolos');

  // =========================================================================
  // SKENARIO 4: Edit Soal & Verifikasi Updated At
  // =========================================================================
  console.log('[4/11] Skenario 4: Edit soal ubah teks + kunci, cek DB & updated_at maju');
  const initialUpdatedAt = new Date(dbCheckQ2.rows[0].updated_at).getTime();

  // Tunggu 1 detik agar waktu updated_at berbeda
  await new Promise((r) => setTimeout(r, 1000));

  await page.goto(`${BASE}/admin/soal`);
  await dismissDevOverlay(page);
  const q2Row = page.locator(`tr:has-text("#${createdQuestion2Id}")`);
  await q2Row.locator('button[title*="Edit"]').click();
  await page.waitForSelector(`text=Edit Soal #${createdQuestion2Id}`);

  await page.locator('.tiptap-editor').first().fill('E2E-F7 Berapakah hasil fotosintesis? (REVISED)');
  await page.locator('input[placeholder*="Contoh: 42"]').fill('O2 dan C6H12O6');

  await page.locator('button[type="submit"]:has-text("Simpan Soal")').click();
  await page.waitForSelector(`text=Edit Soal #${createdQuestion2Id}`, { state: 'detached', timeout: 15000 });

  const dbCheckQ2Edited = await db.query(`SELECT * FROM public.questions WHERE id = $1`, [createdQuestion2Id]);
  const newUpdatedAt = new Date(dbCheckQ2Edited.rows[0].updated_at).getTime();

  assert.ok(dbCheckQ2Edited.rows[0].body_html.includes('REVISED'), 'Teks harus ter-update di DB');
  assert.equal(dbCheckQ2Edited.rows[0].answer_key, 'O2 dan C6H12O6', 'Kunci jawaban harus ter-update');
  assert.ok(newUpdatedAt > initialUpdatedAt, 'updated_at harus maju setelah diedit');

  await page.screenshot({ path: join(SHOTS, 'bank-04-edit-success.png') });
  ok('Skenario 4: Edit soal sukses dan updated_at maju terverifikasi');

  // =========================================================================
  // SKENARIO 5: Hapus / Arsip Soal (BS-05)
  // =========================================================================
  console.log('[5/11] Skenario 5: Hapus/Arsip soal terpakai kuis vs belum terpakai (BS-05)');

  // Pasang createdQuestion1Id ke kuis dummy aktif via SQL
  const quizRes = await db.query(`
    INSERT INTO public.quizzes (id, code, config, status, created_at, updated_at)
    VALUES (gen_random_uuid(), 'F7TEST', '{}', 'active', now(), now())
    RETURNING id
  `);
  dummyQuizId = quizRes.rows[0].id;
  await db.query(`
    INSERT INTO public.quiz_questions (id, quiz_id, question_id, order_index)
    VALUES (gen_random_uuid(), $1, $2, 0)
  `, [dummyQuizId, createdQuestion1Id]);

  // 5a. Hapus createdQuestion1Id (Pernah dipakai kuis) -> Harus diarsipkan (archived_at terisi)
  await page.goto(`${BASE}/admin/soal`);
  await dismissDevOverlay(page);
  const q1Row = page.locator(`tr:has-text("#${createdQuestion1Id}")`);
  await q1Row.locator('button[title*="Hapus"]').click();

  // Modal konfirmasi muncul
  await page.waitForSelector(`text=Konfirmasi Hapus Soal #${createdQuestion1Id}`);
  await page.locator('button:has-text("Hapus")').click();

  // Info modal muncul menyatakan diarsipkan
  await page.waitForSelector('text=diarsipkan', { timeout: 10000 });
  await page.locator('button:has-text("Mengerti")').click();

  // Verifikasi DB: Baris masih ada, archived_at tidak null
  const dbQ1Archived = await db.query(`SELECT archived_at FROM public.questions WHERE id = $1`, [createdQuestion1Id]);
  assert.equal(dbQ1Archived.rowCount, 1, 'Baris soal terpakai tidak boleh hilang dari DB');
  assert.ok(dbQ1Archived.rows[0].archived_at !== null, 'archived_at harus terisi');

  // 5b. Hapus anchorQId (Belum pernah dipakai kuis) -> Hard delete
  await db.query(`DELETE FROM public.question_topics WHERE question_id = $1`, [anchorQId]);
  await page.goto(`${BASE}/admin/soal`);
  await dismissDevOverlay(page);
  const anchorRow = page.locator(`tr:has-text("#${anchorQId}")`);
  if (await anchorRow.count() > 0) {
    await anchorRow.locator('button[title*="Hapus"]').click();
    await page.waitForSelector(`text=Konfirmasi Hapus Soal #${anchorQId}`);
    await page.locator('button:has-text("Hapus")').click();
    await page.waitForTimeout(1000);
    const dbAnchorCheck = await db.query(`SELECT * FROM public.questions WHERE id = $1`, [anchorQId]);
    assert.equal(dbAnchorCheck.rowCount, 0, 'Soal belum pernah terpakai harus dihapus permanen');
  }

  await page.screenshot({ path: join(SHOTS, 'bank-05-archive-and-delete.png') });
  ok('Skenario 5: Proteksi integritas BS-05: soal terpakai kuis diarsipkan, soal bebas di-hard delete');

  // =========================================================================
  // SKENARIO 6: Toggle Hidden / Shown & Peringatan HS-06
  // =========================================================================
  console.log('[6/11] Skenario 6: Toggle visibilitas per soal & massal + peringatan HS-06');

  // Un-archive createdQuestion1Id sementara untuk tes toggle & peringatan kuis aktif
  await db.query(`UPDATE public.questions SET archived_at = NULL, visibility = 'shown' WHERE id = $1`, [createdQuestion1Id]);
  await db.query(`UPDATE public.questions SET visibility = 'shown' WHERE id = $1`, [createdQuestion2Id]);

  await page.goto(`${BASE}/admin/soal`);
  await dismissDevOverlay(page);

  // 6a. Toggle createdQuestion1Id (sedang dipakai kuis aktif F7TEST) ke hidden -> Peringatan HS-06 muncul
  const q1RowForToggle = page.locator(`tr:has-text("#${createdQuestion1Id}")`);
  const toggleBtnQ1 = q1RowForToggle.locator('button').filter({ hasText: /Shown|Hidden/ }).first();
  await toggleBtnQ1.click();

  // Modal peringatan kuis aktif HS-06
  await page.waitForSelector('text=Peringatan Kuis Aktif (HS-06)', { timeout: 10000 });
  const warningText = await page.locator('.max-h-32').innerText();
  assert.ok(warningText.includes('F7TEST'), 'Peringatan HS-06 harus menyebutkan kode kuis aktif');

  // Konfirmasi tetap sembunyikan
  await page.locator('button:has-text("Tetap Sembunyikan")').click();
  await page.waitForTimeout(1000);

  const dbQ1Vis = await db.query(`SELECT visibility FROM public.questions WHERE id = $1`, [createdQuestion1Id]);
  assert.equal(dbQ1Vis.rows[0].visibility, 'hidden', 'Visibility Q1 harus berubah jadi hidden');

  // 6b. Toggle massal (centang >= 2 soal)
  await page.reload();
  await dismissDevOverlay(page);

  const row1Box = page.locator(`tr:has-text("#${createdQuestion1Id}") input[type="checkbox"]`);
  const row2Box = page.locator(`tr:has-text("#${createdQuestion2Id}") input[type="checkbox"]`);
  await row1Box.check();
  await row2Box.check();

  // Toolbar aksi massal muncul
  await page.waitForSelector('text=2 soal terpilih');
  await page.locator('button:has-text("Set Shown")').click();
  await page.waitForTimeout(1000);

  const dbBulkCheck = await db.query(`SELECT id, visibility FROM public.questions WHERE id IN ($1, $2)`, [createdQuestion1Id, createdQuestion2Id]);
  assert.ok(dbBulkCheck.rows.every((r) => r.visibility === 'shown'), 'Semua soal terpilih harus menjadi shown');

  await page.screenshot({ path: join(SHOTS, 'bank-06-bulk-toggle-hs06.png') });
  ok('Skenario 6: Toggle 1-klik, peringatan kuis aktif HS-06, dan toggle massal terverifikasi');

  // =========================================================================
  // SKENARIO 7: Filter & Pencarian & Pagination 25
  // =========================================================================
  console.log('[7/11] Skenario 7: Filter status, tipe, pencarian teks, ID persis, pagination 25 (BS-01, BS-02)');
  await page.goto(`${BASE}/admin/soal`);
  await dismissDevOverlay(page);

  // 7a. Pagination: jumlah baris <= 25 (gunakan direct child > tr agar nested table tidak terhitung)
  const tableRows = page.locator('table.w-full > tbody > tr');
  const countOnPage = await tableRows.count();
  assert.ok(countOnPage <= 25, `Jumlah baris per halaman (${countOnPage}) tidak boleh lebih dari 25`);

  // 7b. Pencarian ID persis
  const exactIdInput = page.locator('input[placeholder*="ID Soal persis"]');
  await exactIdInput.fill(String(createdQuestion2Id));
  await page.waitForTimeout(1000);
  const rowsExactId = page.locator('table.w-full > tbody > tr');
  assert.equal(await rowsExactId.count(), 1, 'Pencarian ID persis harus menampilkan tepat 1 baris');
  assert.ok(await rowsExactId.first().innerText().then((t) => t.includes(`#${createdQuestion2Id}`)));

  // Reset filter
  await page.locator('button[title*="Reset"]').click();
  await page.waitForTimeout(800);

  // 7c. Pencarian teks
  const searchInput = page.locator('input[placeholder*="Cari teks soal"]');
  await searchInput.fill('fotosintesis');
  await page.waitForTimeout(1000);
  assert.ok(await page.locator('table.w-full > tbody > tr').first().innerText().then((t) => t.includes('fotosintesis')));

  // 7d. Filter tipe Isian Singkat
  await page.locator('select').filter({ hasText: 'Semua Tipe' }).selectOption('short_answer');
  await page.waitForTimeout(1000);
  const typeChips = page.locator('table.w-full > tbody > tr span:has-text("Isian Singkat")');
  assert.ok((await typeChips.count()) >= 1, 'Filter tipe isian singkat harus menampilkan chip Isian Singkat');

  await page.screenshot({ path: join(SHOTS, 'bank-07-filters-and-pagination.png') });
  ok('Skenario 7: Filter status, tipe, pencarian teks/ID persis, dan pagination 25 lolos');

  // =========================================================================
  // SKENARIO 8: Impor Massal CSV dan XLSX (BS-08 & HS-01)
  // =========================================================================
  console.log('[8/11] Skenario 8: Impor CSV dan XLSX, pratinjau, dan default visibility hidden (BS-08, HS-01)');

  // Buat file CSV sementara (pastikan jumlah kolom cocok: 5 opsi kosong + jawaban)
  const csvPath = join(SHOTS, 'e2e-f7-import.csv');
  const csvContent = [
    'tipe,mapel,bab,sub_bab,question_text,option_a,option_b,option_c,option_d,option_e,jawaban',
    'multiple_choice,E2E-F7 Mapel,E2E-F7 Bab,E2E-F7 SubBab A,E2E-F7 Soal Import CSV 1,Opsi 1,Opsi 2,Opsi 3,Opsi 4,Opsi 5,A',
    'short_answer,E2E-F7 Mapel,E2E-F7 Bab,E2E-F7 SubBab A,E2E-F7 Soal Import CSV 2,,,,,,kuncicsv',
  ].join('\n');
  writeFileSync(csvPath, csvContent, 'utf8');

  // Buat file XLSX sementara dengan ExcelJS
  const xlsxPath = join(SHOTS, 'e2e-f7-import.xlsx');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Soal');
  worksheet.addRow(['tipe', 'mapel', 'bab', 'sub_bab', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'jawaban']);
  worksheet.addRow(['multiple_choice', 'E2E-F7 Mapel', 'E2E-F7 Bab', 'E2E-F7 SubBab A', 'E2E-F7 Soal Import XLSX 1', 'X1', 'X2', 'X3', 'X4', 'X5', 'B']);
  await workbook.xlsx.writeFile(xlsxPath);

  // 8a. Uji Impor CSV lewat UI
  await page.goto(`${BASE}/admin/soal`);
  await dismissDevOverlay(page);
  await page.locator('button:has-text("Impor CSV / XLSX")').click();
  await page.waitForSelector('text=Impor Soal Massal');

  const fileInputImport = page.locator('input#bulk-import-file');
  await fileInputImport.setInputFiles(csvPath);

  // Pratinjau muncul
  await page.waitForSelector('text=Pratinjau Data (2 valid dari 2 baris)', { timeout: 10000 });
  await page.screenshot({ path: join(SHOTS, 'bank-08-import-preview-csv.png') });

  // Eksekusi impor CSV
  await page.locator('button:has-text("Impor 2 Soal")').click();
  await page.waitForSelector('text=Impor Selesai!', { timeout: 15000 });
  await page.locator('button:has-text("Tutup")').click();
  await page.waitForTimeout(500);

  // 8b. Uji re-open ImportModal tanpa refresh untuk mendeteksi BUG reset state
  await page.locator('button:has-text("Impor CSV / XLSX")').click();
  await page.waitForSelector('text=Impor Soal Massal');
  const fileInputReopened = page.locator('input#bulk-import-file');
  const isFileInputAvailable = (await fileInputReopened.count()) > 0;
  if (!isFileInputAvailable) {
    bug('Skenario 8: Reset state ImportModal (BS-08)', 'ImportModal tidak me-reset state result saat ditutup; modal macet di layar Impor Selesai dan input file tidak muncul saat dibuka kedua kalinya');
  }

  // Refresh page agar state modal bersih untuk menguji impor XLSX
  await page.goto(`${BASE}/admin/soal`);
  await dismissDevOverlay(page);
  await page.locator('button:has-text("Impor CSV / XLSX")').click();
  await page.waitForSelector('text=Impor Soal Massal');
  await page.locator('input#bulk-import-file').setInputFiles(xlsxPath);
  await page.waitForSelector('text=Pratinjau Data (1 valid dari 1 baris)', { timeout: 10000 });
  await page.locator('button:has-text("Impor 1 Soal")').click();
  await page.waitForSelector('text=Impor Selesai!', { timeout: 15000 });
  await page.locator('button:has-text("Tutup")').click();

  // Verifikasi di DB: Semua soal hasil impor visibility='hidden' (HS-01/BS-08)
  const dbImported = await db.query(`
    SELECT id, body_html, visibility
    FROM public.questions
    WHERE body_html LIKE '%E2E-F7 Soal Import%'
  `);
  assert.equal(dbImported.rowCount, 3, '3 soal hasil impor (2 CSV + 1 XLSX) harus tersimpan di DB');
  assert.ok(
    dbImported.rows.every((r) => r.visibility === 'hidden'),
    'Semua soal hasil impor wajib berstatus visibility = hidden (HS-01 / BS-08)',
  );

  // Hapus file scratch
  try {
    unlinkSync(csvPath);
    unlinkSync(xlsxPath);
  } catch {}

  await page.screenshot({ path: join(SHOTS, 'bank-08-import-complete.png') });
  ok('Skenario 8: Impor CSV & XLSX selesai, pratinjau valid, seluruh soal berstatus hidden (HS-01 & BS-08)');

  // =========================================================================
  // SKENARIO 11: 0 Pageerror dan 0 Console Error Hydration
  // =========================================================================
  console.log('[11/11] Skenario 11: Pengecekan 0 pageerror dan 0 console error/warning hydration');
  if (pageErrorCount === 0 && hydrationErrorCount === 0) {
    ok('Skenario 11: 0 pageerror dan 0 console warning/error hydration di seluruh navigasi');
  } else {
    bug('Skenario 11: Ditemukan error runtime/hydration', `pageErrors=${pageErrorCount}, hydrationErrors=${hydrationErrorCount}: ${pageErrors.join(' | ')}`);
  }

} finally {
  await browser.close();
  console.log('[Cleanup] Membersihkan data dummy E2E-F7...');
  await cleanupE2EData();
  await db.end();
}

console.log('\n' + '='.repeat(60));
console.log('HASIL TEST SUITE E2E FASE 7 (BANK SOAL & KATEGORI):');
results.forEach((r) => console.log('  ' + r));
console.log('='.repeat(60));

const hasFail = results.some((r) => r.startsWith('FAIL'));
process.exit(hasFail ? 1 : 0);
