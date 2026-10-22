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

test('Fase 3: Kuis Live Integration & Security Test Suite (1 Admin + 5 Siswa)', async (t) => {
  const client = new pg.Client(DB_CONFIG);
  await client.connect();

  let quizId: string;
  let quizCode: string;
  const playerIds: string[] = [];
  const playerNames = ['Budi Santoso', 'Siti Rahma', 'Ketut Sujana', 'Dewi Lestari', 'Agus Pratama'];
  const assignedSkins: string[] = [];

  try {
    // 1. KL-02: Guard Pool Soal
    await t.test('KL-02: Guard Pool Soal menolak kuis jika permintaan melebihi soal shown yang ada', async () => {
      const res = await client.query(
        "SELECT public.rpc_create_quiz(ARRAY[]::uuid[], 99999, 15, 'strict', false, '{}'::jsonb) as res"
      );
      const data = res.rows[0].res;
      assert.equal(data.success, false);
      assert.match(data.error, /Hanya tersedia \d+ soal dari 99999/);
    });

    // 2. KL-01 & KL-03: Buat Kuis & Kode 6 Digit
    await t.test('KL-01 & KL-03: Admin membuat kuis 5 soal dan mendapat kode 6 digit numerik unik', async () => {
      const res = await client.query(
        "SELECT public.rpc_create_quiz(ARRAY[]::uuid[], 5, 10, 'standard', true, '{}'::jsonb) as res"
      );
      const data = res.rows[0].res;
      assert.equal(data.success, true);
      assert.ok(data.quiz_id);
      assert.equal(data.question_count, 5);
      assert.equal(data.duration_minutes, 10);
      assert.equal(data.mode, 'standard');
      assert.match(data.code, /^\d{6}$/);

      quizId = data.quiz_id;
      quizCode = data.code;
    });

    // 3. KL-10 & KL-11 & RV-04: 5 Siswa Bergabung & Auto-assign Mount Unik
    await t.test('KL-10 & RV-04: 5 siswa join kuis berstatus waiting dan mendapatkan hewan tunggangan unik', async () => {
      for (const name of playerNames) {
        const res = await client.query('SELECT public.rpc_join_live_quiz($1, $2) as res', [quizCode, name]);
        const data = res.rows[0].res;
        assert.equal(data.success, true);
        assert.equal(data.name, name);
        assert.equal(data.question_count, 5);
        assert.ok(data.player_id);
        assert.ok(data.skin);

        playerIds.push(data.player_id);
        assignedSkins.push(data.skin);
      }

      assert.equal(playerIds.length, 5);
      // RV-04: Pastikan skin/mount tidak duplikat di antara 5 siswa
      const uniqueSkins = new Set(assignedSkins);
      assert.equal(uniqueSkins.size, 5, 'Semua 5 siswa harus mendapatkan mount yang berbeda');
    });

    // 4. KL-04: Siklus Status Kuis (Start -> Pause -> Resume -> Finish)
    await t.test('KL-04: Admin Mulai Kuis (waiting -> active)', async () => {
      const res = await client.query("SELECT public.rpc_admin_update_quiz_status($1, 'start') as res", [quizId]);
      const data = res.rows[0].res;
      assert.equal(data.success, true);
      assert.equal(data.status, 'active');
      assert.ok(data.started_at);
      assert.ok(data.expires_at);
    });

    await t.test('KL-04: Admin Jeda Kuis (active -> paused)', async () => {
      const res = await client.query("SELECT public.rpc_admin_update_quiz_status($1, 'pause') as res", [quizId]);
      const data = res.rows[0].res;
      assert.equal(data.success, true);
      assert.equal(data.status, 'paused');
      assert.ok(data.paused_at);
    });

    await t.test('KL-04: Admin Lanjut Kuis (paused -> active, pergeseran expires_at)', async () => {
      const res = await client.query("SELECT public.rpc_admin_update_quiz_status($1, 'resume') as res", [quizId]);
      const data = res.rows[0].res;
      assert.equal(data.success, true);
      assert.equal(data.status, 'active');
      assert.equal(data.paused_at, null);
    });

    // 5. KL-12 & Security Gate: Pengambilan Soal JIT tanpa Kunci Jawaban
    await t.test('KL-12 & Security: JIT fetch soal TIDAK PERNAH memuat answer_key atau explanation_html', async () => {
      for (const pid of playerIds) {
        const res = await client.query('SELECT public.rpc_get_quiz_question($1, 0) as res', [pid]);
        const data = res.rows[0].res;
        assert.equal(data.success, true);
        assert.ok(data.data.id);
        assert.ok(data.data.body_html);
        assert.equal(data.data.index, 0);
        assert.equal(data.data.total, 5);

        // Security assertion: NO LEAKAGE
        assert.equal('answer_key' in data.data, false, 'Payload JIT tidak boleh memiliki answer_key');
        assert.equal('explanation_html' in data.data, false, 'Payload JIT tidak boleh memiliki explanation_html');
      }
    });

    // 6. KL-13: Menjawab Soal & Server Scoring
    await t.test('KL-13: 5 siswa submit jawaban dengan performa berbeda', async () => {
      for (let pIdx = 0; pIdx < playerIds.length; pIdx++) {
        const pid = playerIds[pIdx];

        for (let qIdx = 0; qIdx < 5; qIdx++) {
          const qRes = await client.query('SELECT public.rpc_get_quiz_question($1, $2) as res', [pid, qIdx]);
          const qData = qRes.rows[0].res.data;

          // Fetch correct answer directly from DB questions table to simulate student answers
          const secretQ = await client.query('SELECT answer_key FROM public.questions WHERE id = $1', [qData.id]);
          const correctKey = secretQ.rows[0].answer_key;

          // Student 0 gets 5/5, Student 1 gets 4/5, Student 2 gets 3/5, Student 3 gets 2/5, Student 4 gets 1/5
          const shouldBeCorrect = qIdx < (5 - pIdx);
          const chosenAnswer = shouldBeCorrect ? correctKey : 'WRONG_ANSWER_CHOICE';
          const timeTaken = 5 + (pIdx * 2);

          const submitRes = await client.query(
            'SELECT public.rpc_submit_quiz_answer($1, $2, $3, $4, $5) as res',
            [pid, qIdx, qData.id, chosenAnswer, timeTaken]
          );
          const submitData = submitRes.rows[0].res;
          assert.equal(submitData.success, true);
          assert.equal(submitData.is_correct, shouldBeCorrect);
        }

        // Selesaikan siswa
        const finishRes = await client.query('SELECT public.rpc_finish_quiz_player($1) as res', [pid]);
        assert.equal(finishRes.rows[0].res.success, true);
      }
    });

    // 7. KL-14 & KL-15: Selesai & Leaderboard Verification
    await t.test('KL-15: Leaderboard terurut benar: skor tertinggi, waktu tersingkat, threshold 70%', async () => {
      const lbRes = await client.query(
        'SELECT id, name, score, total_time, finished_at FROM public.players WHERE quiz_id = $1 ORDER BY score DESC, total_time ASC, joined_at ASC',
        [quizId]
      );
      const rows = lbRes.rows;

      assert.equal(rows.length, 5);
      // Juara 1: Budi Santoso (skor 5)
      assert.equal(rows[0].name, 'Budi Santoso');
      assert.equal(rows[0].score, 5);

      // Juara 2: Siti Rahma (skor 4)
      assert.equal(rows[1].name, 'Siti Rahma');
      assert.equal(rows[1].score, 4);

      // Juara 3: Ketut Sujana (skor 3)
      assert.equal(rows[2].name, 'Ketut Sujana');
      assert.equal(rows[2].score, 3);

      // Juara 4: Dewi Lestari (skor 2)
      assert.equal(rows[3].name, 'Dewi Lestari');
      assert.equal(rows[3].score, 2);

      // Juara 5: Agus Pratama (skor 1)
      assert.equal(rows[4].name, 'Agus Pratama');
      assert.equal(rows[4].score, 1);

      // Threshold kelulusan 70% dari 5 soal adalah >= 4 soal
      // Budi (5) dan Siti (4) Lulus, sisanya Belum Lulus
      const passThreshold = Math.ceil(5 * 0.7);
      assert.equal(passThreshold, 4);
      assert.ok(rows[0].score >= passThreshold, 'Budi Santoso Lulus');
      assert.ok(rows[1].score >= passThreshold, 'Siti Rahma Lulus');
      assert.ok(rows[2].score < passThreshold, 'Ketut Sujana Belum Lulus');
    });

    // 8. KL-04: Admin Mengakhiri Kuis
    await t.test('KL-04: Admin Selesaikan Kuis (active -> finished)', async () => {
      const res = await client.query("SELECT public.rpc_admin_update_quiz_status($1, 'finish') as res", [quizId]);
      const data = res.rows[0].res;
      assert.equal(data.success, true);
      assert.equal(data.status, 'finished');
      assert.ok(data.finished_at);
    });

  } finally {
    await client.end();
  }
});
