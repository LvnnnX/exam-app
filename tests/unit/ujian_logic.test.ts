import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  presetOptions,
  clampPreset,
  canStartExam,
  validateStart,
  scorePercent,
  isPassed,
  scoreTone,
  applySurvivalAnswer,
  secondsLeft,
  formatClock,
} from '../../src/features/ujian/logic.ts';
import { encryptPayload, decryptPayload, secureSave, secureLoad } from '../../src/lib/secure-storage.ts';

const base = { name: 'Budi', mode: 'exam' as const, nav_mode: 'standard' as const, topic_ids: ['t1'], question_count: 10, time_limit_minutes: 30 };

describe('preset filter (keputusan 2)', () => {
  it('hanya preset <= soal tersedia yang aktif, sisanya "soal kurang"', () => {
    const opts = presetOptions(27);
    assert.deepEqual(opts.filter((o) => o.enabled).map((o) => o.value), [5, 10, 20, 25]);
    assert.ok(opts.filter((o) => !o.enabled).every((o) => o.note === 'soal kurang'));
    assert.equal(opts.length, 8);
  });
  it('soal < 5: semua disabled, tidak bisa mulai', () => {
    assert.equal(presetOptions(4).some((o) => o.enabled), false);
    assert.equal(canStartExam(4), false);
    assert.equal(clampPreset(10, 4), null);
    assert.equal(canStartExam(5), true);
  });
  it('100 soal: semua aktif', () => {
    assert.equal(presetOptions(100).every((o) => o.enabled), true);
  });
  it('clamp turun ke preset terbesar yang masih muat', () => {
    assert.equal(clampPreset(50, 27), 25);
    assert.equal(clampPreset(10, 27), 10);
    assert.equal(clampPreset(null, 27), 5);
  });
});

describe('validasi setup', () => {
  it('input valid lolos', () => assert.equal(validateStart(base, 27), null));
  it('nama kosong / > 16 ditolak', () => {
    assert.match(validateStart({ ...base, name: '   ' })!, /wajib/);
    assert.match(validateStart({ ...base, name: 'x'.repeat(17) })!, /16/);
    assert.equal(validateStart({ ...base, name: 'x'.repeat(16) }), null);
  });
  it('jumlah soal custom / melebihi tersedia ditolak', () => {
    assert.ok(validateStart({ ...base, question_count: 7 }));
    assert.ok(validateStart({ ...base, question_count: 30 }, 27));
    assert.ok(validateStart({ ...base, question_count: null }));
  });
  it('survival tidak butuh jumlah soal', () => {
    assert.equal(validateStart({ ...base, mode: 'survival', question_count: null }), null);
  });
  it('waktu di luar daftar & topik kosong ditolak', () => {
    assert.ok(validateStart({ ...base, time_limit_minutes: 7 }));
    assert.ok(validateStart({ ...base, topic_ids: [] }));
  });
});

describe('scoring exam', () => {
  it('persen dibulatkan, total 0 aman', () => {
    assert.equal(scorePercent(7, 10), 70);
    assert.equal(scorePercent(2, 3), 67);
    assert.equal(scorePercent(0, 0), 0);
  });
  it('lulus >= 70', () => {
    assert.equal(isPassed(70), true);
    assert.equal(isPassed(69), false);
  });
  it('tone UM-30', () => {
    assert.deepEqual([80, 79, 60, 59, 40, 39].map(scoreTone), ['green', 'blue', 'blue', 'orange', 'orange', 'red']);
  });
});

describe('nyawa survival', () => {
  it('benar tidak mengurangi, salah -1, habis = game over', () => {
    assert.deepEqual(applySurvivalAnswer(3, true), { lives: 3, gameOver: false });
    let s = applySurvivalAnswer(3, false);
    assert.equal(s.lives, 2);
    s = applySurvivalAnswer(s.lives, false);
    s = applySurvivalAnswer(s.lives, false);
    assert.deepEqual(s, { lives: 0, gameOver: true });
    assert.equal(applySurvivalAnswer(0, false).lives, 0);
  });
});

describe('timer server', () => {
  it('pakai offset jam server, bukan jam HP', () => {
    // HP telat 10 menit: client 00:00, server 00:10, expires 00:40 => 30 menit
    const clientAt = Date.parse('2026-10-22T00:00:00Z');
    assert.equal(secondsLeft('2026-10-22T00:40:00Z', '2026-10-22T00:10:00Z', clientAt, clientAt), 1800);
    assert.equal(secondsLeft('2026-10-22T00:40:00Z', '2026-10-22T00:10:00Z', clientAt, clientAt + 1800_000 + 5000), 0);
    assert.equal(secondsLeft(null, '2026-10-22T00:10:00Z', clientAt, clientAt), null);
  });
  it('format jam', () => {
    assert.equal(formatClock(59), '00:59');
    assert.equal(formatClock(3725), '1:02:05');
  });
});

describe('enkripsi token AES + HMAC', () => {
  const token = { sessionId: '7f1c6a52-0000-4000-8000-000000000001', secret: 'abc123secret' };
  it('round trip', () => {
    assert.deepEqual(decryptPayload(encryptPayload(token)), token);
  });
  it('ciphertext tidak memuat secret mentah, IV acak', () => {
    const a = encryptPayload(token);
    assert.equal(a.includes(token.secret), false);
    assert.notEqual(a, encryptPayload(token));
  });
  it('tamper ct / mac / iv / versi ditolak', () => {
    const p = JSON.parse(encryptPayload(token));
    const flip = (s: string) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
    for (const field of ['ct', 'mac', 'iv']) {
      assert.equal(decryptPayload(JSON.stringify({ ...p, [field]: flip(p[field]) })), null, field);
    }
    assert.equal(decryptPayload(JSON.stringify({ ...p, v: '4' })), null);
    assert.equal(decryptPayload('{"sessionId":"x"}'), null);
    assert.equal(decryptPayload('bukan json'), null);
  });
  it('storage: payload tamper dihapus', () => {
    const m = new Map<string, string>();
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    secureSave('ujian', token, store);
    assert.deepEqual(secureLoad('ujian', store), token);
    const [k, v] = [...m.entries()][0];
    const p = JSON.parse(v);
    m.set(k, JSON.stringify({ ...p, mac: (p.mac[0] === '0' ? '1' : '0') + p.mac.slice(1) }));
    assert.equal(secureLoad('ujian', store), null);
    assert.equal(m.size, 0);
  });
});
