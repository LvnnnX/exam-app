// E2E race view against the LOCAL stack only (Postgres 127.0.0.1:54329 + `next dev`).
// Usage: node tests/e2e/race-view.mjs [baseUrl]   (default http://localhost:3100)
// Seeds 2 quizzes (5 players standard, 40 players strict), drives scores through the real RPCs,
// asserts payload masking, rank order, one finish event per player, 40-lane render, and saves
// screenshots to %LOCALAPPDATA%/Temp/race-view-*.png. Quizzes are cancelled at the end.
import { chromium } from '@playwright/test';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const BASE = process.argv[2] || 'http://localhost:3100';
assert.ok(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE), 'local base URL only');
const SHOTS = join(process.env.LOCALAPPDATA || '.', 'Temp');
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const db = new pg.Client({ host: '127.0.0.1', port: 54329, database: 'postgres', user: 'postgres', password: 'password' });
const q1 = async (sql, args = []) => (await db.query(sql, args)).rows[0].r;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, detail = '') => { results.push(`PASS ${name}${detail ? ` (${detail})` : ''}`); };

async function seed(mode, count, names) {
  const quiz = await q1("SELECT public.rpc_create_quiz(ARRAY[]::uuid[], $1, 15, $2, true, '{}'::jsonb) AS r", [count, mode]);
  assert.equal(quiz.success, true, JSON.stringify(quiz));
  const players = [];
  for (const name of names) {
    const j = await q1('SELECT public.rpc_join_live_quiz($1, $2) AS r', [quiz.code, name]);
    assert.equal(j.success, true, JSON.stringify(j));
    players.push({ id: j.player_id, name, skin: j.skin, idx: 0 });
    await sleep(5); // distinct joined_at
  }
  assert.equal((await q1("SELECT public.rpc_admin_update_quiz_status($1, 'start') AS r", [quiz.quiz_id])).success, true);
  return { ...quiz, players };
}

async function answer(p, correct) {
  const q = await q1('SELECT public.rpc_get_quiz_question($1, $2) AS r', [p.id, p.idx]);
  assert.equal(q.success, true, JSON.stringify(q));
  const key = (await db.query('SELECT answer_key FROM public.questions WHERE id = $1', [q.data.id])).rows[0].answer_key;
  const r = await q1('SELECT public.rpc_submit_quiz_answer($1, $2, $3, $4, $5) AS r', [p.id, p.idx, q.data.id, correct ? key : 'SALAH_X', 4]);
  assert.equal(r.success, true, JSON.stringify(r));
  p.idx += 1;
}

async function openAsStudent(page, quiz, p) {
  await page.goto(`${BASE}/`);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`quiz_player_${quiz.code}`,
    JSON.stringify({ playerId: p.id, quizId: quiz.quiz_id, name: p.name, skin: p.skin })]);
  await page.goto(`${BASE}/kuis/${quiz.code}`);
  await page.getByRole('button', { name: 'Lihat balapan' }).first().click();
  await page.getByRole('dialog').waitFor();
}

await db.connect();
const browser = await chromium.launch();
const created = [];
try {
  // ---------- 5 players, standard mode ----------
  const names5 = ['Budi Santoso', 'Siti Rahma', 'Ketut Sujana', 'Dewi Lestari', 'Agus Pratama'];
  // 6th player 'Penonton' never answers: the viewing student stays in the runtime view.
  // (A student who finishes is switched to the leaderboard page, which closes the modal.)
  const s5 = await seed('standard', 5, [...names5, 'Penonton']);
  created.push(s5.quiz_id);
  ok('RV-04 6 pemain dapat hewan unik', s5.players.map((p) => p.skin).join(' '));
  assert.equal(new Set(s5.players.map((p) => p.skin.split(':')[1])).size, 6);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__finishes = [];
    window.addEventListener('race:finish', (e) => window.__finishes.push(e.detail));
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await openAsStudent(page, s5, s5.players[5]);

  // round 1..5: everyone answers one question; Budi always correct ... Agus only first
  const correctUntil = [5, 4, 3, 2, 1];
  for (let round = 0; round < 5; round++) {
    for (let i = 0; i < 5; i++) await answer(s5.players[i], round < correctUntil[i]);
    if (round === 2) {
      // mid-race payload check (public viewer)
      const st = await (await fetch(`${BASE}/api/quiz/${s5.code}/state`)).json();
      const ps = st.state.players;
      assert.ok(ps.every((p) => p.score === 0 && p.score_hidden === true), 'public payload masks unfinished scores');
      const raw = JSON.stringify(st);
      assert.ok(s5.players.every((p) => !raw.includes(p.id)), 'public payload has no real player_id');
      assert.deepEqual(ps.map((p) => p.name), [...names5, 'Penonton'], 'payload ordered by joined_at, not score');
      ok('Security: payload publik mode standard skor=0 + score_hidden, urut joined_at, tanpa player_id asli', `answers_count=${ps.map((p) => p.answers_count).join(',')}`);
      await sleep(2500);
      const labels = await page.locator('[role=dialog] li').allInnerTexts();
      assert.ok(labels.slice(0, 5).every((t) => t.includes('Skor ?')), 'UI shows ? for hidden');
      ok('UI mode standard tampil "Skor ?" untuk yang belum selesai');
      await page.screenshot({ path: join(SHOTS, 'race-view-standard-hidden.png') });
    }
  }
  // finish players one by one, confetti event must fire once each
  for (const p of s5.players.slice(0, 5)) {
    assert.equal((await q1('SELECT public.rpc_finish_quiz_player($1) AS r', [p.id])).success, true);
    await sleep(2200);
  }
  await sleep(1500);
  const finishes = await page.evaluate(() => window.__finishes);
  assert.equal(finishes.length, 5, `finish events: ${finishes.length}`);
  assert.equal(new Set(finishes).size, 5);
  ok('Confetti/finish event sekali per pemain', `${finishes.length} event, ${new Set(finishes).size} unik`);

  await page.locator('summary', { hasText: 'Daftar peringkat' }).click();
  const order = await page.locator('[role=dialog] ol li').allInnerTexts();
  const rankNames = order.slice(0, 5).map((t) => names5.find((n) => t.includes(n)));
  assert.deepEqual(rankNames, names5, `rank order ${rankNames.join(',')}`);
  ok('Urutan peringkat akhir benar', rankNames.join(' > '));
  const laneNames = (await page.locator('[role=dialog] ul > li').allInnerTexts()).slice(0, 5).map((t) => names5.find((n) => t.includes(n)));
  assert.deepEqual(laneNames, names5);
  ok('Lajur tetap urut joined_at');
  await page.screenshot({ path: join(SHOTS, 'race-view-standard-finished.png') });
  // replay: same state for another 4s must not refire
  await sleep(4000);
  assert.equal((await page.evaluate(() => window.__finishes)).length, 5);
  ok('Tidak ada confetti ulang setelah tick berikutnya');
  assert.deepEqual(errors, [], errors.join('\n'));

  // keyboard: Escape closes, focus back to opener
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  ok('Escape menutup modal');

  // mobile 360 screenshot
  const m = await browser.newContext({ viewport: { width: 360, height: 780 }, reducedMotion: 'reduce' });
  const mp = await m.newPage();
  await openAsStudent(mp, s5, s5.players[0]);
  await sleep(1500);
  await mp.screenshot({ path: join(SHOTS, 'race-view-mobile-360-reduced-motion.png') });
  ok('Render 360px + reduced motion');
  await m.close();

  // ---------- 40 players, strict ----------
  const names40 = Array.from({ length: 40 }, (_, i) => `Siswa ${String(i + 1).padStart(2, '0')}`);
  const s40 = await seed('strict', 10, names40);
  created.push(s40.quiz_id);
  for (const [i, p] of s40.players.entries()) for (let k = 0; k < i % 6; k++) await answer(p, k % 3 !== 2);
  const p40 = await ctx.newPage();
  const err40 = [];
  p40.on('pageerror', (e) => err40.push(String(e)));
  await p40.goto(`${BASE}/`);
  await p40.evaluate(([k, v]) => localStorage.setItem(k, v), [`quiz_player_${s40.code}`,
    JSON.stringify({ playerId: s40.players[0].id, quizId: s40.quiz_id, name: s40.players[0].name, skin: s40.players[0].skin })]);
  await p40.goto(`${BASE}/kuis/${s40.code}`);
  const btn = p40.getByRole('button', { name: 'Lihat balapan' }).first();
  await btn.waitFor();
  await sleep(2000);
  const t0 = Date.now();
  await btn.click();
  await p40.waitForFunction(() => document.querySelectorAll('[role=dialog] ul > li').length === 40);
  const openMs = Date.now() - t0;
  ok('40 lajur render tanpa error', `buka modal sampai 40 lajur: ${openMs}ms`);

  // per-tick cost: count lanes whose subtree mutates when ONE player scores
  await sleep(2500);
  const rankTexts = () => p40.evaluate(() => [...document.querySelectorAll('[role=dialog] ul > li')].map((li) => li.querySelector('span')?.textContent));
  const ranksBefore = await rankTexts();
  await p40.evaluate(() => {
    window.__touched = new Set();
    const lis = [...document.querySelectorAll('[role=dialog] ul > li')];
    window.__mo = new MutationObserver((ms) => {
      for (const m of ms) {
        const li = lis.find((l) => l.contains(m.target));
        if (li) window.__touched.add(lis.indexOf(li));
      }
    });
    window.__mo.observe(document.querySelector('[role=dialog] ul'), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
  });
  await answer(s40.players[7], true);
  await sleep(3500);
  const touched = await p40.evaluate(() => { window.__mo.disconnect(); return [...window.__touched]; });
  const ranksAfter = await rankTexts();
  const rankMoved = ranksAfter.map((r, i) => (r !== ranksBefore[i] ? i : -1)).filter((i) => i >= 0);
  const extra = touched.filter((i) => i !== 7 && !rankMoved.includes(i));
  assert.deepEqual(extra, [], `lanes mutated without a reason: ${extra.join(',')}`);
  ok('Satu skor naik: DOM berubah hanya di lajur itu + lajur yang rank-nya bergeser',
    `${touched.length}/40 lajur berubah, ${rankMoved.length} karena rank bergeser, 0 tanpa alasan`);

  // leader extends lead: no rank shifts anywhere, so exactly one lane may change
  await p40.evaluate(() => {
    window.__touched = new Set();
    const lis = [...document.querySelectorAll('[role=dialog] ul > li')];
    window.__mo = new MutationObserver((ms) => { for (const m of ms) { const li = lis.find((l) => l.contains(m.target)); if (li) window.__touched.add(lis.indexOf(li)); } });
    window.__mo.observe(document.querySelector('[role=dialog] ul'), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
  });
  await answer(s40.players[5], true);
  await sleep(3500);
  const touched2 = await p40.evaluate(() => { window.__mo.disconnect(); return [...window.__touched]; });
  assert.deepEqual(touched2, [5], `leader tick touched ${touched2.join(',')}`);
  ok('Pemimpin nambah skor: cuma 1 dari 40 lajur yang berubah di DOM');

  const longTask = await p40.evaluate(async () => {
    const ts = [];
    const start = performance.now();
    await new Promise((res) => {
      const f = (t) => { ts.push(t); if (t - start < 3000) requestAnimationFrame(f); else res(); };
      requestAnimationFrame(f);
    });
    const gaps = ts.slice(1).map((t, i) => t - ts[i]);
    return { frames: ts.length, worstGapMs: Math.round(Math.max(...gaps)) };
  });
  ok('Frame 3 detik dengan 40 lajur live', `${longTask.frames} frame, gap terburuk ${longTask.worstGapMs}ms`);
  await p40.screenshot({ path: join(SHOTS, 'race-view-40-players.png'), fullPage: false });
  assert.deepEqual(err40, [], err40.join('\n'));

  // ---------- admin ----------
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ap = await actx.newPage();
  await ap.goto(`${BASE}/admin/login`);
  await ap.locator('input[type=email]').fill(env.LOCAL_ADMIN_EMAIL);
  await ap.locator('input[type=password]').fill(env.LOCAL_ADMIN_PASSWORD);
  await ap.locator('button[type=submit]').click();
  await ap.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 });
  const adminState = await ap.evaluate(async (code) => (await fetch(`/api/quiz/${code}/state`)).json(), s40.code);
  assert.ok(adminState.state.players.some((p) => p.score > 0), 'admin sees raw scores');
  ok('Admin aktif dapat skor asli dari route state');
  await ap.goto(`${BASE}/admin/kuis`);
  await ap.locator('select').first().selectOption(s40.code).catch(() => {});
  await ap.getByRole('button', { name: 'Lihat balapan' }).first().click();
  await ap.getByRole('dialog').waitFor();
  await sleep(2000);
  await ap.screenshot({ path: join(SHOTS, 'race-view-admin.png') });
  ok('Admin buka race view dari panel sesi live');
} finally {
  for (const id of created) await db.query("SELECT public.rpc_admin_update_quiz_status($1, 'finish')", [id]).catch(() => {});
  await browser.close();
  await db.end();
  console.log(results.join('\n'));
}
