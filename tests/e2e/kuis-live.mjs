// E2E Kuis Live: 1 admin + 5 siswa paralel (browser beneran) against LOCAL stack only.
// Usage: node tests/e2e/kuis-live.mjs [baseUrl] (default http://localhost:3100)
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
const dbClient = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'postgres', user: 'postgres', password: 'password' });
let dbLock = Promise.resolve();
const db = {
  connect: () => dbClient.connect(),
  end: () => dbClient.end(),
  query: (text, params) => {
    const run = () => dbClient.query(text, params);
    const p = dbLock.then(run, run);
    dbLock = p.then(() => {}, () => {});
    return p;
  },
};

const PREFIX = 'E2E-F7';
const SUBJECT = 'EKONOMI';
const CHAPTER = 'Mikroekonomi';
const TOPIC = 'Permintaan';
const FORBIDDEN = ['answer_key', 'explanation_html', 'secret_hash'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const pass = (name, detail = '') => console.log(`PASS ${name}${detail ? ` (${detail})` : ''}`);
const fail = (name, detail) => {
  fails++;
  console.log(`FAIL ${name} (${detail})`);
};
const check = (name, cond, failDetail, okDetail = '') => (cond ? pass(name, okDetail) : fail(name, failDetail));
async function waitUntil(fn, timeout, msg) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn().catch(() => undefined);
    if (last) return last;
    await sleep(300);
  }
  throw new Error(`timeout: ${msg}`);
}
const shot = (p, name) => p.screenshot({ path: join(SHOTS, `kuis-${name}.png`), fullPage: true }).catch(() => {});

const createdQuizIds = [];
const errors = []; // pageerror + hydration console
const leaks = [];
const dialogs = new Map(); // page -> messages

function watchPage(page, label) {
  dialogs.set(page, []);
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`));
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && /hydrat/i.test(m.text())) errors.push(`${label} console: ${m.text().slice(0, 200)}`);
  });
  page.on('dialog', (d) => {
    dialogs.get(page).push(d.message());
    d.accept().catch(() => {});
  });
}

async function newStudentContext(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } });
  await ctx.exposeBinding('__reportLeak', (_src, key, url) => leaks.push(`${label} SSE ${url} key=${key}`));
  await ctx.addInitScript((keys) => {
    const Orig = window.EventSource;
    window.EventSource = function (url, opts) {
      const es = new Orig(url, opts);
      es.addEventListener('state', (e) => {
        for (const k of keys) if (String(e.data).includes(k)) window.__reportLeak(k, String(url));
      });
      return es;
    };
    window.EventSource.prototype = Orig.prototype;
  }, FORBIDDEN);
  ctx.on('response', async (r) => {
    const url = r.url();
    if (url.includes('/_next/static/') || /event-stream/.test(r.headers()['content-type'] || '')) return;
    const body = await r.text().catch(() => '');
    for (const k of FORBIDDEN) if (body.includes(k)) leaks.push(`${label} ${r.request().method()} ${url} key=${k}`);
  });
  const page = await ctx.newPage();
  watchPage(page, label);
  return { ctx, page };
}

async function adminCreateQuiz(page, { count, duration, mode, midGame }) {
  await page.getByRole('button', { name: 'Buat Kuis Baru' }).first().click();
  const subj = page.locator('select').nth(0);
  await waitUntil(async () => (await subj.locator('option', { hasText: SUBJECT }).count()) > 0, 20000, 'kategori dimuat');
  await subj.selectOption({ label: SUBJECT });
  await page.locator('select').nth(1).selectOption({ label: CHAPTER });
  await page.locator('label').filter({ has: page.locator('span', { hasText: new RegExp(`^${TOPIC}$`) }) }).locator('input').check();
  await page.locator('input[type="number"]').nth(0).fill(String(count));
  await page.locator('input[type="number"]').nth(1).fill(String(duration));
  await page.getByText(mode === 'standard' ? 'Mode Standard' : 'Mode Strict', { exact: true }).click();
  const mid = page.locator('label', { hasText: 'Izinkan Gabung di Tengah Kuis' }).locator('input');
  if (midGame) await mid.check();
  else await mid.uncheck();
  await page.getByRole('button', { name: /Buat Sesi Kuis/ }).click();
}

async function readPanelCode(page, since) {
  const row = await waitUntil(
    async () => (await db.query('SELECT id, code, config FROM quizzes WHERE created_at > $1 ORDER BY created_at DESC LIMIT 1', [since])).rows[0],
    20000,
    'kuis baru di DB',
  );
  createdQuizIds.push(row.id);
  const codeEl = page.locator('span.font-mono.font-black').first();
  await waitUntil(async () => (await codeEl.textContent())?.trim() === row.code, 20000, 'panel admin menampilkan kode kuis baru');
  return row;
}

async function joinFromHome(st, code) {
  const p = st.page;
  await p.goto(`${BASE}/`);
  await p.getByPlaceholder('Contoh: 528093').fill(code);
  await p.getByPlaceholder('Contoh: Putu Dani').fill(st.name);
  await p.getByRole('button', { name: /Masuk ke Ruang Kuis/ }).click();
  await p.waitForURL(`**/kuis/${code}`, { timeout: 20000 });
  await p.getByText('Menunggu admin memulai kuis...').waitFor({ timeout: 20000 });
  st.playerId = await p.evaluate((c) => JSON.parse(localStorage.getItem(`quiz_player_${c}`)).playerId, code);
}

async function loadPlayer(st) {
  const r = (await db.query('SELECT question_order, skin, name FROM players WHERE id = $1', [st.playerId])).rows[0];
  st.order = r.question_order;
  st.skin = r.skin;
  st.dbName = r.name;
}

async function loadKeys(quizId) {
  const r = await db.query(
    `SELECT q.id, q.answer_key, q.options FROM quiz_questions qq JOIN questions q ON q.id = qq.question_id WHERE qq.quiz_id = $1`,
    [quizId],
  );
  return Object.fromEntries(r.rows.map((x) => [x.id, { key: x.answer_key.trim().toUpperCase(), labels: x.options.map((o, i) => o.label || String.fromCharCode(65 + i)) }]));
}

const optionBtn = (p, letter) => p.locator('button', { has: p.locator('span.w-7', { hasText: new RegExp(`^${letter}$`) }) });
const atIndex = (p, idx) => p.getByText(new RegExp(`^Soal ${idx + 1} dari \\d+$`)).waitFor({ timeout: 20000 });
const dbAnswer = async (st, qid) => (await db.query('SELECT user_answer, is_correct FROM answers WHERE player_id = $1 AND question_id = $2', [st.playerId, qid])).rows[0];

async function answer(st, keys, idx, correct) {
  const p = st.page;
  await atIndex(p, idx);
  const qid = st.order[idx];
  const { key, labels } = keys[qid];
  const letter = correct ? key : labels.find((l) => l !== key);
  await optionBtn(p, letter).waitFor({ timeout: 20000 });
  await optionBtn(p, letter).click();
  await waitUntil(async () => (await dbAnswer(st, qid))?.user_answer === letter, 15000, `${st.name} jawaban idx ${idx} tersimpan`);
  return letter;
}

async function finishByButton(p) {
  await p.getByRole('button', { name: 'Selesaikan Kuis' }).click();
  await p.getByText('Papan Peringkat (Leaderboard)').waitFor({ timeout: 20000 });
}

async function leaderboardRows(p) {
  return p.locator('table tbody tr').evaluateAll((trs) =>
    trs.map((tr) => {
      const td = tr.querySelectorAll('td');
      return { name: td[1].textContent.replace('(Kamu)', '').trim(), score: td[2].textContent.trim() };
    }),
  );
}

const dbOrder = async (quizId) =>
  (await db.query('SELECT name, score FROM players WHERE quiz_id = $1 ORDER BY score DESC, total_time ASC, joined_at ASC', [quizId])).rows;

async function cleanup() {
  if (createdQuizIds.length) await db.query('DELETE FROM quizzes WHERE id = ANY($1::uuid[])', [createdQuizIds]).catch(() => {});
  await db.query(`DELETE FROM players WHERE name LIKE '${PREFIX}%'`).catch(() => {});
}

await db.connect();
await cleanup();
const browser = await chromium.launch();
const t0 = new Date();

try {
  // ===== Admin login =====
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  watchPage(admin, 'admin');
  await admin.goto(`${BASE}/admin/login`);
  await admin.locator('input[name="email"]').fill(env.LOCAL_ADMIN_EMAIL);
  await admin.locator('input[name="password"]').fill(env.LOCAL_ADMIN_PASSWORD);
  await admin.locator('button[type="submit"]').click();
  await admin.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
  await admin.goto(`${BASE}/admin/kuis`);

  // ===== Skenario 1: buat kuis standard + KL-02 =====
  const avail = Number(
    (
      await db.query(
        `SELECT count(DISTINCT q.id) n FROM questions q JOIN question_topics qt ON qt.question_id = q.id JOIN topics t ON t.id = qt.topic_id
         JOIN chapters c ON c.id = t.chapter_id JOIN subjects s ON s.id = c.subject_id
         WHERE q.visibility='shown' AND q.archived_at IS NULL AND t.visibility='shown' AND c.visibility='shown' AND s.visibility='shown'
           AND t.name=$1 AND c.name=$2 AND s.name=$3`,
        [TOPIC, CHAPTER, SUBJECT],
      )
    ).rows[0].n,
  );
  assert.ok(avail >= 5, `pool ${TOPIC} cukup (${avail})`);
  await adminCreateQuiz(admin, { count: avail + 7, duration: 10, mode: 'standard', midGame: true });
  const guard = admin.getByText('Soal Tidak Mencukupi');
  await guard.waitFor({ timeout: 20000 });
  const guardText = await guard.locator('xpath=..').textContent();
  await shot(admin, '01-kl02-guard');
  const noQuizAfterGuard = (await db.query('SELECT count(*)::int n FROM quizzes WHERE created_at > $1', [t0])).rows[0].n === 0;
  check('S1 KL-02 jumlah > pool ditolak, pesan menyebut jumlah tersedia', guardText.includes(`Hanya tersedia ${avail} soal`) && noQuizAfterGuard, `pesan="${guardText}", kuis tidak dibuat=${noQuizAfterGuard}`, `"Hanya tersedia ${avail} soal"`);
  await admin.getByRole('button', { name: 'Mengerti' }).click();

  await admin.locator('input[type="number"]').nth(0).fill('5');
  await admin.getByRole('button', { name: /Buat Sesi Kuis/ }).click();
  const q1 = await readPanelCode(admin, t0);
  check('S1 KL-01/KL-03 kuis standard dibuat lewat form, kode 6 digit tampil', /^\d{6}$/.test(q1.code) && q1.config.quiz_mode === 'standard' && q1.config.question_count === 5 && q1.config.duration_minutes === 10 && q1.config.allow_join_mid_game === true, `config=${JSON.stringify(q1.config)}`, `kode ${q1.code}`);
  await shot(admin, '02-kuis-standard-dibuat');
  const keys1 = await loadKeys(q1.id);

  // ===== Skenario 2: 5 siswa gabung =====
  const S = [];
  const names = [`${PREFIX} Ayu`, `${PREFIX} BuDi MiXeD`, `${PREFIX} Citra`, `${PREFIX} Dewa`, `${PREFIX} Eka`];
  for (let i = 0; i < 5; i++) S.push({ name: names[i], ...(await newStudentContext(browser, `siswa${i}`)) });

  const v = S[0].page;
  await v.goto(`${BASE}/`);
  const codeIn = v.getByPlaceholder('Contoh: 528093');
  const nameIn = v.getByPlaceholder('Contoh: Putu Dani');
  const submit = v.getByRole('button', { name: /Masuk ke Ruang Kuis/ });
  const errBox = v.locator('div.text-danger span').first();
  await codeIn.fill('12ab34');
  const codeVal = await codeIn.inputValue();
  await nameIn.fill('Valid');
  await submit.click();
  await errBox.waitFor({ timeout: 10000 });
  check('S2 KL-10 kode non-angka ditolak', codeVal === '1234' && (await errBox.textContent()).includes('6 digit angka') && v.url().endsWith('/'), `value="${codeVal}" err="${await errBox.textContent()}"`, `"12ab34" jadi "${codeVal}", error tampil`);
  await codeIn.fill(q1.code);
  await nameIn.fill('');
  await submit.click();
  const nativeInvalid = await nameIn.evaluate((el) => !el.checkValidity());
  await nameIn.fill('    ');
  await submit.click();
  await v.getByText('Nama siswa tidak boleh kosong').waitFor({ timeout: 10000 });
  check('S2 KL-10 nama kosong/spasi ditolak', nativeInvalid && v.url().endsWith('/'), `nativeInvalid=${nativeInvalid} url=${v.url()}`, 'required native + pesan "Nama siswa tidak boleh kosong"');
  const longName = 'X'.repeat(30);
  await nameIn.fill(longName);
  const clamped = (await nameIn.inputValue()).length;
  await nameIn.evaluate((el) => el.removeAttribute('maxlength'));
  await nameIn.fill(longName);
  await submit.click();
  await v.getByText('Nama maksimal 24 karakter').waitFor({ timeout: 10000 });
  const dbLong = (await db.query('SELECT count(*)::int n FROM players WHERE quiz_id = $1', [q1.id])).rows[0].n;
  check('S2 KL-10 nama > 24 karakter ditolak', clamped <= 24 && dbLong === 0 && v.url().endsWith('/'), `clamped=${clamped} players=${dbLong}`, `maxlength potong ke ${clamped}, bypass maxlength -> pesan error`);
  await shot(v, '03-validasi-nama');

  for (const st of S) await joinFromHome(st, q1.code);
  for (const st of S) await loadPlayer(st);
  const shownName = await S[1].page.locator('h2').first().textContent();
  check('S2 KL-10 nama huruf besar-kecil tidak diubah', S[1].dbName === names[1] && shownName.trim() === names[1], `db="${S[1].dbName}" ui="${shownName}"`, `"${names[1]}"`);
  const mounts = S.map((st) => st.skin.split(':').pop());
  check('S2 RV-04 skin default 5 siswa berbeda', new Set(mounts).size === 5, `mount=${mounts.join(',')}`, mounts.join(','));
  await shot(S[0].page, '04-ruang-tunggu');

  const freeMount = ['dino', 'udang', 'ulat', 'kebo', 'sapi', 'llama', 'kalkun', 'angsa', 'citah', 'horse', 'mamot', 'macan'].find((m) => !mounts.includes(m));
  const freeName = { dino: 'Dino', udang: 'Udang', ulat: 'Ulat', kebo: 'Kebo', sapi: 'Sapi', llama: 'Llama', kalkun: 'Kalkun', angsa: 'Angsa', citah: 'Citah', horse: 'Kuda', mamot: 'Mamot', macan: 'Macan' }[freeMount];
  const p4 = S[4].page;
  await p4.locator('button[title="Ganti Hewan Tunggangan"]').click();
  await p4.getByText('Pilih Hewan Tunggangan').waitFor({ timeout: 10000 });
  await p4.locator('div.fixed button', { hasText: freeName }).first().click();
  await p4.locator('div.fixed button', { hasText: 'Forest' }).first().click();
  await shot(p4, '05-mount-picker');
  await p4.getByRole('button', { name: 'Terapkan' }).click();
  const newSkin = await waitUntil(async () => {
    const s = (await db.query('SELECT skin FROM players WHERE id = $1', [S[4].playerId])).rows[0].skin;
    return s === `forest:${freeMount}` ? s : undefined;
  }, 15000, 'skin baru tersimpan').catch(() => null);
  check('S2 RV-03 pilih tunggangan di ruang tunggu tersimpan', Boolean(newSkin), `skin DB tidak berubah ke forest:${freeMount}`, `forest:${freeMount}`);

  // ===== Skenario 3: panel admin + mulai =====
  await waitUntil(async () => (await admin.locator('table tbody tr').count()) === 5, 20000, 'admin melihat 5 pemain');
  const adminNames = await admin.locator('table tbody tr td:nth-child(2)').allTextContents();
  check('S3 KL-06 panel admin menampilkan 5 pemain', names.every((n) => adminNames.some((a) => a.includes(n))), `rows=${adminNames.join('|')}`, '5 baris');
  await shot(admin, '06-admin-5-pemain');
  await admin.getByRole('button', { name: 'Mulai Kuis' }).click();
  await Promise.all(S.map((st) => atIndex(st.page, 0)));
  pass('S3 KL-04 admin Mulai -> 5 siswa melihat soal 1');
  const sel = await S[0].page.evaluate(() => {
    const el = document.querySelector('.prose');
    const anc = el.closest('.select-none');
    return { anc: anc ? getComputedStyle(anc).userSelect : 'none-found', box: JSON.stringify(el.getBoundingClientRect()) };
  });
  const box = JSON.parse(sel.box);
  const sp = S[0].page;
  await sp.mouse.move(box.left + 2, box.top + 4);
  await sp.mouse.down();
  await sp.mouse.move(box.right - 2, box.bottom - 2, { steps: 8 });
  await sp.mouse.up();
  await sp.mouse.click(box.left + 10, box.top + 6, { clickCount: 3 });
  const selected = await sp.evaluate(() => window.getSelection().toString());
  check('S3 KL-16 teks soal tidak bisa diblok', sel.anc === 'none' && selected.trim() === '', `userSelect=${sel.anc} selection="${selected.slice(0, 40)}"`, 'computed user-select none, drag+triple-click seleksi kosong');
  await shot(sp, '07-soal-1');

  // ===== Skenario 4a: semua jawab soal 1 =====
  const pattern = [
    [1, 1, 1, 1, 1],
    [1, 1, 0, 1, 1],
    [1, 1, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 1],
  ];
  await Promise.all(S.map((st, i) => answer(st, keys1, 0, pattern[i][0])));

  // ===== Skenario 5: jeda / lanjut =====
  const before = (await db.query('SELECT expires_at FROM quizzes WHERE id = $1', [q1.id])).rows[0].expires_at;
  await admin.getByRole('button', { name: 'Jeda Kuis' }).click();
  const pausedAt = await waitUntil(async () => {
    const r = (await db.query('SELECT status, paused_at FROM quizzes WHERE id = $1', [q1.id])).rows[0];
    return r.status === 'paused' ? r.paused_at : undefined;
  }, 15000, 'status paused');
  await Promise.all(S.map((st) => st.page.getByText('Kuis Sedang Dijeda').waitFor({ timeout: 20000 })));
  let blocked = false;
  await optionBtn(S[2].page, keys1[S[2].order[0]].labels.find((l) => l !== keys1[S[2].order[0]].key))
    .click({ trial: true, timeout: 2000 })
    .catch(() => (blocked = true));
  check('S5 KL-04 jeda: siswa melihat status jeda dan opsi tidak bisa diklik', blocked, 'opsi masih bisa diklik saat jeda', 'overlay "Kuis Sedang Dijeda" di 5 siswa');
  await shot(S[2].page, '08-jeda');
  await sleep(6000); // lama jeda yang diukur
  await admin.getByRole('button', { name: 'Lanjutkan Kuis' }).click();
  const after = await waitUntil(async () => {
    const r = (await db.query('SELECT status, expires_at, updated_at FROM quizzes WHERE id = $1', [q1.id])).rows[0];
    return r.status === 'active' ? r : undefined;
  }, 15000, 'status active lagi');
  const shift = (after.expires_at - before) / 1000;
  const pauseLen = (after.updated_at - pausedAt) / 1000;
  check('S5 KL-04 lanjut: expires_at bergeser sebesar lama jeda', shift >= 5 && Math.abs(shift - pauseLen) < 1.5, `shift=${shift}s pause=${pauseLen}s`, `geser ${shift.toFixed(1)}s, jeda ${pauseLen.toFixed(1)}s`);
  await Promise.all(S.map((st) => st.page.getByText('Kuis Sedang Dijeda').waitFor({ state: 'hidden', timeout: 20000 })));

  // ===== Skenario 6: refresh siswa =====
  await S[3].page.reload();
  await atIndex(S[3].page, 0);
  const joinFormGone = (await S[3].page.getByText('Gabung Sesi Kuis Live').count()) === 0;
  check('S6 KL-17 refresh di tengah kuis pulih ke kuis yang sama', joinFormGone && S[3].page.url().endsWith(`/kuis/${q1.code}`), `url=${S[3].page.url()}`, 'runtime tampil lagi');
  await shot(S[3].page, '09-refresh-pulih');

  // ===== Skenario 4b: sisa jawaban, S1 lompat + ubah jawaban =====
  const next = (p) => p.getByRole('button', { name: 'Selanjutnya' }).click();
  const jump = (p, n) => p.locator('button.w-9', { hasText: new RegExp(`^${n}$`) }).click();
  const seq = async (st, i) => {
    for (let idx = 1; idx < 5; idx++) {
      await next(st.page);
      await answer(st, keys1, idx, pattern[i][idx]);
    }
  };
  const s1Flow = async () => {
    const st = S[1];
    await jump(st.page, 4);
    await answer(st, keys1, 3, 1);
    await jump(st.page, 2);
    await answer(st, keys1, 1, 0);
    const wrongScore = (await db.query('SELECT score FROM players WHERE id = $1', [st.playerId])).rows[0].score;
    await answer(st, keys1, 1, 1);
    const changed = await dbAnswer(st, st.order[1]);
    const score = (await db.query('SELECT score FROM players WHERE id = $1', [st.playerId])).rows[0].score;
    check('S4 KL-13 mode standard: lompat soal + ubah jawaban tersimpan di server', changed.is_correct && score === wrongScore + 1, `is_correct=${changed.is_correct} score ${wrongScore}->${score}`, `lompat 1->4->2, ubah salah->benar, skor ${wrongScore}->${score}`);
    await jump(st.page, 3);
    await answer(st, keys1, 2, 0);
    await jump(st.page, 5);
    await answer(st, keys1, 4, 1);
  };
  await Promise.all([seq(S[0], 0), s1Flow(), seq(S[2], 2), seq(S[3], 3), seq(S[4], 4)]);
  const dbScores = (await db.query('SELECT name, score FROM players WHERE quiz_id = $1', [q1.id])).rows;
  const expected = Object.fromEntries(S.map((st, i) => [st.name, pattern[i].reduce((a, b) => a + b, 0)]));
  check('S4 KL-13 skor server sesuai pola benar/salah', dbScores.every((r) => r.score === expected[r.name]), `db=${JSON.stringify(dbScores)} exp=${JSON.stringify(expected)}`, Object.values(expected).join('/'));

  // ===== Skenario 7: leaderboard '?' + selesai =====
  for (const i of [0, 1, 2]) await finishByButton(S[i].page);
  const lb0 = await waitUntil(async () => {
    const rows = await leaderboardRows(S[0].page);
    return rows.length === 5 && rows.filter((r) => r.score !== '?').length === 3 ? rows : undefined;
  }, 20000, 'leaderboard S0 3 skor tampil').catch(async () => leaderboardRows(S[0].page));
  const unfinished = [names[3], names[4]];
  check('S7 KL-15 mode standard: skor pemain belum selesai tampil ?', lb0.filter((r) => unfinished.includes(r.name)).every((r) => r.score === '?') && lb0.filter((r) => !unfinished.includes(r.name)).every((r) => r.score !== '?'), `rows=${JSON.stringify(lb0)}`, 'Dewa/Eka "?", 3 lainnya angka');
  await shot(S[0].page, '10-leaderboard-tanda-tanya');
  await admin.getByRole('button', { name: 'Akhiri Kuis' }).click();
  await Promise.all(S.map((st) => st.page.getByText('Papan Peringkat (Leaderboard)').waitFor({ timeout: 20000 })));
  pass('S7 KL-14 admin Akhiri kuis -> semua siswa masuk leaderboard');
  const order1 = await dbOrder(q1.id);
  const allMatch = await Promise.all(
    S.map((st) =>
      waitUntil(async () => {
        const rows = await leaderboardRows(st.page);
        return JSON.stringify(rows.map((r) => [r.name, Number(r.score)])) === JSON.stringify(order1.map((r) => [r.name, r.score])) ? true : undefined;
      }, 15000, 'urutan').catch(() => false),
    ),
  );
  check('S7 KL-15 urutan leaderboard = DB (skor desc, waktu asc, joined asc) di 5 siswa', allMatch.every(Boolean), `match=${allMatch} db=${JSON.stringify(order1)}`, order1.map((r) => `${r.name.replace(PREFIX + ' ', '')}:${r.score}`).join(' > '));
  await shot(S[4].page, '11-leaderboard-final');

  // ===== Skenario 8 + 9: kuis STRICT =====
  const t1 = new Date();
  await adminCreateQuiz(admin, { count: 5, duration: 10, mode: 'strict', midGame: false });
  const q2 = await readPanelCode(admin, t1);
  check('S8 KL-01 kuis strict dibuat lewat form', q2.config.quiz_mode === 'strict' && /^\d{6}$/.test(q2.code), `config=${JSON.stringify(q2.config)}`, `kode ${q2.code}`);
  const keys2 = await loadKeys(q2.id);
  const T = [];
  const tnames = [`${PREFIX} Gede`, `${PREFIX} Komang`, `${PREFIX} Luh`, `${PREFIX} Made`, `${PREFIX} Nyoman`];
  for (let i = 0; i < 5; i++) T.push({ name: tnames[i], ...(await newStudentContext(browser, `strict${i}`)) });
  await Promise.all(T.map((st) => joinFromHome(st, q2.code)));
  for (const st of T) await loadPlayer(st);
  await waitUntil(async () => (await admin.locator('table tbody tr').count()) === 5, 20000, 'admin 5 pemain strict');
  await admin.getByRole('button', { name: 'Mulai Kuis' }).click();
  await Promise.all(T.map((st) => atIndex(st.page, 0)));
  const tp = T[0].page;
  const noBack = (await tp.getByRole('button', { name: 'Sebelumnya' }).count()) === 0 && (await tp.getByText('Daftar Nomor Soal').count()) === 0;
  const nextDisabled = await tp.getByRole('button', { name: 'Selanjutnya' }).isDisabled();
  check('S8 KL-12 strict: tidak ada tombol balik/palet lompat, lanjut terkunci sebelum menjawab', noBack && nextDisabled, `noBack=${noBack} nextDisabled=${nextDisabled}`);
  await shot(tp, '12-strict-soal-1');

  const strictSeq = async (st, from) => {
    for (let idx = from; idx < 5; idx++) {
      if (idx > from) await st.page.getByRole('button', { name: 'Selanjutnya' }).click();
      await answer(st, keys2, idx, idx % 2 === 0);
    }
  };
  const changeAttempt = async () => {
    const st = T[1];
    const first = await answer(st, keys2, 0, 1);
    const other = keys2[st.order[0]].labels.find((l) => l !== first);
    const resp = st.page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes(`/kuis/${q2.code}`), { timeout: 15000 });
    await optionBtn(st.page, other).click();
    await resp;
    await sleep(500);
    const dbA = await dbAnswer(st, st.order[0]);
    check('S8 KL-13 strict: jawaban tidak bisa diubah (server)', dbA.user_answer === first, `DB berubah ke ${dbA.user_answer}`, `tetap ${first}`);
    const uiSel = await optionBtn(st.page, other).evaluate((b) => b.className.includes('ring-primary/30'));
    check('S8 KL-13 strict: UI tidak menampilkan jawaban baru yang ditolak server', !uiSel, `BUG: klik opsi ${other} setelah jawab ${first} membuat UI menandai ${other} terpilih padahal server menolak ("Soal sudah dijawab"); StudentQuizRuntime.handleSelectOption mengabaikan res.success; severity medium`);
    await shot(st.page, '13-strict-ubah-jawaban');
    await st.page.getByRole('button', { name: 'Selanjutnya' }).click();
    await strictSeq(st, 1);
  };
  const refreshStrict = async () => {
    const st = T[2];
    await answer(st, keys2, 0, 1);
    await st.page.getByRole('button', { name: 'Selanjutnya' }).click();
    await answer(st, keys2, 1, 1);
    await st.page.reload();
    await st.page.getByText(/^Soal \d dari 5$/).waitFor({ timeout: 20000 });
    const label = await st.page.getByText(/^Soal \d dari 5$/).textContent();
    const srvIdx = (await db.query('SELECT current_index FROM players WHERE id = $1', [st.playerId])).rows[0].current_index;
    check('S6 KL-17 strict: refresh pulih ke kuis yang sama', (await st.page.getByText('Gabung Sesi Kuis Live').count()) === 0, 'keluar ke form gabung');
    check('S8 KL-12/KL-17 strict: setelah refresh lanjut di soal server, bukan kembali ke soal 1', label === `Soal ${srvIdx + 1} dari 5`, `BUG: server current_index=${srvIdx} (soal ${srvIdx + 1}) tapi UI menampilkan "${label}"; siswa bisa melihat ulang soal yang sudah dijawab di mode strict dan klik jawabannya gagal diam-diam; StudentQuizRuntime currentIndex selalu mulai 0; severity medium`);
    await shot(st.page, '14-strict-refresh');
    for (let idx = Number(label.match(/\d/)[0]) - 1; idx < srvIdx; idx++) {
      const k = keys2[st.order[idx]];
      await optionBtn(st.page, k.key).click();
      await st.page.getByRole('button', { name: 'Selanjutnya' }).click();
    }
    await strictSeq(st, srvIdx);
  };
  const violation = async () => {
    const st = T[3];
    await answer(st, keys2, 0, 1);
    for (let n = 0; n < 3; n++) {
      await st.page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
    await st.page.getByText('Diskualifikasi Anti-Curang').waitFor({ timeout: 5000 });
    await shot(st.page, '15-anti-curang-modal');
    const warns = dialogs.get(st.page).filter((m) => m.includes('Peringatan Anti-Curang'));
    await st.page.getByText('Papan Peringkat (Leaderboard)').waitFor({ timeout: 20000 });
    const fin = (await db.query('SELECT finished_at FROM players WHERE id = $1', [st.playerId])).rows[0].finished_at;
    check('S9 KL-16 pindah tab 3x -> 2 peringatan, modal, otomatis selesai', warns.length === 2 && fin !== null, `warns=${warns.length} finished_at=${fin}`, '2 alert + modal Diskualifikasi + finished_at terisi');
  };
  await Promise.all([strictSeq(T[0], 0), changeAttempt(), refreshStrict(), violation(), strictSeq(T[4], 0)]);
  const ci = (await db.query('SELECT name, current_index FROM players WHERE quiz_id = $1 AND name <> $2', [q2.id, tnames[3]])).rows;
  check('S8 KL-13 strict: urutan dijaga server (current_index = 5 untuk yang menyelesaikan)', ci.every((r) => r.current_index === 5), JSON.stringify(ci));
  for (const i of [0, 1, 2]) await finishByButton(T[i].page);
  await admin.getByRole('button', { name: 'Akhiri Kuis' }).click();
  await Promise.all(T.map((st) => st.page.getByText('Papan Peringkat (Leaderboard)').waitFor({ timeout: 20000 })));
  const order2 = await dbOrder(q2.id);
  const lb2 = await waitUntil(async () => {
    const rows = await leaderboardRows(T[4].page);
    return JSON.stringify(rows.map((r) => [r.name, Number(r.score)])) === JSON.stringify(order2.map((r) => [r.name, r.score])) ? rows : undefined;
  }, 15000, 'urutan strict').catch(() => null);
  check('S8 KL-15 strict: leaderboard akhir = DB', Boolean(lb2), `db=${JSON.stringify(order2)}`);
  await shot(T[4].page, '16-strict-leaderboard');

  // ===== Skenario 11: riwayat admin =====
  await admin.goto(`${BASE}/admin/kuis`);
  await admin.getByRole('button', { name: 'Riwayat Kuis' }).click();
  const card = admin.locator('div.rounded-3xl', { has: admin.locator('span', { hasText: new RegExp(`^${q1.code}$`) }) }).filter({ has: admin.getByRole('button', { name: /Buka Rekap/ }) }).last();
  await card.waitFor({ timeout: 15000 });
  pass('S11 KL-07 kuis selesai muncul di riwayat', q1.code);
  await card.getByRole('button', { name: /Buka Rekap/ }).click();
  const modal = admin.locator('div.fixed', { hasText: 'Detail Rekap Kuis' });
  await waitUntil(async () => (await modal.locator('table tbody tr').count()) === 5, 20000, 'rekap 5 pemain');
  const ctrl = await modal.getByRole('button', { name: /Mulai Kuis|Jeda Kuis|Akhiri Kuis|Lanjutkan Kuis/ }).count();
  const cancel = await modal.locator('button[title="Batalkan Kuis"]').count();
  check('S11 KL-07 rekap leaderboard read-only terbuka', ctrl === 0 && cancel === 0, `tombol kontrol=${ctrl} batal=${cancel}`, '5 baris, tanpa tombol kontrol');
  await shot(admin, '17-riwayat-rekap');
  await modal.locator('tr', { hasText: names[1] }).locator('button[title="Lihat Jawaban"]').click();
  const ans = admin.locator('div.fixed', { hasText: 'Jawaban Siswa:' }).last();
  await ans.getByText('Soal #1').waitFor({ timeout: 15000 });
  const nAns = await ans.getByText(/^Soal #\d+$/).count();
  const inputs = await ans.locator('input, textarea, select').count();
  check('S11 KL-07 jawaban per pemain read-only bisa dibuka', nAns === 5 && inputs === 0, `soal=${nAns} input=${inputs}`, `${nAns} jawaban + kunci, 0 input`);
  await shot(admin, '18-riwayat-jawaban');

  // ===== Skenario 10 + 12 =====
  check('S10 KL-12 network siswa tanpa answer_key/explanation_html/secret_hash', leaks.length === 0, `BUG: ${leaks.slice(0, 5).join('; ')}`, 'semua response + event SSE 10 context siswa');
  check('S12 0 pageerror + 0 console hydration di semua context', errors.length === 0, errors.slice(0, 5).join(' | '), '11 context');
} catch (err) {
  fail('E2E kuis-live crash', err?.stack?.split('\n').slice(0, 3).join(' ') || String(err));
} finally {
  await browser.close().catch(() => {});
  await cleanup();
  const left = (await db.query(`SELECT count(*)::int n FROM players WHERE name LIKE '${PREFIX}%'`)).rows[0].n;
  console.log(`cleanup: ${createdQuizIds.length} kuis dihapus, sisa pemain ${PREFIX}=${left}`);
  await db.end();
  console.log(`SELESAI: ${fails} FAIL. Screenshot: ${join(SHOTS, 'kuis-*.png')}`);
  process.exit(fails ? 1 : 0);
}
