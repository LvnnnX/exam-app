import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 54329,
  database: 'postgres',
  user: 'postgres',
  password: 'password',
};

// Helper to safely test queries that fail inside a Postgres transaction using savepoints
async function expectQueryThrows(client: pg.Client, sql: string, params: unknown[], expected: RegExp) {
  await client.query('SAVEPOINT expect_err');
  try {
    let thrown = false;
    try {
      await client.query(sql, params);
    } catch (err: unknown) {
      thrown = true;
      assert.match((err as Error).message, expected);
    }
    assert.equal(thrown, true, `Query should have thrown matching ${expected}`);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expect_err');
  }
}

test('Fase 5: Ujian Mandiri RPC, Security, & Integration Test Suite (Rollback)', async (t) => {
  const client = new pg.Client(DB_CONFIG);
  await client.connect();

  await client.query('BEGIN');

  try {
    // 0. Ambil shown topic yang punya minimal 15 soal
    const topicRes = await client.query(`
      SELECT t.id, count(DISTINCT q.id) as q_count
      FROM public.topics t
      JOIN public.chapters c ON c.id = t.chapter_id
      JOIN public.subjects s ON s.id = c.subject_id
      JOIN public.question_topics qt ON qt.topic_id = t.id
      JOIN public.questions q ON q.id = qt.question_id
      WHERE t.visibility = 'shown' AND c.visibility = 'shown' AND s.visibility = 'shown'
        AND q.visibility = 'shown' AND q.archived_at IS NULL
      GROUP BY t.id
      HAVING count(DISTINCT q.id) >= 15
      LIMIT 1
    `);
    assert.ok(topicRes.rows.length > 0, 'Harus ada topic dengan >= 15 soal');
    const shownTopicId = topicRes.rows[0].id;
    const availableCount = Number(topicRes.rows[0].q_count);

    // 1. Exam Standard End-to-End
    await t.test('1. Exam Standard End-to-End: start, answer, doubt, finish, recap', async () => {
      const startRes = await client.query('SELECT public.rpc_ujian_start($1, $2, $3, $4, $5, $6) as res', ['BudiStandard', [shownTopicId], 'exam', 'standard', 10, 30]);
      const startData = startRes.rows[0].res;
      assert.equal(startData.success, true);
      const { session_id: sid, secret } = startData;

      // Recap sebelum finish harus ditolak
      await expectQueryThrows(client, 'SELECT public.rpc_ujian_recap($1, $2) as res', [sid, secret], /Rekap hanya dapat dilihat setelah ujian selesai/);

      // Ambil question_order untuk sesi ini
      const orderRes = await client.query('SELECT question_order FROM public.exam_sessions WHERE id = $1', [sid]);
      const questionOrder: number[] = orderRes.rows[0].question_order;
      assert.equal(questionOrder.length, 10);

      // Jawab 4 soal benar, 1 ragu, 1 salah
      for (let i = 0; i < 4; i++) {
        const qid = questionOrder[i];
        const key = (await client.query('SELECT answer_key FROM public.questions WHERE id = $1', [qid])).rows[0].answer_key;
        const saveRes = await client.query('SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6) as res', [sid, secret, i, key, i === 2, 15]);
        assert.equal(saveRes.rows[0].res.finished, false);
      }

      // Index 4 jawab salah
      await client.query('SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6) as res', [sid, secret, 4, 'JAWABAN_SALAH_XYZ', false, 10]);

      // State check: pastikan score null untuk exam active
      const stateData = (await client.query('SELECT public.rpc_ujian_state($1, $2) as res', [sid, secret])).rows[0].res;
      assert.equal(stateData.status, 'active');
      assert.equal(stateData.score, null, 'Score tidak boleh bocor pada exam active');
      assert.equal(stateData.answers.length, 10);
      assert.equal(stateData.answers[0].answered, true);
      assert.equal(stateData.answers[2].doubtful, true);
      assert.equal(stateData.answers[5].answered, false);

      // Finish session
      const finishData = (await client.query('SELECT public.rpc_ujian_finish($1, $2, $3) as res', [sid, secret, 'submit'])).rows[0].res;
      assert.equal(finishData.status, 'finished');
      assert.equal(finishData.end_reason, 'submit');
      assert.equal(finishData.score, 4);
      assert.equal(finishData.total, 10);
      assert.equal(finishData.percent, 40);
      assert.equal(finishData.answered, 5);

      // Recap setelah finish: harus ada answer_key, TIDAK boleh ada explanation_html
      const recapData = (await client.query('SELECT public.rpc_ujian_recap($1, $2) as res', [sid, secret])).rows[0].res;
      assert.equal(recapData.summary.score, 4);
      assert.equal(recapData.summary.percent, 40);
      assert.equal(recapData.items.length, 10);
      assert.ok(recapData.items[0].answer_key, 'Recap item harus memuat answer_key');
      assert.equal('explanation_html' in recapData.items[0], false, 'Recap item TIDAK boleh bocor explanation_html');
    });

    // 2. Exam Strict
    await t.test('2. Exam Strict: berurutan, lompat ditolak, mundur ditolak', async () => {
      const startRes = await client.query('SELECT public.rpc_ujian_start($1, $2, $3, $4, $5, $6) as res', ['StrictStudent', [shownTopicId], 'exam', 'strict', 5, 0]);
      const { session_id: sid, secret } = startRes.rows[0].res;

      const q0 = await client.query('SELECT public.rpc_ujian_question($1, $2, $3) as res', [sid, secret, 0]);
      assert.equal(q0.rows[0].res.index, 0);

      await expectQueryThrows(client, 'SELECT public.rpc_ujian_question($1, $2, $3) as res', [sid, secret, 1], /harus/);

      const save0 = await client.query('SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6) as res', [sid, secret, 0, 'A', false, 10]);
      assert.equal(save0.rows[0].res.next_index, 1);

      await expectQueryThrows(client, 'SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6) as res', [sid, secret, 0, 'B', false, 10], /berurutan/);
      await expectQueryThrows(client, 'SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6) as res', [sid, secret, 3, 'A', false, 10], /berurutan/);
    });

    // 3. Preset Validation
    await t.test('3. Preset: count 7 ditolak, count > tersedia ditolak, kategori < 5 ditolak', async () => {
      // count 7 bukan salah satu preset
      const res7 = await client.query(
        'SELECT public.rpc_ujian_start($1, $2, $3, $4, $5, $6) as res',
        ['PresetTest', [shownTopicId], 'exam', 'standard', 7, 0]
      );
      assert.equal(res7.rows[0].res.success, false);
      assert.match(res7.rows[0].res.error, /Jumlah soal tidak valid/);

      // count > tersedia
      const resOver = await client.query(
        'SELECT public.rpc_ujian_start($1, $2, $3, $4, $5, $6) as res',
        ['PresetTest', [shownTopicId], 'exam', 'standard', 100, 0]
      );
      if (availableCount < 100) {
        assert.equal(resOver.rows[0].res.success, false);
        assert.match(resOver.rows[0].res.error, /Soal tersedia cuma/);
      }

      // Kategori dummy dengan 3 soal (< 5 soal)
      const subId = (await client.query("INSERT INTO public.subjects (name, slug) VALUES ('SubDummy', 'subdummy') RETURNING id")).rows[0].id;
      const chId = (await client.query("INSERT INTO public.chapters (subject_id, name, slug) VALUES ($1, 'ChDummy', 'chdummy') RETURNING id", [subId])).rows[0].id;
      const topId = (await client.query("INSERT INTO public.topics (chapter_id, name, slug) VALUES ($1, 'TopDummy', 'topdummy') RETURNING id", [chId])).rows[0].id;

      // Tambahkan 3 soal
      for (let i = 888001; i <= 888003; i++) {
        await client.query(
          "INSERT INTO public.questions (id, type, body_html, answer_key) VALUES ($1, 'multiple_choice', '<p>Dummy</p>', 'A')",
          [i]
        );
        await client.query('INSERT INTO public.question_topics (question_id, topic_id) VALUES ($1, $2)', [i, topId]);
      }

      const resUnder5 = await client.query(
        'SELECT public.rpc_ujian_start($1, $2, $3, $4, $5, $6) as res',
        ['SmallTopic', [topId], 'exam', 'standard', 5, 0]
      );
      assert.equal(resUnder5.rows[0].res.success, false);
      assert.match(resUnder5.rows[0].res.error, /kurang dari 5/);
    });

    // 4. Survival Mode & Idempotent Retry
    await t.test('4. Survival Mode: 3 salah = lives_out, retry idempoten', async () => {
      const startRes = await client.query(
        'SELECT public.rpc_ujian_start($1, $2, $3, $4, $5, $6) as res',
        ['SurvPlayer', [shownTopicId], 'survival', 'strict', null, 0]
      );
      const { session_id: sid, secret } = startRes.rows[0].res;

      const orderRes = await client.query('SELECT question_order FROM public.exam_sessions WHERE id = $1', [sid]);
      const questionOrder: number[] = orderRes.rows[0].question_order;

      // Soal 0: Jawab BENAR
      const key0 = (await client.query('SELECT answer_key FROM public.questions WHERE id = $1', [questionOrder[0]])).rows[0].answer_key;
      const save0 = await client.query(
        'SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6) as res',
        [sid, secret, 0, key0, false, 5]
      );
      assert.equal(save0.rows[0].res.is_correct, true);
      assert.equal(save0.rows[0].res.lives, 3);
      assert.equal(save0.rows[0].res.score, 1);
      assert.equal(save0.rows[0].res.next_index, 1);

      // RETRY IDEMPOTEN untuk soal 0 dengan jawaban sama (UM-12)
      const retry0 = await client.query(
        'SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6) as res',
        [sid, secret, 0, key0, false, 5]
      );
      assert.equal(retry0.rows[0].res.is_correct, true);
      assert.equal(retry0.rows[0].res.lives, 3, 'Retry tidak boleh mengurangi nyawa');
      assert.equal(retry0.rows[0].res.score, 1, 'Retry tidak boleh menduplikasi skor');

      // Soal 1: Jawab SALAH -> lives = 2
      const save1 = await client.query(
        'SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6) as res',
        [sid, secret, 1, 'WRONG_ANSWER_1', false, 5]
      );
      assert.equal(save1.rows[0].res.is_correct, false);
      assert.equal(save1.rows[0].res.lives, 2);

      // Soal 2: Jawab SALAH -> lives = 1
      const save2 = await client.query(
        'SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6) as res',
        [sid, secret, 2, 'WRONG_ANSWER_2', false, 5]
      );
      assert.equal(save2.rows[0].res.is_correct, false);
      assert.equal(save2.rows[0].res.lives, 1);
      assert.equal(save2.rows[0].res.finished, false);

      // Soal 3: Jawab SALAH -> lives = 0, finished = true, lives_out
      const save3 = await client.query(
        'SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6) as res',
        [sid, secret, 3, 'WRONG_ANSWER_3', false, 5]
      );
      assert.equal(save3.rows[0].res.is_correct, false);
      assert.equal(save3.rows[0].res.lives, 0);
      assert.equal(save3.rows[0].res.finished, true);

      // Cek status sesi di DB
      const sessionRow = (await client.query('SELECT status, end_reason, score, lives FROM public.exam_sessions WHERE id = $1', [sid])).rows[0];
      assert.equal(sessionRow.status, 'finished');
      assert.equal(sessionRow.end_reason, 'lives_out');
      assert.equal(sessionRow.score, 1);
      assert.equal(sessionRow.lives, 0);
    });

    // 5. Refresh Restore
    await t.test('5. Refresh Restore: rpc_ujian_state & rpc_ujian_question konsisten setelah refresh', async () => {
      const startRes = await client.query(
        'SELECT public.rpc_ujian_start($1, $2, $3, $4, $5, $6) as res',
        ['RestoreUser', [shownTopicId], 'survival', 'strict', null, 0]
      );
      const { session_id: sid, secret } = startRes.rows[0].res;

      const orderRes = await client.query('SELECT question_order FROM public.exam_sessions WHERE id = $1', [sid]);
      const questionOrder: number[] = orderRes.rows[0].question_order;

      // Jawab 2 soal (1 benar, 1 salah) -> lives = 2, current_index = 2
      const key0 = (await client.query('SELECT answer_key FROM public.questions WHERE id = $1', [questionOrder[0]])).rows[0].answer_key;
      await client.query('SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6)', [sid, secret, 0, key0, false, 5]);
      await client.query('SELECT public.rpc_ujian_save($1, $2, $3, $4, $5, $6)', [sid, secret, 1, 'WRONG', false, 5]);

      // Ambil state pertama kali (simulasi sebelum refresh)
      const state1 = (await client.query('SELECT public.rpc_ujian_state($1, $2) as res', [sid, secret])).rows[0].res;
      assert.equal(state1.lives, 2);
      assert.equal(state1.current_index, 2);

      // Simulasi refresh browser: panggil state lagi
      const state2 = (await client.query('SELECT public.rpc_ujian_state($1, $2) as res', [sid, secret])).rows[0].res;
      assert.equal(state2.lives, 2, 'Lives tidak boleh reset ke 3 saat refresh');
      assert.equal(state2.current_index, 2, 'Current index harus tetap di soal terakhir');
      assert.equal(state2.started_at, state1.started_at);
      assert.equal(state2.expires_at, state1.expires_at);

      // Ambil soal index 2 dua kali: harus mengembalikan soal yang persis sama
      const qA = (await client.query('SELECT public.rpc_ujian_question($1, $2, $3) as res', [sid, secret, 2])).rows[0].res;
      const qB = (await client.query('SELECT public.rpc_ujian_question($1, $2, $3) as res', [sid, secret, 2])).rows[0].res;
      assert.equal(qA.id, qB.id);
      assert.deepEqual(qA.options, qB.options, 'Urutan opsi acak harus deterministik dan sama');
    });

    // 6. Expiry / Auto-Finalize Time Up
    await t.test('6. Expiry: expires_at lewat waktu -> state auto-finalize time_up', async () => {
      const startRes = await client.query(
        'SELECT public.rpc_ujian_start($1, $2, $3, $4, $5, $6) as res',
        ['ExpiredUser', [shownTopicId], 'exam', 'standard', 5, 30]
      );
      const { session_id: sid, secret } = startRes.rows[0].res;

      // Update expires_at ke masa lalu
      await client.query("UPDATE public.exam_sessions SET expires_at = now() - interval '10 minutes' WHERE id = $1", [sid]);

      // Panggil rpc_ujian_state
      const stateRes = await client.query('SELECT public.rpc_ujian_state($1, $2) as res', [sid, secret]);
      const stateData = stateRes.rows[0].res;
      assert.equal(stateData.status, 'finished');
      assert.equal(stateData.end_reason, 'time_up');

      // rpc_ujian_question harus menolak sesi yang sudah selesai
      await expectQueryThrows(
        client,
        'SELECT public.rpc_ujian_question($1, $2, $3)',
        [sid, secret, 0],
        /Sesi sudah selesai/
      );
    });

    // 7. Security: secret salah, role isolation, no leak
    await t.test('7. Keamanan: secret salah ditolak, tidak bocor secret_hash/answer_key, RLS isolasi', async () => {
      const startRes = await client.query(
        'SELECT public.rpc_ujian_start($1, $2, $3, $4, $5, $6) as res',
        ['SecTestUser', [shownTopicId], 'exam', 'standard', 5, 0]
      );
      const { session_id: sid, secret } = startRes.rows[0].res;

      const badSecret = secret.slice(0, 63) + (secret[63] === 'a' ? 'b' : 'a');

      // Secret salah ditolak di state
      await expectQueryThrows(
        client,
        'SELECT public.rpc_ujian_state($1, $2)',
        [sid, badSecret],
        /Sesi tidak ditemukan/
      );

      // Question payload TIDAK PERNAH memuat answer_key, explanation_html, atau secret_hash
      const qRes = await client.query('SELECT public.rpc_ujian_question($1, $2, $3) as res', [sid, secret, 0]);
      const qData = qRes.rows[0].res;
      assert.equal('answer_key' in qData, false, 'Question tidak boleh memuat answer_key');
      assert.equal('explanation_html' in qData, false, 'Question tidak boleh memuat explanation_html');
      assert.equal('secret_hash' in qData, false, 'Question tidak boleh memuat secret_hash');

      // Isolasi anon via SET LOCAL role
      await client.query('SAVEPOINT rls_probe');
      await client.query("SET LOCAL role anon");
      await client.query(`SELECT set_config('request.jwt.claims', '{"role":"anon"}', true)`);

      const anonSessions = (await client.query('SELECT count(*)::int as n FROM public.exam_sessions WHERE id = $1', [sid])).rows[0].n;
      assert.equal(anonSessions, 0, 'Anon tidak boleh SELECT exam_sessions sesi orang lain');

      const anonAnswers = (await client.query('SELECT count(*)::int as n FROM public.exam_answers WHERE session_id = $1', [sid])).rows[0].n;
      assert.equal(anonAnswers, 0, 'Anon tidak boleh SELECT exam_answers sesi orang lain');

      // Anon execute rpc_ujian_* harus ditolak
      await expectQueryThrows(
        client,
        'SELECT public.rpc_ujian_state($1, $2)',
        [sid, secret],
        /permission denied/
      );

      await client.query('ROLLBACK TO SAVEPOINT rls_probe');

      // Hidden question / hidden topic tidak pernah masuk pool (as postgres)
      const subIdH = (await client.query("INSERT INTO public.subjects (name, slug, visibility) VALUES ('SubH', 'subh', 'shown') RETURNING id")).rows[0].id;
      const chIdH = (await client.query("INSERT INTO public.chapters (subject_id, name, slug, visibility) VALUES ($1, 'ChH', 'chh', 'hidden') RETURNING id", [subIdH])).rows[0].id;
      const topIdH = (await client.query("INSERT INTO public.topics (chapter_id, name, slug, visibility) VALUES ($1, 'TopH', 'toph', 'shown') RETURNING id", [chIdH])).rows[0].id;

      // Soal shown di bawah hidden chapter (cascade)
      await client.query("INSERT INTO public.questions (id, type, body_html, answer_key, visibility) VALUES (888998, 'multiple_choice', '<p>H</p>', 'A', 'shown')");
      await client.query('INSERT INTO public.question_topics (question_id, topic_id) VALUES (888998, $1)', [topIdH]);

      // Soal hidden di bawah shown topic
      await client.query("INSERT INTO public.questions (id, type, body_html, answer_key, visibility) VALUES (888999, 'multiple_choice', '<p>HiddenQ</p>', 'A', 'hidden')");
      await client.query('INSERT INTO public.question_topics (question_id, topic_id) VALUES (888999, $1)', [shownTopicId]);

      // Start session di shownTopicId
      const testPoolRes = await client.query(
        'SELECT public.rpc_ujian_start($1, $2, $3, $4, $5, $6) as res',
        ['PoolCheck', [shownTopicId], 'exam', 'standard', 5, 0]
      );
      const poolSid = testPoolRes.rows[0].res.session_id;
      const poolOrders = (await client.query('SELECT question_order FROM public.exam_sessions WHERE id = $1', [poolSid])).rows[0].question_order;
      assert.equal(poolOrders.includes(888999), false, 'Hidden question tidak boleh masuk pool');

      // Topik di bawah hidden chapter harus ditolak (0 valid topics)
      const badCascadeRes = await client.query(
        'SELECT public.rpc_ujian_start($1, $2, $3, $4, $5, $6) as res',
        ['BadCascade', [topIdH], 'exam', 'standard', 5, 0]
      );
      assert.equal(badCascadeRes.rows[0].res.success, false);
    });

  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
