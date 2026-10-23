import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

// Local Postgres only (scripts/local-stack). Everything runs inside a transaction and rolls back.
const DB_CONFIG = { host: '127.0.0.1', port: 54329, database: 'postgres', user: 'postgres', password: 'password' };

test('Fase 4: skin RPC + players RLS (local DB, rollback)', async (t) => {
  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  await client.query('BEGIN');
  try {
    const created = (await client.query(
      "SELECT public.rpc_create_quiz(ARRAY[]::uuid[], 3, 10, 'standard', true, '{}'::jsonb) AS r"
    )).rows[0].r;
    assert.equal(created.success, true, JSON.stringify(created));

    const ids: string[] = [];
    const mounts: string[] = [];
    for (let i = 0; i < 12; i++) {
      const j = (await client.query('SELECT public.rpc_join_live_quiz($1, $2) AS r', [created.code, `Race ${i}`])).rows[0].r;
      assert.equal(j.success, true);
      ids.push(j.player_id);
      mounts.push(String(j.skin).split(':')[1]);
    }

    await t.test('RV-04: 12 pemain dapat 12 hewan berbeda', () => {
      assert.equal(new Set(mounts).size, 12, mounts.join(','));
    });

    const setSkin = async (skin: string) =>
      (await client.query('SELECT public.rpc_set_player_skin($1, $2) AS r', [ids[0], skin])).rows[0].r;

    await t.test('RV-03: format preset:mount dari picker diterima saat waiting', async () => {
      const r = await setSkin('storm:citah');
      assert.equal(r.success, true, JSON.stringify(r));
      assert.equal(r.skin, 'storm:citah');
    });

    await t.test('RV-03: custom hex dinormalisasi lowercase', async () => {
      const r = await setSkin('custom:#AABBCC:#112233:#445566:dino');
      assert.equal(r.success, true);
      assert.equal(r.skin, 'custom:#aabbcc:#112233:#445566:dino');
    });

    await t.test('RV-03: input tidak valid ditolak', async () => {
      for (const bad of ['storm:naga', 'neon:horse', 'custom:#12345:#112233:#445566', 'custom:#aabbcc:#112233:#445566:naga',
        'custom:red:#112233:#445566', 'storm:horse:extra', "storm';drop", '']) {
        const r = await setSkin(bad);
        assert.equal(r.success, false, `harus ditolak: ${bad}`);
      }
    });

    await t.test('RV-03: skin terkunci setelah kuis mulai', async () => {
      const s = (await client.query("SELECT public.rpc_admin_update_quiz_status($1, 'start') AS r", [created.quiz_id])).rows[0].r;
      assert.equal(s.success, true, JSON.stringify(s));
      const r = await setSkin('ember:horse');
      assert.equal(r.success, false);
      assert.match(r.error, /ruang tunggu/);
    });

    await t.test('Security: anon tidak bisa SELECT players langsung (skor tersembunyi gak bocor via REST)', async () => {
      await client.query('SAVEPOINT anon_probe');
      await client.query("SET LOCAL role anon");
      await client.query(`SELECT set_config('request.jwt.claims', '{"role":"anon"}', true)`);
      const n = (await client.query('SELECT count(*)::int AS n FROM public.players WHERE quiz_id = $1', [created.quiz_id])).rows[0].n;
      await client.query('ROLLBACK TO SAVEPOINT anon_probe');
      assert.equal(n, 0);
    });
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
