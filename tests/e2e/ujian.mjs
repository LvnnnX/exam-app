// E2E Ujian Mandiri (Exam & Survival) against LOCAL stack only (Postgres 127.0.0.1:54329 + `next dev`).
// Usage: node tests/e2e/ujian.mjs [baseUrl] (default http://localhost:3100)
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

const DUMMY_TOPIC_ID = 'e2e00000-0000-0000-0000-000000000001';

async function setupDummyTopic() {
  const chRes = await db.query("SELECT id FROM public.chapters WHERE name = 'Matematika' LIMIT 1");
  const chapId = chRes.rows[0].id;

  const qRes = await db.query(
    "SELECT id FROM public.questions WHERE visibility = 'shown' AND archived_at IS NULL LIMIT 3",
  );
  const qIds = qRes.rows.map((r) => r.id);

  // Bersihkan dulu kalau ada sisa sebelumnya
  await db.query('DELETE FROM public.question_topics WHERE topic_id = $1', [DUMMY_TOPIC_ID]);
  await db.query('DELETE FROM public.topics WHERE id = $1', [DUMMY_TOPIC_ID]);

  await db.query(
    `INSERT INTO public.topics (id, chapter_id, name, slug, visibility)
     VALUES ($1, $2, 'E2E Dummy Kurang', 'e2e-dummy-kurang', 'shown')`,
    [DUMMY_TOPIC_ID, chapId],
  );

  for (const qid of qIds) {
    await db.query(
      'INSERT INTO public.question_topics (question_id, topic_id) VALUES ($1, $2)',
      [qid, DUMMY_TOPIC_ID],
    );
  }
}

async function cleanupData() {
  await db.query('DELETE FROM public.question_topics WHERE topic_id = $1', [DUMMY_TOPIC_ID]).catch(() => {});
  await db.query('DELETE FROM public.topics WHERE id = $1', [DUMMY_TOPIC_ID]).catch(() => {});
  // Hapus semua exam_sessions buatan tes E2E
  await db.query("DELETE FROM public.exam_sessions WHERE name LIKE 'E2E %'").catch(() => {});
}

// Helper ukur rasio kontras WCAG di browser DOM
async function checkContrast(page, selector, minRatio = 4.5) {
  return await page.evaluate(
    ({ sel, min }) => {
      const el = document.querySelector(sel);
      if (!el) return { found: false, ratio: 0, text: '' };
      const s = window.getComputedStyle(el);
      const parseRgb = (c) => {
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
      };
      const lum = ([r, g, b]) => {
        const a = [r, g, b].map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      };
      const fg = parseRgb(s.color);
      // Fallback bg ke white jika transparent
      let bg = parseRgb(s.backgroundColor);
      if (s.backgroundColor.includes('rgba') && s.backgroundColor.includes(', 0)')) {
        bg = [255, 255, 255];
      }
      const l1 = Math.max(lum(fg), lum(bg));
      const l2 = Math.min(lum(fg), lum(bg));
      const ratio = Number(((l1 + 0.05) / (l2 + 0.05)).toFixed(2));
      return { found: true, ratio, text: el.textContent?.trim().slice(0, 30) || '', pass: ratio >= min };
    },
    { sel: selector, min: minRatio },
  );
}

await db.connect();
await cleanupData();
await setupDummyTopic();

const browser = await chromium.launch();

try {
  // Mobile Context untuk alur siswa (360x780)
  const mobileCtx = await browser.newContext({
    viewport: { width: 360, height: 780 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  });
  await mobileCtx.addInitScript(() => {
    setInterval(() => {
      document.querySelector('script[data-nextjs-dev-overlay]')?.remove();
      document.querySelectorAll('nextjs-portal').forEach((el) => el.remove());
    }, 150);
  });
  const page = await mobileCtx.newPage();

  // Monitor Network Security & Page Errors (Skenario 9 & 10)
  const pageErrors = [];
  const networkLeaks = [];
  let studentSessionActive = false;

  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.startsWith(BASE)) return;
    if (!studentSessionActive) return;
    try {
      const text = await res.text();
      if (
        text.includes('"answer_key"') ||
        text.includes('"explanation_html"') ||
        text.includes('"secret_hash"')
      ) {
        networkLeaks.push({ url, bodySnippet: text.slice(0, 100) });
      }
    } catch {
      // response might be binary or stream
    }
  });

  // =========================================================================
  // SKENARIO 1: Setup sub-bab sedikit vs banyak & kategori < 5 soal
  // =========================================================================
  await page.goto(`${BASE}/ujian`);
  await page.waitForLoadState('networkidle');

  // Input nama
  const nameInput = page.locator('[data-testid="ujian-name"]');
  await nameInput.waitFor();
  await nameInput.fill('E2E Setup');

  // Pilih Mapel INFORMATIKA
  await page.getByLabel('INFORMATIKA').check();
  // Pilih Bab Matematika
  await page.getByLabel('Matematika').check();

  // 1a. Pilih sub-bab dengan 17 soal ('graf')
  await page.locator('label', { hasText: 'graf' }).click();
  // Tunggu perhitungan soal
  await page.locator('text=17 soal tersedia di sub-bab terpilih.').waitFor({ timeout: 10000 });

  // Assert preset > 17 disabled dengan teks "soal kurang"
  const p5 = page.locator('[data-testid="ujian-preset-5"]');
  const p10 = page.locator('[data-testid="ujian-preset-10"]');
  const p20 = page.locator('[data-testid="ujian-preset-20"]');
  const p100 = page.locator('[data-testid="ujian-preset-100"]');

  assert.equal(await p5.isDisabled(), false, 'preset 5 must be enabled');
  assert.equal(await p10.isDisabled(), false, 'preset 10 must be enabled');
  assert.equal(await p20.isDisabled(), true, 'preset 20 must be disabled');
  assert.equal(await p100.isDisabled(), true, 'preset 100 must be disabled');

  const p20Text = await p20.innerText();
  assert.ok(p20Text.includes('soal kurang'), 'preset 20 must display "soal kurang"');

  await page.screenshot({ path: join(SHOTS, 'ujian-setup.png') });
  ok('Skenario 1a: Setup preset sedikit vs banyak (preset > tersedia disabled "soal kurang")');

  // 1b. Ganti ke sub-bab dummy (< 5 soal, yaitu 3 soal)
  await page.locator('label', { hasText: 'graf' }).click();
  await page.locator('label', { hasText: 'E2E Dummy Kurang' }).click();
  await page.locator('text=3 soal tersedia di sub-bab terpilih.').waitFor({ timeout: 10000 });

  // Pesan minimal 5 soal muncul
  const warningMsg = page.locator('p[role="alert"]');
  await warningMsg.waitFor({ timeout: 10000 });
  const warningText = await warningMsg.innerText();
  assert.ok(
    warningText.includes('Soal di kategori ini baru 3. Minimal 5 untuk mode Exam.'),
    `warning text: ${warningText}`,
  );

  // Tombol mulai disabled
  const startBtn = page.locator('[data-testid="ujian-start"]');
  assert.equal(await startBtn.isDisabled(), true, 'start button must be disabled for < 5 questions');

  await page.screenshot({ path: join(SHOTS, 'ujian-setup-kurang.png') });
  ok('Skenario 1b: Kategori < 5 soal menampilkan pesan dan tombol mulai disabled');

  // =========================================================================
  // SKENARIO 2: Exam standard penuh (preset 5)
  // =========================================================================
  // Reset pilihan ke sub-bab dengan banyak soal ('Kombinatorika')
  await page.locator('label', { hasText: 'E2E Dummy Kurang' }).click();
  await page.locator('label', { hasText: 'Kombinatorika' }).click();
  await page.locator('text=soal tersedia di sub-bab terpilih.').waitFor({ timeout: 10000 });

  await nameInput.fill('E2E Standard');
  await page.locator('[data-testid="ujian-preset-5"]').click();

  // Keyboard Tab traversal check (A11y saat form valid & startBtn aktif)
  await nameInput.focus();
  let reachedStart = false;
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press('Tab');
    const isStartFocused = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="ujian-start"]');
      return document.activeElement === btn;
    });
    if (isStartFocused) {
      reachedStart = true;
      break;
    }
  }
  assert.ok(reachedStart, 'Keyboard Tab must navigate to start button');
  ok('A11y: Keyboard Tab traversal sampai tombol submit');

  // Lanjut ke konfirmasi
  assert.equal(await startBtn.isDisabled(), false);
  await startBtn.click();

  // Konfirmasi identitas (UM-06)
  await page.locator('text=Periksa kembali data ujian').waitFor();
  assert.ok(await page.locator('dd', { hasText: 'E2E Standard' }).isVisible());
  assert.ok(await page.locator('dd', { hasText: 'Exam' }).isVisible());
  assert.ok(await page.locator('dd', { hasText: '5 soal' }).isVisible());
  await page.screenshot({ path: join(SHOTS, 'ujian-confirm.png') });
  ok('Skenario 2a: Konfirmasi identitas UM-06 tampil lengkap');

  // Aktifkan pemantauan network leak selama ujian aktif
  studentSessionActive = true;

  // Klik Mulai ujian
  await page.locator('[data-testid="ujian-confirm-start"]').click();

  // Verifikasi timer tampil (UM-15)
  const timer = page.locator('[data-testid="ujian-timer"]');
  await timer.waitFor({ timeout: 10000 });
  assert.ok(await timer.isVisible(), 'timer must be visible');

  // Ambil session id dari DB untuk sesi E2E Standard
  const sessRes = await db.query(
    "SELECT id, question_order FROM public.exam_sessions WHERE name = 'E2E Standard' ORDER BY created_at DESC LIMIT 1",
  );
  assert.ok(sessRes.rows.length > 0, 'session must exist in DB');
  const sessId = sessRes.rows[0].id;
  const qOrder = sessRes.rows[0].question_order;
  assert.equal(qOrder.length, 5);

  // Ambil keys dari DB untuk ke-5 soal
  const qKeys = [];
  for (const qid of qOrder) {
    const qRow = await db.query('SELECT id, type, answer_key FROM public.questions WHERE id = $1', [qid]);
    qKeys.push(qRow.rows[0]);
  }

  // Rencana pengerjaan (target: 3 benar, 1 salah, 1 kosong -> skor 3/5, 60%):
  // Soal 1 (index 0): Benar
  // Soal 2 (index 1): Benar
  // Soal 3 (index 2): Salah
  // Soal 4 (index 3): Benar + Ragu-ragu + Buka Daftar Soal + Back ke Soal 3 lalu maju lagi
  // Soal 5 (index 4): Kosong -> klik Selesai

  // Helper jawab soal di UI
  async function selectOption(correct, expectedKey) {
    // Tunggu opsi pilihan ganda atau short input
    // Wait for the question to render; a one-shot isVisible() races the JIT question load.
    await page.locator('[data-testid="ujian-short-input"], [data-testid^="ujian-option-"]').first().waitFor();
    const isShort = await page.locator('[data-testid="ujian-short-input"]').isVisible().catch(() => false);
    if (isShort) {
      const val = correct ? expectedKey : 'SALAH_E2E';
      await page.locator('[data-testid="ujian-short-input"]').fill(val);
    } else {
      const chosenLabel = correct ? expectedKey : (expectedKey === 'A' ? 'B' : 'A');
      await page.locator(`[data-testid="ujian-option-${chosenLabel}"]`).click();
    }
  }

  // Soal 1: Benar
  await selectOption(true, qKeys[0].answer_key);
  await page.locator('[data-testid="ujian-next"]').click();

  // Soal 2: Benar
  await page.locator('text=Soal 2/5').waitFor();
  await selectOption(true, qKeys[1].answer_key);
  await page.locator('[data-testid="ujian-next"]').click();

  // Soal 3: Salah
  await page.locator('text=Soal 3/5').waitFor();
  await selectOption(false, qKeys[2].answer_key);
  await page.locator('[data-testid="ujian-next"]').click();

  // Soal 4: Benar + Tandai Ragu-ragu
  await page.locator('text=Soal 4/5').waitFor();
  await selectOption(true, qKeys[3].answer_key);
  const doubtBtn = page.locator('[data-testid="ujian-doubt"]');
  await doubtBtn.click();
  assert.equal(await doubtBtn.getAttribute('aria-pressed'), 'true', 'doubt must be pressed');
  // Menandai ragu memicu autosave langsung -> verifikasi status "Tersimpan" (UM-12)
  await page.locator('[data-testid="ujian-save-status"]:has-text("Tersimpan")').waitFor({ timeout: 5000 });
  ok('Skenario 2a-2: Status "Tersimpan" muncul saat jawaban/ragu disimpan');

  // Buka Daftar Soal (UM-14)
  await page.getByRole('button', { name: 'Daftar soal' }).click();
  await page.locator('text=Daftar nomor soal').waitFor();
  await page.screenshot({ path: join(SHOTS, 'ujian-daftar-soal.png') });
  ok('Skenario 2b: Modal daftar soal terbuka dan menampilkan indikator ragu-ragu');

  // Tutup modal daftar soal
  await page.getByRole('button', { name: 'Tutup' }).first().click();
  await page.locator('text=Daftar nomor soal').waitFor({ state: 'detached' });
  await dismissDevOverlay(page);

  // Uji tombol Back ("Sebelumnya") berfungsi
  const backBtn = page.locator('[data-testid="ujian-back"]');
  await backBtn.click();
  await page.locator('text=Soal 3/5').waitFor();
  ok('Skenario 2c: Tombol Sebelumnya (Back) berfungsi');

  // Maju kembali ke Soal 4, lalu ke Soal 5
  await dismissDevOverlay(page);
  await page.locator('[data-testid="ujian-next"]').click();
  await page.locator('text=Soal 4/5').waitFor();
  await dismissDevOverlay(page);
  await page.locator('[data-testid="ujian-next"]').click();

  // Soal 5: Biarkan kosong, klik Selesai
  await page.locator('text=Soal 5/5').waitFor();
  await dismissDevOverlay(page);
  const finishBtn = page.locator('[data-testid="ujian-finish"]');
  await finishBtn.click();

  // Modal konfirmasi selesai muncul & menyebutkan 1 kosong + 1 ragu (UM-14)
  const confirmModal = page.locator('text=Kumpulkan jawaban?');
  await confirmModal.waitFor();
  const warnSummary = page.locator('text=1 soal belum dijawab, 1 soal ditandai ragu-ragu.');
  await warnSummary.waitFor();
  assert.ok(await warnSummary.isVisible(), 'modal konfirmasi harus menyebut 1 kosong dan 1 ragu');
  ok('Skenario 2d: Modal konfirmasi selesai menyebut 1 kosong dan 1 ragu');

  // Kumpulkan jawaban
  await dismissDevOverlay(page);
  await page.getByRole('button', { name: 'Ya, kumpulkan' }).click();

  // Sesi selesai -> matikan flag network monitoring leak
  studentSessionActive = false;

  // Halaman hasil muncul (UM-30)
  const resultView = page.locator('[data-testid="ujian-result"]');
  await resultView.waitFor({ timeout: 10000 });
  assert.ok(await page.locator('text=60%').isVisible(), 'persen 60% harus tampil');
  assert.ok(await page.locator('text=3/5').isVisible(), 'skor 3/5 harus tampil');
  assert.ok(await page.locator('text=Belum lulus (< 70%)').isVisible(), 'status belum lulus');
  await page.screenshot({ path: join(SHOTS, 'ujian-exam-hasil.png') });
  ok('Skenario 2e: Hasil ujian exam standard tampil akurat (skor 3/5, 60%, belum lulus)');

  // Buka Pembahasan (Recap)
  await page.getByRole('button', { name: 'Lihat pembahasan' }).click();
  await page.locator('[data-testid="ujian-recap-item"]').first().waitFor();
  const recapItems = page.locator('[data-testid="ujian-recap-item"]');
  assert.equal(await recapItems.count(), 5, 'recap must contain 5 items');

  // Assert item ke-4 memuat badge "Ragu-ragu"
  const item4 = recapItems.nth(3);
  assert.ok(await item4.locator('text=Ragu-ragu').isVisible(), 'item 4 must show Ragu-ragu badge');

  // Assert item ke-5 memuat status "Kosong"
  const item5 = recapItems.nth(4);
  assert.ok(await item5.getByText('Kosong', { exact: true }).isVisible(), 'item 5 must show Kosong status');

  // Assert kunci jawaban tampil di recap
  assert.ok(await page.locator('text=Kunci').first().isVisible(), 'kunci jawaban harus tampil di recap');
  await page.screenshot({ path: join(SHOTS, 'ujian-exam-recap.png') });
  ok('Skenario 2f: Rekap pembahasan menampilkan jawaban siswa, kunci, chip ragu-ragu, dan kosong');

  // Verifikasi DB exam_sessions
  const dbSess = (
    await db.query('SELECT status, score, question_count FROM public.exam_sessions WHERE id = $1', [sessId])
  ).rows[0];
  assert.equal(dbSess.status, 'finished', 'session must be finished in DB');
  assert.equal(dbSess.score, 3, 'score in DB must be 3');
  assert.equal(dbSess.question_count, 5, 'question_count in DB must be 5');
  ok('Skenario 2g: Verifikasi DB exam_sessions score=3 status=finished');

  // Kontras AA di Result & Recap
  const rRes = await checkContrast(page, '[data-testid="ujian-recap-item"] [class*="text-fg"]', 4.5);
  if (rRes.found) {
    assert.ok(rRes.pass, `Recap contrast ${rRes.text}: ${rRes.ratio}`);
    ok('A11y: Kontras teks di recap memenuhi standar AA (>= 4.5:1)', `${rRes.ratio}:1`);
  }

  // =========================================================================
  // SKENARIO 3: Exam strict singkat (Skip & Refresh restore UM-16)
  // =========================================================================
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/ujian`);
  await page.waitForLoadState('networkidle');

  // Form setup Exam Strict
  await nameInput.waitFor();
  await nameInput.fill('E2E Strict');
  await page.getByRole('button', { name: 'Strict' }).click();
  await page.getByLabel('INFORMATIKA').check();
  await page.getByLabel('Matematika').check();
  await page.locator('label', { hasText: 'Kombinatorika' }).click();
  await page.locator('text=soal tersedia di sub-bab terpilih.').waitFor({ timeout: 10000 });
  await page.locator('[data-testid="ujian-preset-5"]').click();
  await startBtn.click();

  // Konfirmasi & Mulai
  await page.locator('[data-testid="ujian-confirm-start"]').waitFor();
  await page.locator('[data-testid="ujian-confirm-start"]').click();

  // Verifikasi UI Strict: TIDAK ADA tombol Back dan Daftar Soal
  await page.locator('[data-testid="ujian-timer"]').waitFor();
  assert.equal(await page.locator('[data-testid="ujian-back"]').count(), 0, 'strict must not have back button');
  assert.equal(await page.getByRole('button', { name: 'Daftar soal' }).count(), 0, 'strict must not have daftar soal');

  // Tombol Skip (Lewati) berfungsi
  const skipBtn = page.locator('[data-testid="ujian-skip"]');
  assert.ok(await skipBtn.isVisible(), 'skip button must be visible in strict');
  await skipBtn.click();

  // Masuk ke Soal 2
  await page.locator('text=Soal 2/5').waitFor();
  const q2Text = await page.locator('.clay-card, article').first().innerText();

  // Refresh di tengah pengerjaan (UM-16)
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Sesi pulih di soal yang sama!
  await page.locator('text=Soal 2/5').waitFor({ timeout: 10000 });
  const q2TextAfter = await page.locator('.clay-card, article').first().innerText();
  assert.equal(q2TextAfter, q2Text, 'soal yang tampil setelah refresh harus sama');
  ok('Skenario 3: Exam strict navigasi tanpa Back/Daftar Soal, Skip berfungsi, refresh restore di soal yang sama');

  // Bersihkan token dari storage sebelum lanjut skenario berikutnya
  await page.evaluate(() => localStorage.clear());

  // =========================================================================
  // SKENARIO 4: Survival sampai nyawa habis (Popup Benar/Salah, Refresh nyawa/timer)
  // =========================================================================
  await page.goto(`${BASE}/ujian`);
  await page.waitForLoadState('networkidle');

  await nameInput.waitFor();
  await nameInput.fill('E2E Survival');
  await page.locator('[data-testid="ujian-mode-survival"]').click();
  await page.getByLabel('INFORMATIKA').check();
  await page.getByLabel('Matematika').check();
  await page.locator('label', { hasText: 'Kombinatorika' }).click();
  await page.locator('text=soal tersedia di sub-bab terpilih.').waitFor({ timeout: 10000 });
  await page.locator('label', { hasText: '60 menit' }).click();

  await startBtn.click();
  await page.locator('[data-testid="ujian-confirm-start"]').waitFor();
  assert.ok(await page.locator('text=3 nyawa').isVisible(), 'konfirmasi survival harus tampilkan 3 nyawa');
  await page.locator('[data-testid="ujian-confirm-start"]').click();

  // Runtime Survival
  await page.locator('[data-testid="ujian-lives"]').waitFor();
  const livesEl = page.locator('[data-testid="ujian-lives"]');
  assert.equal(await livesEl.getAttribute('aria-label'), 'Nyawa 3 dari 3');

  // Ambil sesi survival dari DB
  const survSess = (
    await db.query(
      "SELECT id, question_order, expires_at FROM public.exam_sessions WHERE name = 'E2E Survival' ORDER BY created_at DESC LIMIT 1",
    )
  ).rows[0];
  const survId = survSess.id;
  const survQOrder = survSess.question_order;

  // Soal 1: Jawab Benar
  const q1Row = (
    await db.query('SELECT type, answer_key FROM public.questions WHERE id = $1', [survQOrder[0]])
  ).rows[0];
  await selectOption(true, q1Row.answer_key);
  await page.locator('[data-testid="ujian-next"]').click();

  // Popup feedback "Benar" (+1 skor)
  const feedback = page.locator('[data-testid="ujian-feedback"]');
  await feedback.waitFor();
  assert.ok(await feedback.innerText().then((t) => t.includes('Benar')));
  await page.screenshot({ path: join(SHOTS, 'ujian-survival-benar.png') });
  ok('Skenario 4a: Jawaban benar menampilkan popup Benar +1 skor');

  // Tunggu popup hilang dan skor bertambah
  await feedback.waitFor({ state: 'detached', timeout: 5000 });
  assert.equal(await page.locator('[data-testid="ujian-score"]').innerText(), '1');

  // Soal 2: Jawab Salah (-1 nyawa -> nyawa 2)
  await page.locator('text=Soal 2/').waitFor();
  const q2Row = (
    await db.query('SELECT type, answer_key FROM public.questions WHERE id = $1', [survQOrder[1]])
  ).rows[0];
  await selectOption(false, q2Row.answer_key);
  await page.locator('[data-testid="ujian-next"]').click();

  await feedback.waitFor();
  assert.ok(await feedback.innerText().then((t) => t.includes('Salah')));
  await feedback.waitFor({ state: 'detached', timeout: 5000 });

  // Verifikasi DB lives adalah 2
  const dbLives1 = (await db.query('SELECT lives FROM public.exam_sessions WHERE id = $1', [survId])).rows[0].lives;
  assert.equal(dbLives1, 2, 'DB lives must be 2 after 1 wrong answer');

  const livesBeforeRefresh = await livesEl.getAttribute('aria-label');
  if (livesBeforeRefresh !== 'Nyawa 2 dari 3') {
    results.push(`FAIL Skenario 4b (BUG-03 UI double decrement): UI menampilkan "${livesBeforeRefresh}" padahal DB lives=2`);
  } else {
    ok('Skenario 4b: Jawaban salah mengurangi nyawa menjadi 2');
  }

  // REFRESH di tengah (setelah nyawa 2 di DB)
  const _timerBefore = await page.locator('[data-testid="ujian-timer"]').innerText();
  const q3TextBefore = await page.locator('.clay-card, article').first().innerText();
  const dbExpiresBefore = (
    await db.query('SELECT expires_at FROM public.exam_sessions WHERE id = $1', [survId])
  ).rows[0].expires_at;

  await page.reload();
  await page.waitForLoadState('networkidle');

  // Verifikasi setelah refresh:
  await page.locator('[data-testid="ujian-lives"]').waitFor();
  assert.equal(await livesEl.getAttribute('aria-label'), 'Nyawa 2 dari 3', 'nyawa harus tetap 2 setelah refresh');

  const _timerAfter = await page.locator('[data-testid="ujian-timer"]').innerText();
  const dbExpiresAfter = (
    await db.query('SELECT expires_at FROM public.exam_sessions WHERE id = $1', [survId])
  ).rows[0].expires_at;
  assert.equal(
    new Date(dbExpiresBefore).getTime(),
    new Date(dbExpiresAfter).getTime(),
    'expires_at di DB tidak boleh bergeser',
  );

  const q3TextAfter = await page.locator('.clay-card, article').first().innerText();
  assert.equal(q3TextAfter, q3TextBefore, 'soal yang tampil harus sama persis sebelum dan sesudah refresh');

  await page.screenshot({ path: join(SHOTS, 'ujian-survival-refresh.png') });
  ok('Skenario 4c: Refresh memulihkan nyawa 2, timer tidak reset, expires_at DB tetap, dan soal sama');

  // Soal 3: Jawab Salah lagi (-1 nyawa -> nyawa 1)
  const q3Row = (
    await db.query('SELECT type, answer_key FROM public.questions WHERE id = $1', [survQOrder[2]])
  ).rows[0];
  await selectOption(false, q3Row.answer_key);
  await page.locator('[data-testid="ujian-next"]').click();
  await feedback.waitFor();
  await feedback.waitFor({ state: 'detached', timeout: 5000 });

  // Soal 4: Jawab Salah lagi (-1 nyawa -> nyawa 0 -> GAME OVER)
  await page.locator('text=Soal 4/').waitFor();
  const q4Row = (
    await db.query('SELECT type, answer_key FROM public.questions WHERE id = $1', [survQOrder[3]])
  ).rows[0];
  await selectOption(false, q4Row.answer_key);
  await page.locator('[data-testid="ujian-next"]').click();

  // Halaman hasil survival muncul otomatis (skor akhir + jumlah terjawab)
  await page.locator('[data-testid="ujian-result"]').waitFor({ timeout: 10000 });
  assert.ok(await page.locator('text=Hasil ujian mandiri • Survival').isVisible());
  assert.ok(await page.locator('text=4 soal terjawab').isVisible());
  assert.ok(await page.locator('text=Status: Nyawa habis').isVisible());
  await page.screenshot({ path: join(SHOTS, 'ujian-survival-hasil.png') });
  ok('Skenario 4d: Nyawa habis menyelesaikan sesi otomatis ke hasil survival (skor 1, 4 terjawab)');

  // Verifikasi DB
  const dbSurvDone = (
    await db.query('SELECT lives, end_reason, status FROM public.exam_sessions WHERE id = $1', [survId])
  ).rows[0];
  assert.equal(dbSurvDone.lives, 0, 'lives must be 0');
  assert.equal(dbSurvDone.end_reason, 'lives_out', 'end_reason must be lives_out');
  assert.equal(dbSurvDone.status, 'finished', 'status must be finished');
  ok('Skenario 4e: Verifikasi DB survival lives=0, end_reason=lives_out, status=finished');

  // =========================================================================
  // SKENARIO 5: Menyerah -> konfirmasi -> hasil dengan alasan menyerah
  // =========================================================================
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/ujian`);
  await page.waitForLoadState('networkidle');

  await nameInput.waitFor();
  await nameInput.fill('E2E Menyerah');
  await page.getByLabel('INFORMATIKA').check();
  await page.getByLabel('Matematika').check();
  await page.locator('label', { hasText: 'Kombinatorika' }).click();
  await page.locator('text=soal tersedia di sub-bab terpilih.').waitFor({ timeout: 10000 });
  await page.locator('[data-testid="ujian-preset-5"]').click();
  await startBtn.click();
  await page.locator('[data-testid="ujian-confirm-start"]').click();

  // Klik tombol Menyerah
  await page.locator('[data-testid="ujian-surrender"]').waitFor();
  await page.locator('[data-testid="ujian-surrender"]').click();

  // Modal konfirmasi menyerah
  await page.locator('text=Yakin ingin menyerah?').waitFor();
  await page.getByRole('button', { name: 'Ya, menyerah' }).click();

  // Halaman hasil menampilkan alasan menyerah
  await page.locator('[data-testid="ujian-result"]').waitFor();
  assert.ok(await page.locator('text=Status: Menyerah').isVisible());
  ok('Skenario 5: Menyerah memunculkan konfirmasi dan menghasilkan status Menyerah');

  // Verifikasi DB
  const dbSurr = (
    await db.query(
      "SELECT end_reason, status FROM public.exam_sessions WHERE name = 'E2E Menyerah' ORDER BY created_at DESC LIMIT 1",
    )
  ).rows[0];
  assert.equal(dbSurr.end_reason, 'surrender');
  assert.equal(dbSurr.status, 'finished');

  // =========================================================================
  // SKENARIO 6: Ulangi (UM-32) kembali ke setup dengan pilihan sebelumnya terisi
  // =========================================================================
  await page.getByRole('button', { name: 'Ulangi' }).click();
  await page.locator('[data-testid="ujian-start"]').waitFor();

  // Cek nilai form setup terisi kembali
  assert.equal(await nameInput.inputValue(), 'E2E Menyerah', 'nama harus tetap E2E Menyerah');
  assert.ok(
    await page.locator('label', { hasText: 'Kombinatorika' }).locator('input[type="checkbox"]').isChecked(),
    'topik Kombinatorika harus tetap tercentang',
  );
  ok('Skenario 6: Tombol Ulangi (UM-32) mengembalikan setup dengan pilihan sebelumnya');

  // =========================================================================
  // SKENARIO 7: Anti-curang (UM-18): 3x visibilitychange -> violation terminate
  // =========================================================================
  await nameInput.fill('E2E Curang');
  await page.locator('[data-testid="ujian-preset-5"]').click();
  await startBtn.click();
  await page.locator('[data-testid="ujian-confirm-start"]').click();
  await page.locator('[data-testid="ujian-timer"]').waitFor();

  // Ambil id sesi E2E Curang
  const cheatSess = (
    await db.query(
      "SELECT id FROM public.exam_sessions WHERE name = 'E2E Curang' ORDER BY created_at DESC LIMIT 1",
    )
  ).rows[0];

  // Helper trigger visibilitychange
  async function triggerTabSwitch() {
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  // Pelanggaran 1
  await triggerTabSwitch();
  await page.locator('text=Peringatan 1/3').waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: 'Saya paham, lanjutkan ujian' }).click();
  await page.locator('text=Peringatan 1/3').waitFor({ state: 'detached' });

  // Pelanggaran 2
  await triggerTabSwitch();
  await page.locator('text=Peringatan 2/3').waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: 'Saya paham, lanjutkan ujian' }).click();
  await page.locator('text=Peringatan 2/3').waitFor({ state: 'detached' });

  // Pelanggaran 3 -> batas terlampaui -> sesi ditutup
  await triggerTabSwitch();
  await page.locator('text=Peringatan 3/3').waitFor({ timeout: 5000 });
  assert.ok(
    await page.locator('text=Batas pelanggaran terlampaui. Ujian kamu dihentikan otomatis.').isVisible(),
  );

  // Verifikasi DB: violation_count 3 dan end_reason violation
  await sleep(1500);
  const dbCheat = (
    await db.query(
      'SELECT violation_count, end_reason, status FROM public.exam_sessions WHERE id = $1',
      [cheatSess.id],
    )
  ).rows[0];
  assert.equal(dbCheat.violation_count, 3, 'violation count must be 3');
  assert.equal(dbCheat.end_reason, 'violation', 'end_reason must be violation');
  assert.equal(dbCheat.status, 'finished', 'status must be finished');
  ok('Skenario 7: Anti-curang UM-18 modal peringatan 1..3x dan terminasi violation di DB');

  // =========================================================================
  // SKENARIO 9: Verifikasi Keamanan Network & localStorage
  // =========================================================================
  assert.deepEqual(networkLeaks, [], `Network leak detected: ${JSON.stringify(networkLeaks)}`);
  ok('Skenario 9a: Network request selama ujian aktif TIDAK PERNAH memuat answer_key/explanation_html/secret_hash');

  const lsItems = await page.evaluate(() => Object.entries(localStorage).map(([k, v]) => ({ key: k, val: v })));
  for (const item of lsItems) {
    assert.ok(!item.val.includes(cheatSess.id), 'plain session id must not be in localStorage');
    assert.ok(!item.val.includes('lives'), 'lives must not be plain in localStorage');
    assert.ok(!item.val.includes('score'), 'score must not be plain in localStorage');
    if (item.key === 'ujian_session') {
      assert.ok(item.val.includes('ct') && item.val.includes('mac'), 'token must be AES-GCM/HMAC encrypted');
    }
  }
  ok('Skenario 9b: localStorage terenkripsi penuh tanpa plain credential, skor, atau nyawa');

  // =========================================================================
  // SKENARIO 8: Admin di /admin/hasil (Anon guard, filter, peek modal)
  // =========================================================================
  // 8a. Anon context (1280x900)
  const anonCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const anonPage = await anonCtx.newPage();
  await anonPage.goto(`${BASE}/admin/hasil`);
  await anonPage.waitForURL((u) => u.pathname.endsWith('/login'), { timeout: 10000 });
  assert.ok(anonPage.url().includes('/admin/login'), 'anon must be redirected to /admin/login');
  ok('Skenario 8a: Akses anonim ke /admin/hasil diblokir dan diarahkan ke login');
  await anonCtx.close();

  // 8b. Admin Login & Lihat Hasil
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const adminPage = await adminCtx.newPage();
  const adminErrors = [];
  adminPage.on('pageerror', (e) => adminErrors.push(String(e)));

  await adminPage.goto(`${BASE}/admin/login`);
  await adminPage.locator('input[type=email]').fill(env.LOCAL_ADMIN_EMAIL);
  await adminPage.locator('input[type=password]').fill(env.LOCAL_ADMIN_PASSWORD);
  await adminPage.locator('button[type=submit]').click();
  await adminPage.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 });

  await adminPage.goto(`${BASE}/admin/hasil`);
  await adminPage.waitForLoadState('networkidle');

  // Cari nama siswa E2E Standard
  const searchInput = adminPage.locator('input[placeholder="Cari nama siswa..."]');
  await searchInput.waitFor();
  await searchInput.fill('E2E Standard');
  await sleep(600); // debounce

  // Baris hasil muncul
  const hasilRow = adminPage.locator('[data-testid="admin-hasil-row"]').first();
  await hasilRow.waitFor({ timeout: 5000 });
  const rowText = await hasilRow.innerText();
  assert.ok(rowText.includes('E2E Standard'), 'row must include student name');
  assert.ok(rowText.includes('Exam (standard)'), 'row must include Exam (standard)');
  assert.ok(rowText.includes('3/5 (60%)'), 'row must include score 3/5 (60%)');
  assert.ok(rowText.includes('Tidak lulus'), 'row must show status Tidak lulus');

  await adminPage.screenshot({ path: join(SHOTS, 'ujian-admin-hasil.png') });
  ok('Skenario 8b: Rekap hasil ujian mandiri admin tampil lengkap (nama, mode, skor, kelulusan)');

  // Klik Intip jawaban (UM-33)
  const peekBtn = hasilRow.locator('[data-testid="admin-hasil-peek"]');
  await peekBtn.click();

  // Modal read-only detail terbuka
  await adminPage.locator('text=Detail jawaban: E2E Standard').waitFor();
  // Detail loads async after the modal title renders, so wait. "Pembahasan" only renders when a
  // question has explanation_html (local seed has none); assert the per-item key every row shows.
  const dialog = adminPage.getByRole('dialog');
  await dialog.locator('text=Soal #1').waitFor({ timeout: 10000 });
  assert.ok(await dialog.getByText(/^Kunci:?$/).first().isVisible(), 'detail must mark the answer key');

  await adminPage.screenshot({ path: join(SHOTS, 'ujian-admin-intip.png') });
  ok('Skenario 8c: Modal Intip jawaban siswa (read-only) menampilkan jawaban dan pembahasan');

  // Tutup modal
  await adminPage.getByRole('button', { name: 'Tutup' }).first().click();
  await adminPage.locator('text=Detail jawaban: E2E Standard').waitFor({ state: 'detached' });

  assert.deepEqual(adminErrors, [], adminErrors.join('\n'));
  await adminCtx.close();

  // =========================================================================
  // SKENARIO 10: Zero Page Errors
  // =========================================================================
  assert.deepEqual(pageErrors, [], `Page errors occurred: ${pageErrors.join('\n')}`);
  ok('Skenario 10: 0 pageerror di seluruh skenario dan halaman');

  await mobileCtx.close();
} finally {
  await cleanupData();
  await browser.close();
  await db.end();
  console.log('\n--- HASIL E2E PLAYWRIGHT ---');
  console.log(results.join('\n'));
}