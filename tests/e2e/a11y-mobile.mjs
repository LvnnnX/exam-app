// tests/e2e/a11y-mobile.mjs
// Audit Mobile (360x780), axe-core (WCAG 2.0/2.1 AA), Console Errors/Hydration, dan JS First-Load Bundle.
// Usage: node tests/e2e/a11y-mobile.mjs [baseUrl] (default http://localhost:3100)

import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import pg from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';
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

const q1 = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.r;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
let passCount = 0;
let failCount = 0;

function reportPass(label, detail = '') {
  passCount++;
  const line = `PASS ${label}${detail ? ` (${detail})` : ''}`;
  results.push(line);
  console.log(line);
}

function reportFail(label, detail = '') {
  failCount++;
  const line = `FAIL ${label}${detail ? ` (${detail})` : ''}`;
  results.push(line);
  console.log(line);
}

  // Helper navigasi aman
  async function safeGoto(targetPage, url, waitState = 'load') {
    await targetPage.goto(url, { waitUntil: waitState, timeout: 30000 });
    // Beri waktu sejenak agar rendering / dynamic load selesai
    await sleep(800);
  }
const axeViolationsMap = [];
const bundleStats = {};

// Helper evaluasi mobile: overflow, tap target, font size
async function auditMobileState(page, pageName, stateName, screenshotFile) {
  // 1. Screenshot
  if (screenshotFile) {
    const shotPath = join(SHOTS, screenshotFile);
    await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});
  }

  // 2. Overflow scrollWidth <= 360
  const overflow = await page.evaluate(() => {
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    const overflowingEls = [];
    if (sw > 360) {
      const all = document.querySelectorAll('*');
      for (const el of all) {
        const rect = el.getBoundingClientRect();
        if (rect.right > 360 + 0.5) {
          const tag = el.tagName.toLowerCase();
          const cls = (el.className && typeof el.className === 'string') ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
          const id = el.id ? `#${el.id}` : '';
          const snippet = (el.textContent || '').trim().slice(0, 30);
          overflowingEls.push({
            selector: `${tag}${id}${cls}`,
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            snippet,
          });
          if (overflowingEls.length >= 5) break;
        }
      }
    }
    return { sw, cw, overflowingEls };
  });

  if (overflow.sw <= 360) {
    reportPass(`[Mobile] ${pageName} (${stateName}) - scrollWidth <= 360px`, `width: ${overflow.sw}px`);
  } else {
    const badDetail = overflow.overflowingEls.map((e) => `${e.selector} (right: ${e.right}px)`).join('; ');
    reportFail(`[Mobile] ${pageName} (${stateName}) - scrollWidth <= 360px`, `scrollWidth=${overflow.sw}px > 360px. Elemen: ${badDetail}`);
  }

  // 3. Touch target >= 44x44
  const tapAudit = await page.evaluate(() => {
    const interactiveSel = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"]';
    const elements = Array.from(document.querySelectorAll(interactiveSel));
    const failures = [];
    for (const el of elements) {
      // Lewati elemen yang tidak terlihat / hidden
      const style = window.getComputedStyle(el);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        el.getAttribute('aria-hidden') === 'true' ||
        el.classList.contains('sr-only')
      ) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      // Di luar viewport jauh
      if (rect.bottom < 0 || rect.top > window.innerHeight * 2) continue;

      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute('type') || '';
      const isFullWidthInput = (tag === 'input' && ['text', 'email', 'password', 'search', 'number'].includes(type)) || tag === 'textarea';

      // Input teks lebar penuh: tinggi >= 44px
      if (isFullWidthInput) {
        if (rect.height < 43.5) {
          failures.push({
            selector: `${tag}[type="${type}"]${el.id ? `#${el.id}` : ''}`,
            text: el.placeholder || el.value || '',
            size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
            reason: `tinggi < 44px (${Math.round(rect.height)}px)`,
          });
        }
      } else {
        // Elemen interaktif lain: tinggi DAN lebar >= 44px
        if (rect.width < 43.5 || rect.height < 43.5) {
          const txt = (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().slice(0, 25);
          const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 2).join('.') : '';
          failures.push({
            selector: `${tag}${el.id ? `#${el.id}` : cls ? `.${cls}` : ''}`,
            text: txt,
            size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
            reason: `ukuran < 44x44 (${Math.round(rect.width)}x${Math.round(rect.height)})`,
          });
        }
      }
    }
    return { count: elements.length, failures };
  });

  if (tapAudit.failures.length === 0) {
    reportPass(`[Mobile] ${pageName} (${stateName}) - Touch targets >= 44px`, `${tapAudit.count} elemen`);
  } else {
    const list = tapAudit.failures.slice(0, 5).map((f) => `"${f.text || f.selector}" (${f.size})`).join(', ');
    const more = tapAudit.failures.length > 5 ? ` +${tapAudit.failures.length - 5} lainnya` : '';
    reportFail(`[Mobile] ${pageName} (${stateName}) - Touch targets >= 44px`, `${tapAudit.failures.length} elemen gagal: ${list}${more}`);
  }

  // 4. Font size >= 14px (soal/opsi >= 16px)
  const fontAudit = await page.evaluate((_sName) => {
    const failures = [];
    const mainTexts = document.querySelectorAll('p, span, li, label, dd, dt, h1, h2, h3, h4');
    for (const el of mainTexts) {
      if (el.children.length > 0) continue; // Leaf node teks
      const text = (el.textContent || '').trim();
      if (!text || text.length < 3) continue;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const fz = parseFloat(style.fontSize);

      // Cek khusus soal dan opsi (harus >= 16px)
      const isQuestionOrOption =
        el.closest('[data-testid^="ujian-option-"]') ||
        el.closest('.prose') ||
        el.closest('article') ||
        el.closest('.rich-content');

      if (isQuestionOrOption) {
        if (fz < 15.5) {
          failures.push({
            text: text.slice(0, 25),
            fz: `${fz}px`,
            required: '>= 16px (soal/opsi)',
          });
        }
      } else {
        // Teks utama biasa (abaikan badge mikro/keterangan kecil eksplisit < 12px jika memang subtext)
        if (fz < 13.5 && !style.textTransform.includes('uppercase') && !el.closest('footer') && !el.closest('[class*="text-[10px]"]') && !el.closest('[class*="text-[11px]"]')) {
          failures.push({
            text: text.slice(0, 25),
            fz: `${fz}px`,
            required: '>= 14px (teks utama)',
          });
        }
      }
      if (failures.length >= 6) break;
    }
    return failures;
  }, stateName);

  if (fontAudit.length === 0) {
    reportPass(`[Mobile] ${pageName} (${stateName}) - Font-size valid (teks >= 14px, soal/opsi >= 16px)`);
  } else {
    const list = fontAudit.slice(0, 3).map((f) => `"${f.text}" (${f.fz} < ${f.required})`).join('; ');
    reportFail(`[Mobile] ${pageName} (${stateName}) - Font-size valid`, `${fontAudit.length} teks di bawah batas: ${list}`);
  }
}

// Helper run axe-core
async function runAxe(page, pageName) {
  try {
    const axe = new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
    const results = await axe.analyze();

    const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    for (const v of results.violations) {
      const imp = v.impact || 'minor';
      counts[imp] = (counts[imp] || 0) + 1;

      // Catat ke json map
      for (const node of v.nodes) {
        axeViolationsMap.push({
          page: pageName,
          id: v.id,
          impact: v.impact,
          help: v.help,
          helpUrl: v.helpUrl,
          target: node.target.join(' > '),
          html: (node.html || '').slice(0, 200),
          failureSummary: node.failureSummary ? node.failureSummary.slice(0, 200) : '',
        });
      }
    }

    const summaryStr = `critical: ${counts.critical}, serious: ${counts.serious}, moderate: ${counts.moderate}, minor: ${counts.minor}`;
    if (counts.critical === 0 && counts.serious === 0) {
      reportPass(`[Axe] ${pageName} - WCAG 2.0/2.1 AA (0 critical/serious)`, summaryStr);
    } else {
      reportFail(`[Axe] ${pageName} - WCAG 2.0/2.1 AA (ada critical/serious)`, summaryStr);
    }
  } catch (err) {
    reportFail(`[Axe] ${pageName} - Error executing axe`, String(err));
  }
}

// Helper ukur JS first-load bundle via CDP
async function _measureBundle(browser, routePath, routeName) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });

  const scripts = new Map(); // requestId -> info

  client.on('Network.responseReceived', (e) => {
    if (e.type === 'Script' && e.response.url.startsWith(BASE)) {
      scripts.set(e.requestId, {
        url: e.response.url,
        status: e.response.status,
        headers: e.response.headers,
        encodedDataLength: e.response.encodedDataLength || 0,
      });
    }
  });

  client.on('Network.loadingFinished', (e) => {
    if (scripts.has(e.requestId)) {
      const s = scripts.get(e.requestId);
      s.encodedDataLength = e.encodedDataLength;
    }
  });

  try {
    await page.goto(`${BASE}${routePath}`, { waitUntil: 'load', timeout: 30000 });
    await sleep(2000);
  } catch {
    // Continue on timeout
  }

  let totalTransfer = 0;
  let totalDecoded = 0;
  const scriptDetails = [];

  for (const [reqId, s] of scripts.entries()) {
    let bodyLen = 0;
    try {
      const bodyRes = await client.send('Network.getResponseBody', { requestId: reqId });
      bodyLen = bodyRes.body ? Buffer.byteLength(bodyRes.body, bodyRes.base64Encoded ? 'base64' : 'utf8') : 0;
    } catch {
      bodyLen = s.encodedDataLength;
    }

    const transfer = s.encodedDataLength || bodyLen;
    const decoded = bodyLen || transfer;
    totalTransfer += transfer;
    totalDecoded += decoded;

    const parsedUrl = new URL(s.url);
    const chunkName = parsedUrl.pathname.split('/').pop() || s.url;
    scriptDetails.push({
      name: chunkName,
      transferKb: Number((transfer / 1024).toFixed(1)),
      decodedKb: Number((decoded / 1024).toFixed(1)),
    });
  }

  scriptDetails.sort((a, b) => b.transferKb - a.transferKb);

  const transferKb = Number((totalTransfer / 1024).toFixed(1));
  const decodedKb = Number((totalDecoded / 1024).toFixed(1));
  const flag300 = transferKb > 300;

  bundleStats[routeName] = {
    route: routePath,
    transferKb,
    decodedKb,
    scriptCount: scripts.size,
    flag300,
    top3: scriptDetails.slice(0, 3),
  };

  if (!flag300) {
    reportPass(`[Bundle] ${routeName} (${routePath}) <= 300 KB transfer`, `${transferKb} KB transfer (decoded: ${decodedKb} KB, ${scripts.size} scripts)`);
  } else {
    reportFail(`[Bundle] ${routeName} (${routePath}) <= 300 KB transfer`, `EXCEEDS 300 KB: ${transferKb} KB transfer (decoded: ${decodedKb} KB)`);
  }

  await context.close();
}

console.log('='.repeat(65));
console.log('AUDIT MOBILE (360x780), AXE WCAG, CONSOLE, DAN BUNDLE JS');
console.log('Base URL:', BASE);
console.log('='.repeat(65));

await db.connect();

const DUMMY_QUIZ_IDS = [];
let quizCode = '';
let quizPlayerId = '';

const browser = await chromium.launch({ headless: true });

try {
  // Setup Kuis Live via DB untuk pengujian /kuis/<kode>
  console.log('\n[Setup] Membuat kuis dummy via rpc_create_quiz...');
  const qCreate = await q1(
    "SELECT public.rpc_create_quiz(ARRAY[]::uuid[], 5, 15, 'standard', true, '{}'::jsonb) AS r",
  );
  assert.ok(qCreate && qCreate.success, `Gagal membuat kuis dummy: ${JSON.stringify(qCreate)}`);
  DUMMY_QUIZ_IDS.push(qCreate.quiz_id);
  quizCode = qCreate.code;

  const joinRes = await q1('SELECT public.rpc_join_live_quiz($1, $2) AS r', [quizCode, 'E2E-F7 Mobile']);
  assert.ok(joinRes && joinRes.success, `Gagal join kuis dummy: ${JSON.stringify(joinRes)}`);
  quizPlayerId = joinRes.player_id;

  // =========================================================================
  // BAGIAN A: AUDIT MOBILE (360x780) + CONSOLE (Siswa)
  // =========================================================================
  console.log('\n=============================================================');
  console.log('BAGIAN A: AUDIT MOBILE VIEWPORT 360x780 (HALAMAN SISWA)');
  console.log('=============================================================');

  const mobileCtx = await browser.newContext({
    viewport: { width: 360, height: 780 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  });

  const mobilePage = await mobileCtx.newPage();

  // Kolektor console errors/hydration
  const pageErrors = [];
  const hydrationWarnings = [];
  mobilePage.on('pageerror', (err) => {
    const msg = String(err);
    pageErrors.push(msg);
  });
  mobilePage.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      pageErrors.push(`[console.error] ${text}`);
    } else if (text.toLowerCase().includes('hydrat')) {
      hydrationWarnings.push(`[hydration] ${text}`);
    }
  });

  // A1. Halaman Depan ('/')
  console.log('\n--> Audit / (Home)');
  await safeGoto(mobilePage, `${BASE}/`);
  await auditMobileState(mobilePage, '/', 'home', 'mobile-home.png');

  // A2. Halaman Kuis: Ruang Tunggu ('/kuis/<kode>')
  console.log(`\n--> Audit /kuis/${quizCode} (Ruang Tunggu)`);
  await mobilePage.evaluate(([code, pId, qId]) => {
    localStorage.setItem(`quiz_player_${code}`, JSON.stringify({
      playerId: pId,
      quizId: qId,
      name: 'E2E-F7 Mobile',
      skin: 'mount:horse',
    }));
  }, [quizCode, quizPlayerId, qCreate.quiz_id]);

  await safeGoto(mobilePage, `${BASE}/kuis/${quizCode}`);
  await mobilePage.locator('text=Ruang Tunggu').waitFor({ timeout: 10000 });
  await auditMobileState(mobilePage, `/kuis/${quizCode}`, 'waiting-room', 'mobile-quiz-waiting.png');

  // A3. Halaman Kuis: Soal Aktif ('/kuis/<kode>')
  console.log(`\n--> Audit /kuis/${quizCode} (Soal Kuis Aktif)`);
  // Mulai kuis via DB
  const startQuiz = await q1("SELECT public.rpc_admin_update_quiz_status($1, 'start') AS r", [qCreate.quiz_id]);
  assert.ok(startQuiz && startQuiz.success, 'Gagal memulai kuis dummy');
  await sleep(1500); // SSE/poll update
  await mobilePage.reload({ waitUntil: 'load' });
  await sleep(800);
  await mobilePage.locator('button[type="button"]:has(span:has-text("A"))').first().waitFor({ timeout: 10000 });
  await auditMobileState(mobilePage, `/kuis/${quizCode}`, 'active-question', 'mobile-quiz-question.png');

  // A4. Ujian: Setup ('/ujian')
  console.log('\n--> Audit /ujian (Setup)');
  await mobilePage.evaluate(() => localStorage.clear());
  await safeGoto(mobilePage, `${BASE}/ujian`);
  await mobilePage.locator('[data-testid="ujian-name"]').waitFor({ timeout: 10000 });
  await auditMobileState(mobilePage, '/ujian', 'setup', 'mobile-ujian-setup.png');

  // A5. Ujian: Konfirmasi Identitas
  console.log('\n--> Audit /ujian (Konfirmasi Identitas)');
  await mobilePage.locator('[data-testid="ujian-name"]').fill('E2E-F7 Mobile');
  await mobilePage.getByLabel('INFORMATIKA').check();
  await mobilePage.getByLabel('Matematika').check();
  await mobilePage.locator('label', { hasText: 'Kombinatorika' }).click();
  await mobilePage.locator('text=soal tersedia di sub-bab terpilih.').waitFor({ timeout: 10000 });
  await mobilePage.locator('[data-testid="ujian-preset-5"]').click();
  await mobilePage.locator('[data-testid="ujian-start"]').click();
  await mobilePage.locator('text=Periksa kembali data ujian').waitFor({ timeout: 10000 });
  await auditMobileState(mobilePage, '/ujian', 'confirm', 'mobile-ujian-confirm.png');

  // A6. Ujian: Runtime Exam
  console.log('\n--> Audit /ujian (Runtime Exam)');
  await mobilePage.locator('[data-testid="ujian-confirm-start"]').click();
  await mobilePage.locator('[data-testid="ujian-timer"]').waitFor({ timeout: 10000 });
  await auditMobileState(mobilePage, '/ujian', 'runtime-exam', 'mobile-ujian-exam-runtime.png');

  // Selesaikan ujian untuk mendapatkan hasil + rekap
  // Jawab 5 soal sampai selesai
  for (let i = 0; i < 6; i++) {
    await sleep(500);
    const finishBtn = mobilePage.locator('[data-testid="ujian-finish"]');
    if (await finishBtn.isVisible().catch(() => false)) {
      await finishBtn.click();
      break;
    }
    const shortInput = mobilePage.locator('[data-testid="ujian-short-input"]');
    if (await shortInput.isVisible().catch(() => false)) {
      await shortInput.fill('10');
    } else {
      const optA = mobilePage.locator('[data-testid="ujian-option-A"], [data-testid^="ujian-option-"]').first();
      if (await optA.isVisible().catch(() => false)) {
        await optA.click();
      }
    }
    await sleep(200);
    const finishBtn2 = mobilePage.locator('[data-testid="ujian-finish"]');
    if (await finishBtn2.isVisible().catch(() => false)) {
      await finishBtn2.click();
      break;
    } else {
      const nextBtn = mobilePage.locator('[data-testid="ujian-next"]');
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
      }
    }
  }

  // Konfirmasi selesai
  await mobilePage.locator('text=Kumpulkan jawaban?').waitFor({ timeout: 10000 });
  await mobilePage.getByRole('button', { name: 'Ya, kumpulkan' }).click();

  // A7. Ujian: Hasil (Exam)
  console.log('\n--> Audit /ujian (Hasil)');
  await mobilePage.locator('[data-testid="ujian-result"]').waitFor({ timeout: 10000 });
  await auditMobileState(mobilePage, '/ujian', 'result', 'mobile-ujian-result.png');

  // A8. Ujian: Rekap Pembahasan
  console.log('\n--> Audit /ujian (Rekap Pembahasan)');
  await mobilePage.getByRole('button', { name: 'Lihat pembahasan' }).click();
  await mobilePage.locator('[data-testid="ujian-recap-item"]').first().waitFor({ timeout: 10000 });
  await auditMobileState(mobilePage, '/ujian', 'recap', 'mobile-ujian-recap.png');

  // A9. Ujian: Runtime Survival
  console.log('\n--> Audit /ujian (Runtime Survival)');
  await mobilePage.evaluate(() => localStorage.clear());
  await safeGoto(mobilePage, `${BASE}/ujian`);
  await mobilePage.locator('[data-testid="ujian-name"]').fill('E2E-F7 Survival');
  await mobilePage.locator('[data-testid="ujian-mode-survival"]').click();
  await mobilePage.getByLabel('INFORMATIKA').check();
  await mobilePage.getByLabel('Matematika').check();
  await mobilePage.locator('label', { hasText: 'Kombinatorika' }).click();
  await mobilePage.locator('text=soal tersedia di sub-bab terpilih.').waitFor({ timeout: 10000 });
  await mobilePage.locator('label', { hasText: '60 menit' }).click();
  await mobilePage.locator('[data-testid="ujian-start"]').click();
  await mobilePage.locator('[data-testid="ujian-confirm-start"]').waitFor({ timeout: 10000 });
  await mobilePage.locator('[data-testid="ujian-confirm-start"]').click();
  await mobilePage.locator('[data-testid="ujian-lives"]').waitFor({ timeout: 10000 });
  await auditMobileState(mobilePage, '/ujian', 'runtime-survival', 'mobile-ujian-survival-runtime.png');

  // Selesaikan sesi survival agar tidak menggantung
  const surrBtn = mobilePage.locator('[data-testid="ujian-surrender"]');
  if (await surrBtn.isVisible().catch(() => false)) {
    await surrBtn.click();
    await mobilePage.locator('text=Yakin ingin menyerah?').waitFor();
    await mobilePage.getByRole('button', { name: 'Ya, menyerah' }).click();
    await mobilePage.locator('[data-testid="ujian-result"]').waitFor();
  }

  // Cek Console Errors pada sesi Mobile
  if (pageErrors.length === 0) {
    reportPass('[Console] Zero page errors pada sesi siswa mobile');
  } else {
    reportFail('[Console] Page errors terdeteksi pada sesi siswa mobile', pageErrors.join(' | '));
  }

  if (hydrationWarnings.length === 0) {
    reportPass('[Console] Zero hydration warnings pada sesi siswa mobile');
  } else {
    reportFail('[Console] Hydration warning terdeteksi pada sesi siswa mobile', hydrationWarnings.join(' | '));
  }

  await mobileCtx.close();

  // =========================================================================
  // BAGIAN B: AUDIT AXE-CORE (WCAG 2.0/2.1 AA) & CONSOLE (SEMUA HALAMAN)
  // =========================================================================
  console.log('\n=============================================================');
  console.log('BAGIAN B: AUDIT AXE-CORE (WCAG 2.0 / 2.1 AA) & CONSOLE ERRORS');
  console.log('=============================================================');

  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await desktopCtx.newPage();

  const deskPageErrors = [];
  const deskHydration = [];
  page.on('pageerror', (err) => deskPageErrors.push(String(err)));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') deskPageErrors.push(`[console.error] ${text}`);
    if (text.toLowerCase().includes('hydrat')) deskHydration.push(`[hydration] ${text}`);
  });

  // B1. '/'
  console.log('\n--> Axe: /');
  await safeGoto(page, `${BASE}/`);
  await runAxe(page, '/');

  // B2. '/ujian' (setup)
  console.log('\n--> Axe: /ujian (setup)');
  await page.evaluate(() => localStorage.clear());
  await safeGoto(page, `${BASE}/ujian`);
  await runAxe(page, '/ujian (setup)');

  // B3. '/ujian' (runtime)
  console.log('\n--> Axe: /ujian (runtime)');
  await page.locator('[data-testid="ujian-name"]').fill('E2E-F7 Axe');
  await page.getByLabel('INFORMATIKA').check();
  await page.getByLabel('Matematika').check();
  await page.locator('label', { hasText: 'Kombinatorika' }).click();
  await page.locator('text=soal tersedia di sub-bab terpilih.').waitFor({ timeout: 10000 });
  await page.locator('[data-testid="ujian-preset-5"]').click();
  await page.locator('[data-testid="ujian-start"]').click();
  await page.locator('[data-testid="ujian-confirm-start"]').waitFor({ timeout: 10000 });
  await page.locator('[data-testid="ujian-confirm-start"]').click();
  await page.locator('[data-testid="ujian-timer"]').waitFor({ timeout: 10000 });
  await runAxe(page, '/ujian (runtime)');

  // B4. '/ujian' (hasil)
  console.log('\n--> Axe: /ujian (hasil)');
  const finishBtnDesk = page.locator('[data-testid="ujian-finish"]');
  const surrenderBtnDesk = page.locator('[data-testid="ujian-surrender"]');
  if (await surrenderBtnDesk.isVisible().catch(() => false)) {
    await surrenderBtnDesk.click();
    await page.getByRole('button', { name: 'Ya, menyerah' }).click();
  } else if (await finishBtnDesk.isVisible().catch(() => false)) {
    await finishBtnDesk.click();
    await page.getByRole('button', { name: 'Ya, kumpulkan' }).click();
  }
  await page.locator('[data-testid="ujian-result"]').waitFor({ timeout: 10000 });
  await runAxe(page, '/ujian (hasil)');

  // B5. '/kuis/<kode>' (waiting)
  console.log(`\n--> Axe: /kuis/${quizCode} (waiting)`);
  // Buat kuis waiting baru khusus axe
  const qAxe = await q1("SELECT public.rpc_create_quiz(ARRAY[]::uuid[], 5, 15, 'standard', true, '{}'::jsonb) AS r");
  assert.ok(qAxe && qAxe.success);
  DUMMY_QUIZ_IDS.push(qAxe.quiz_id);
  const jAxe = await q1('SELECT public.rpc_join_live_quiz($1, $2) AS r', [qAxe.code, 'E2E-F7 AxePlayer']);
  assert.ok(jAxe && jAxe.success);

  await page.evaluate(([code, pId, qId]) => {
    localStorage.setItem(`quiz_player_${code}`, JSON.stringify({
      playerId: pId,
      quizId: qId,
      name: 'E2E-F7 AxePlayer',
      skin: 'mount:horse',
    }));
  }, [qAxe.code, jAxe.player_id, qAxe.quiz_id]);

  await safeGoto(page, `${BASE}/kuis/${qAxe.code}`);
  await page.locator('text=Ruang Tunggu').waitFor({ timeout: 10000 });
  await runAxe(page, `/kuis/${qAxe.code} (waiting)`);

  // B6. '/kuis/<kode>' (soal)
  console.log(`\n--> Axe: /kuis/${qAxe.code} (soal)`);
  await q1("SELECT public.rpc_admin_update_quiz_status($1, 'start') AS r", [qAxe.quiz_id]);
  await sleep(1500);
  await page.reload({ waitUntil: 'load' });
  await sleep(800);
  await page.locator('button[type="button"]:has(span:has-text("A"))').first().waitFor({ timeout: 10000 });
  await runAxe(page, `/kuis/${qAxe.code} (soal)`);

  // B7. '/admin/login'
  console.log('\n--> Axe: /admin/login');
  await safeGoto(page, `${BASE}/admin/login`);
  await runAxe(page, '/admin/login');

  // B8. '/admin/register'
  console.log('\n--> Axe: /admin/register');
  await safeGoto(page, `${BASE}/admin/register`);
  await runAxe(page, '/admin/register');

  // Login Admin untuk rute admin terproteksi
  console.log('\n[Auth] Melakukan login admin...');
  await safeGoto(page, `${BASE}/admin/login`);
  await page.locator('input[type=email]').fill(env.LOCAL_ADMIN_EMAIL);
  await page.locator('input[type=password]').fill(env.LOCAL_ADMIN_PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 });

  // B9. '/admin'
  console.log('\n--> Axe: /admin');
  await safeGoto(page, `${BASE}/admin`);
  await runAxe(page, '/admin');

  // B10. '/admin/soal' (+ modal tambah soal terbuka)
  console.log('\n--> Axe: /admin/soal');
  await safeGoto(page, `${BASE}/admin/soal`);
  await runAxe(page, '/admin/soal');

  console.log('\n--> Axe: /admin/soal (modal tambah soal terbuka)');
  const tambahSoalBtn = page.getByRole('button', { name: 'Tambah Soal' });
  await tambahSoalBtn.waitFor({ timeout: 10000 });
  await tambahSoalBtn.click();
  await page.locator('text=Tambah Soal Baru').waitFor({ timeout: 10000 });
  await runAxe(page, '/admin/soal (modal tambah soal)');
  // Tutup modal
  await page.locator('button:has(svg.lucide-x)').first().click();
  await page.locator('text=Tambah Soal Baru').waitFor({ state: 'detached' });

  // B11. '/admin/kategori'
  console.log('\n--> Axe: /admin/kategori');
  await safeGoto(page, `${BASE}/admin/kategori`);
  await runAxe(page, '/admin/kategori');

  // B12. '/admin/kuis'
  console.log('\n--> Axe: /admin/kuis');
  await safeGoto(page, `${BASE}/admin/kuis`);
  await runAxe(page, '/admin/kuis');

  // B13. '/admin/hasil'
  console.log('\n--> Axe: /admin/hasil');
  await safeGoto(page, `${BASE}/admin/hasil`);
  await runAxe(page, '/admin/hasil');

  // B14. '/admin/kelola-admin'
  console.log('\n--> Axe: /admin/kelola-admin');
  await safeGoto(page, `${BASE}/admin/kelola-admin`);
  await runAxe(page, '/admin/kelola-admin');

  // Evaluasi console error desktop/admin
  if (deskPageErrors.length === 0) {
    reportPass('[Console] Zero page errors pada rute admin & public desktop');
  } else {
    reportFail('[Console] Page errors terdeteksi pada rute admin/public desktop', deskPageErrors.join(' | '));
  }

  if (deskHydration.length === 0) {
    reportPass('[Console] Zero hydration warnings pada rute admin & public desktop');
  } else {
    reportFail('[Console] Hydration warning terdeteksi pada rute admin/public desktop', deskHydration.join(' | '));
  }

  await desktopCtx.close();

  // Simpan detail axe violations ke docs/qa/fase7-axe.json
  const axeJsonPath = join(process.cwd(), 'docs', 'qa', 'fase7-axe.json');
  writeFileSync(axeJsonPath, JSON.stringify(axeViolationsMap, null, 2), 'utf8');
  console.log(`\n[Axe Report] File disimpan di: ${axeJsonPath} (${axeViolationsMap.length} total node pelanggaran)`);

  if (failCount > 0) {
    process.exitCode = 1;
  }

  // =========================================================================
  // BAGIAN D: AUDIT JS FIRST-LOAD BUNDLE SIZE PER ROUTE
  // =========================================================================
  console.log('\n=============================================================');
  console.log('BAGIAN D: AUDIT UKURAN JS FIRST-LOAD BUNDLE');
  console.log('=============================================================');

  // Kuis untuk route /kuis/[kode]
  const qBundle = await q1("SELECT public.rpc_create_quiz(ARRAY[]::uuid[], 5, 15, 'standard', true, '{}'::jsonb) AS r");
  DUMMY_QUIZ_IDS.push(qBundle.quiz_id);

  // Buat context dengan admin session cookies untuk rute admin
  const adminAuthCtx = await browser.newContext();
  const authAdminPage = await adminAuthCtx.newPage();
  await authAdminPage.goto(`${BASE}/admin/login`);
  await authAdminPage.locator('input[type=email]').fill(env.LOCAL_ADMIN_EMAIL);
  await authAdminPage.locator('input[type=password]').fill(env.LOCAL_ADMIN_PASSWORD);
  await authAdminPage.locator('button[type=submit]').click();
  await authAdminPage.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 });
  const adminCookies = await adminAuthCtx.cookies();
  await adminAuthCtx.close();

  const routesToMeasure = [
    { path: '/', name: 'Home (/)' },
    { path: '/ujian', name: 'Ujian (/ujian)' },
    { path: `/kuis/${qBundle.code}`, name: `Kuis (/kuis/${qBundle.code})` },
    { path: '/admin/login', name: 'Admin Login (/admin/login)' },
    { path: '/admin', name: 'Admin Dashboard (/admin)', admin: true },
    { path: '/admin/soal', name: 'Admin Soal (/admin/soal)', admin: true },
    { path: '/admin/kategori', name: 'Admin Kategori (/admin/kategori)', admin: true },
    { path: '/admin/kuis', name: 'Admin Kuis (/admin/kuis)', admin: true },
    { path: '/admin/hasil', name: 'Admin Hasil (/admin/hasil)', admin: true },
    { path: '/admin/kelola-admin', name: 'Admin Kelola Admin (/admin/kelola-admin)', admin: true },
  ];

  for (const r of routesToMeasure) {
    const ctx = await browser.newContext();
    if (r.admin) {
      await ctx.addCookies(adminCookies);
    }
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

    const scripts = new Map();
    cdp.on('Network.responseReceived', (e) => {
      if (e.type === 'Script' && e.response.url.startsWith(BASE)) {
        scripts.set(e.requestId, {
          url: e.response.url,
          encodedDataLength: e.response.encodedDataLength || 0,
        });
      }
    });

    cdp.on('Network.loadingFinished', (e) => {
      if (scripts.has(e.requestId)) {
        scripts.get(e.requestId).encodedDataLength = e.encodedDataLength;
      }
    });

    try {
      await p.goto(`${BASE}${r.path}`, { waitUntil: 'load', timeout: 30000 });
      await sleep(2000);
    } catch {
      // Continue on timeout
    }

    let totalTransfer = 0;
    let totalDecoded = 0;
    const scriptDetails = [];

    for (const [reqId, s] of scripts.entries()) {
      let bodyLen = 0;
      try {
        const bodyRes = await cdp.send('Network.getResponseBody', { requestId: reqId });
        bodyLen = bodyRes.body ? Buffer.byteLength(bodyRes.body, bodyRes.base64Encoded ? 'base64' : 'utf8') : 0;
      } catch {
        bodyLen = s.encodedDataLength;
      }

      const transfer = s.encodedDataLength || bodyLen;
      const decoded = bodyLen || transfer;
      totalTransfer += transfer;
      totalDecoded += decoded;

      const parsedUrl = new URL(s.url);
      const chunkName = parsedUrl.pathname.split('/').pop() || s.url;
      scriptDetails.push({
        name: chunkName,
        transferKb: Number((transfer / 1024).toFixed(1)),
        decodedKb: Number((decoded / 1024).toFixed(1)),
      });
    }

    scriptDetails.sort((a, b) => b.transferKb - a.transferKb);

    const transferKb = Number((totalTransfer / 1024).toFixed(1));
    const decodedKb = Number((totalDecoded / 1024).toFixed(1));
    const flag300 = transferKb > 300;

    bundleStats[r.name] = {
      route: r.path,
      transferKb,
      decodedKb,
      scriptCount: scripts.size,
      flag300,
      top3: scriptDetails.slice(0, 3),
    };

    if (!flag300) {
      reportPass(`[Bundle] ${r.name} <= 300 KB transfer`, `${transferKb} KB transfer (decoded: ${decodedKb} KB, ${scripts.size} files)`);
    } else {
      reportFail(`[Bundle] ${r.name} <= 300 KB transfer`, `EXCEEDS 300 KB: ${transferKb} KB transfer (decoded: ${decodedKb} KB)`);
    }

    await ctx.close();
  }

  // Tulis laporan bundle ke docs/qa/fase7-bundle.md
  let bundleMd = `# Laporan Audit Bundle JS First-Load (Fase 7)\n\n`;
  bundleMd += `Pengukuran first-load script dari origin sendiri (Playwright CDP \`Network.setCacheDisabled\`) pada build produksi Next.js.\n\n`;
  bundleMd += `| Route | Transfer (KB gzip) | Decoded (KB) | Script Files | Status (> 300 KB) | 3 Chunk Terbesar |\n`;
  bundleMd += `|---|---|---|---|---|---|\n`;

  for (const [_name, data] of Object.entries(bundleStats)) {
    const top3Str = data.top3.map((c) => `\`${c.name}\` (${c.transferKb} KB)`).join('<br>');
    const statusStr = data.flag300 ? '**FAIL (> 300 KB)**' : 'PASS';
    bundleMd += `| ${data.route} | ${data.transferKb} | ${data.decodedKb} | ${data.scriptCount} | ${statusStr} | ${top3Str} |\n`;
  }

  bundleMd += `\n## Catatan\n`;
  bundleMd += `- Ambang batas target: transfer gzip <= 300 KB per route.\n`;
  bundleMd += `- Semua chunk diukur saat fresh load dengan browser cache dinonaktifkan.\n`;

  const bundleMdPath = join(process.cwd(), 'docs', 'qa', 'fase7-bundle.md');
  writeFileSync(bundleMdPath, bundleMd, 'utf8');
  console.log(`\n[Bundle Report] File disimpan di: ${bundleMdPath}`);

} finally {
  // Cleanup data tes (prefix E2E-F7)
  console.log('\n[Cleanup] Membersihkan data tes E2E-F7...');
  for (const qid of DUMMY_QUIZ_IDS) {
    await db.query("SELECT public.rpc_admin_update_quiz_status($1, 'finish')", [qid]).catch(() => {});
    await db.query('DELETE FROM public.answers WHERE player_id IN (SELECT id FROM public.players WHERE quiz_id = $1)', [qid]).catch(() => {});
    await db.query('DELETE FROM public.players WHERE quiz_id = $1', [qid]).catch(() => {});
    await db.query('DELETE FROM public.quiz_questions WHERE quiz_id = $1', [qid]).catch(() => {});
    await db.query('DELETE FROM public.quizzes WHERE id = $1', [qid]).catch(() => {});
  }
  await db.query("DELETE FROM public.exam_sessions WHERE name LIKE 'E2E-F7%'").catch(() => {});
  await db.query("DELETE FROM public.players WHERE name LIKE 'E2E-F7%'").catch(() => {});

  await browser.close();
  await db.end();

  console.log('\n' + '='.repeat(65));
  console.log(`TOTAL AUDIT SELESAI: PASS: ${passCount}, FAIL: ${failCount}`);
  console.log('='.repeat(65));
}
