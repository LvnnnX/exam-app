// tests/e2e/security-rest.mjs
// Negative E2E REST tests: anon key, anonymous student JWT, and regular admin JWT.
// Usage: node tests/e2e/security-rest.mjs [baseUrl]
import pg from 'pg';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { signJwt } from '../../scripts/local-stack/jwt.mjs';

const GATEWAY = 'http://127.0.0.1:54321';
const REST = `${GATEWAY}/rest/v1`;

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = env.LOCAL_JWT_SECRET;

const db = new pg.Client({
  host: '127.0.0.1',
  port: 54329,
  database: 'postgres',
  user: 'postgres',
  password: 'password',
});

const results = [];
let failed = false;

function ok(name, detail = '') {
  results.push(`PASS ${name}${detail ? ` (${detail})` : ''}`);
  console.log(`PASS ${name}${detail ? ` (${detail})` : ''}`);
}

function fail(name, detail = '') {
  failed = true;
  results.push(`FAIL ${name}${detail ? ` (${detail})` : ''}`);
  console.log(`FAIL ${name}${detail ? ` (${detail})` : ''}`);
}

async function rest(path, method = 'GET', headers = {}, body = null) {
  const opts = {
    method,
    headers: {
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${REST}/${path}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

await db.connect();

// Test fixtures with E2E-F7 prefix for clean isolation
const FIX_ADMIN = {
  username: 'e2e_f7_reg_admin',
  email: 'e2e_f7_reg_admin@exam.local',
  password: 'PasswordSuper123!',
};

let regularAdminUserId = null;
let regularAdminToken = null;
let studentToken = null;
const studentUserId = '22222222-2222-2222-2222-222222222222';
const targetSessionId = '77777777-7777-7777-7777-777777777777';
let targetQuizId = null;

try {
  console.log('='.repeat(60));
  console.log('E2E NEGATIVE TEST SUITE: SECURITY REST (PHASE 7)');
  console.log('='.repeat(60));

  // 1. Cleanup old fixture data
  await db.query(`DELETE FROM public.admins WHERE username = $1`, [FIX_ADMIN.username]);
  await db.query(`DELETE FROM auth.users WHERE lower(email) = lower($1)`, [FIX_ADMIN.email]);
  await db.query(`DELETE FROM public.exam_answers WHERE session_id = $1`, [targetSessionId]);
  await db.query(`DELETE FROM public.exam_sessions WHERE id = $1`, [targetSessionId]);

  // 2. Create regular admin in auth.users and public.admins
  const userRes = await db.query(
    `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
     VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', $1,
       public.crypt($2, public.gen_salt('bf')), now(), now(), now())
     RETURNING id`,
    [FIX_ADMIN.email, FIX_ADMIN.password],
  );
  regularAdminUserId = userRes.rows[0].id;

  await db.query(
    `INSERT INTO public.admins (user_id, username, role, status)
     VALUES ($1, $2, 'admin', 'active')`,
    [regularAdminUserId, FIX_ADMIN.username],
  );

  // 3. Login regular admin via /auth/v1/token gateway
  const loginRes = await fetch(`${GATEWAY}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: FIX_ADMIN.email, password: FIX_ADMIN.password }),
  });
  const loginBody = await loginRes.json();
  assert.equal(loginRes.status, 200, 'Regular admin login must succeed');
  regularAdminToken = loginBody.access_token;
  assert.ok(regularAdminToken, 'Access token issued');

  // 4. Issue student anonymous JWT (role authenticated, anon student sub)
  const now = Math.floor(Date.now() / 1000);
  studentToken = signJwt(
    { sub: studentUserId, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, is_anonymous: true },
    SECRET,
  );

  // 5. Seed a foreign session and quiz owned by someone else
  const qIdRes = await db.query(`SELECT id FROM public.questions WHERE visibility = 'shown' LIMIT 1`);
  const qId = qIdRes.rows[0].id;

  await db.query(
    `INSERT INTO public.exam_sessions (id, user_id, name, mode, nav_mode, selected_categories, question_order, secret_hash, status)
     VALUES ($1, '33333333-3333-3333-3333-333333333333', 'TargetOther', 'exam', 'strict', '{"topic_ids":[]}', ARRAY[$2::integer], 'hash123', 'active')`,
    [targetSessionId, qId],
  );

  const quizRes = await db.query(
    `INSERT INTO public.quizzes (code, status, created_by, config)
     VALUES ('999996', 'waiting', 'fed5d02c-4c9b-4502-ba99-50c600fab276', '{"quiz_mode":"strict"}')
     RETURNING id`,
  );
  targetQuizId = quizRes.rows[0].id;

  // =========================================================================
  // SUITE 1: Anon Key Probes (Questions, Secret Hash, Admins, Audit, Login Attempts)
  // =========================================================================
  console.log('\n[1/4] Menguji Pembatasan Anon Key via REST API...');

  // 1a. Anon cannot read questions.answer_key or explanation_html
  const rQ = await rest('questions?select=id,answer_key,explanation_html');
  if (rQ.status === 200 && Array.isArray(rQ.data) && rQ.data.length === 0) {
    ok('1a. Anon membaca questions: 0 baris (RLS block)');
  } else {
    fail('1a. Anon membaca questions', `status ${rQ.status}, rows ${rQ.data?.length}`);
  }

  // 1b. Anon cannot read exam_sessions.secret_hash
  const rSess = await rest('exam_sessions?select=id,secret_hash');
  if (rSess.status === 200 && Array.isArray(rSess.data) && rSess.data.length === 0) {
    ok('1b. Anon membaca exam_sessions.secret_hash: 0 baris (RLS block)');
  } else {
    fail('1b. Anon membaca exam_sessions.secret_hash', `status ${rSess.status}, rows ${rSess.data?.length}`);
  }

  // 1c. Anon cannot read admins table
  const rAdm = await rest('admins?select=*');
  if (rAdm.status === 200 && Array.isArray(rAdm.data) && rAdm.data.length === 0) {
    ok('1c. Anon membaca admins: 0 baris (RLS block)');
  } else {
    fail('1c. Anon membaca admins', `status ${rAdm.status}, rows ${rAdm.data?.length}`);
  }

  // 1d. Anon denied on admin_audit
  const rAud = await rest('admin_audit?select=*');
  if (rAud.status === 401 || rAud.status === 404) {
    ok('1d. Anon membaca admin_audit ditolak (401/404 permission denied)');
  } else {
    fail('1d. Anon membaca admin_audit', `status ${rAud.status}`);
  }

  // 1e. Anon denied on admin_login_attempts
  const rLog = await rest('admin_login_attempts?select=*');
  if (rLog.status === 401 || rLog.status === 404) {
    ok('1e. Anon membaca admin_login_attempts ditolak (401 permission denied)');
  } else {
    fail('1e. Anon membaca admin_login_attempts', `status ${rLog.status}`);
  }

  // 1f. Anon cannot call admin RPC rpc_create_quiz
  const rRpcCreate = await rest('rpc/rpc_create_quiz', 'POST', {}, { p_topic_ids: [], p_question_count: 5 });
  if (rRpcCreate.status === 401 || rRpcCreate.status === 404) {
    ok('1f. Anon panggil rpc_create_quiz ditolak PostgREST (401/404 function not executable)');
  } else {
    fail('1f. Anon panggil rpc_create_quiz', `status ${rRpcCreate.status}`);
  }

  // =========================================================================
  // SUITE 2: Student JWT Probes (Cross-tenant, Tampering, Admin RPCs)
  // =========================================================================
  console.log('\n[2/4] Menguji Pembatasan Sesi Siswa (JWT Anonim)...');
  const studentHeader = { Authorization: `Bearer ${studentToken}` };

  // 2a. Student cannot read foreign exam_sessions
  const rStudSess = await rest(`exam_sessions?id=eq.${targetSessionId}`, 'GET', studentHeader);
  if (rStudSess.status === 200 && Array.isArray(rStudSess.data) && rStudSess.data.length === 0) {
    ok('2a. Siswa membaca sesi milik orang lain: 0 baris');
  } else {
    fail('2a. Siswa membaca sesi milik orang lain', `status ${rStudSess.status}, rows ${rStudSess.data?.length}`);
  }

  // 2b. Student cannot update foreign exam_sessions
  const rStudUpd = await rest(`exam_sessions?id=eq.${targetSessionId}`, 'PATCH', { ...studentHeader, Prefer: 'return=representation' }, { score: 100 });
  if (rStudUpd.status === 200 && Array.isArray(rStudUpd.data) && rStudUpd.data.length === 0) {
    ok('2b. Siswa update sesi milik orang lain: 0 baris terpengaruh');
  } else {
    fail('2b. Siswa update sesi milik orang lain', `status ${rStudUpd.status}, rows ${rStudUpd.data?.length}`);
  }

  // 2c. Student cannot call rpc_get_exam_recap directly via REST
  const rStudRecap = await rest('rpc/rpc_get_exam_recap', 'POST', studentHeader, { p_session_id: targetSessionId });
  if (rStudRecap.status === 401 || rStudRecap.status === 403 || rStudRecap.status === 404) {
    ok('2c. Siswa panggil rpc_get_exam_recap ditolak (service_role only / 401/403/404)');
  } else {
    fail('2c. Siswa panggil rpc_get_exam_recap', `status ${rStudRecap.status}`);
  }

  // 2d. Student cannot call rpc_admin_update_quiz_status
  const rStudQuiz = await rest('rpc/rpc_admin_update_quiz_status', 'POST', studentHeader, { p_quiz_id: targetQuizId, p_action: 'finish' });
  if (rStudQuiz.status === 401 || rStudQuiz.status === 403 || rStudQuiz.status === 404) {
    ok('2d. Siswa panggil rpc_admin_update_quiz_status ditolak (service_role only / 401/403/404)');
  } else {
    fail('2d. Siswa panggil rpc_admin_update_quiz_status', `status ${rStudQuiz.status}`);
  }

  // =========================================================================
  // SUITE 3: Regular Admin Probes (AU-03 Isolation)
  // =========================================================================
  console.log('\n[3/4] Menguji Isolasi Admin Biasa vs Super Admin (AU-03)...');
  const adminHeader = { Authorization: `Bearer ${regularAdminToken}` };

  // 3a. Regular admin can read questions
  const rAdmQ = await rest('questions?select=id,type&limit=2', 'GET', adminHeader);
  if (rAdmQ.status === 200 && Array.isArray(rAdmQ.data) && rAdmQ.data.length === 2) {
    ok('3a. Admin biasa membaca questions: berhasil');
  } else {
    fail('3a. Admin biasa membaca questions', `status ${rAdmQ.status}, rows ${rAdmQ.data?.length}`);
  }

  // 3b. Regular admin only sees own record in admins table (not all admins)
  const rAdmList = await rest('admins?select=id,user_id,role', 'GET', adminHeader);
  if (rAdmList.status === 200 && Array.isArray(rAdmList.data) && rAdmList.data.length === 1 && rAdmList.data[0].user_id === regularAdminUserId) {
    ok('3b. Admin biasa membaca admins: hanya melihat dirinya sendiri (1 baris)');
  } else {
    fail('3b. Admin biasa membaca admins', `status ${rAdmList.status}, count ${rAdmList.data?.length}`);
  }

  // 3c. Regular admin cannot elevate own role to super_admin via REST PATCH
  const rAdmElevate = await rest(
    `admins?user_id=eq.${regularAdminUserId}`,
    'PATCH',
    { ...adminHeader, Prefer: 'return=representation' },
    { role: 'super_admin' },
  );
  if (rAdmElevate.status === 200 && Array.isArray(rAdmElevate.data) && rAdmElevate.data.length === 0) {
    ok('3c. Admin biasa elevate role ke super_admin via REST ditolak (0 baris terpengaruh)');
  } else {
    fail('3c. Admin biasa elevate role ke super_admin', `status ${rAdmElevate.status}, body ${JSON.stringify(rAdmElevate.data)}`);
  }

  // 3d. Regular admin cannot approve other admins via rpc_approve_admin_request
  const rAdmApprove = await rest('rpc/rpc_approve_admin_request', 'POST', adminHeader, { p_admin_id: '11111111-1111-1111-1111-111111111111' });
  const approveError = String(rAdmApprove.data?.error || rAdmApprove.data?.message || '');
  const approveSuccess = rAdmApprove.data?.success;
  if (rAdmApprove.status >= 400 || (rAdmApprove.status === 200 && approveSuccess === false && /super[ _]admin/i.test(approveError))) {
    ok('3d. Admin biasa eksekusi rpc_approve_admin_request ditolak guard super_admin (success: false)');
  } else {
    fail('3d. Admin biasa eksekusi rpc_approve_admin_request', `status ${rAdmApprove.status}, data ${JSON.stringify(rAdmApprove.data)}`);
  }

  // 3e. Regular admin cannot direct-UPDATE super_admin quiz via REST
  const rAdmQuizUpd = await rest(
    `quizzes?id=eq.${targetQuizId}`,
    'PATCH',
    { ...adminHeader, Prefer: 'return=representation' },
    { status: 'cancelled' },
  );
  if (rAdmQuizUpd.status === 200 && Array.isArray(rAdmQuizUpd.data) && rAdmQuizUpd.data.length === 0) {
    ok('3e. Admin biasa direct-UPDATE kuis milik super_admin ditolak RLS (0 baris)');
  } else {
    fail('3e. Admin biasa direct-UPDATE kuis milik super_admin', `status ${rAdmQuizUpd.status}, body ${JSON.stringify(rAdmQuizUpd.data)}`);
  }

  // =========================================================================
  // SUITE 4: Direct REST Writes Blocked for Students on Sensitive Tables
  // =========================================================================
  console.log('\n[4/4] Menguji Penolakan Direct Write Siswa pada Tabel Sensitif...');

  // 4a. Student cannot insert questions
  const rInsQ = await rest('questions', 'POST', studentHeader, { id: 999991, type: 'multiple_choice', body_html: 'hack', answer_key: 'A' });
  if (rInsQ.status === 401 || rInsQ.status === 403 || rInsQ.status >= 400) {
    ok('4a. Siswa direct INSERT questions ditolak');
  } else {
    fail('4a. Siswa direct INSERT questions', `status ${rInsQ.status}`);
  }

  // 4b. Student cannot delete answers
  const rDelAns = await rest('answers?player_id=eq.88888888-8888-8888-8888-888888888888', 'DELETE', { ...studentHeader, Prefer: 'return=representation' });
  if ((rDelAns.status === 200 && Array.isArray(rDelAns.data) && rDelAns.data.length === 0) || rDelAns.status === 401 || rDelAns.status === 403) {
    ok('4b. Siswa direct DELETE answers: ditolak RLS (0 baris terpengaruh)');
  } else {
    fail('4b. Siswa direct DELETE answers', `status ${rDelAns.status}, data ${JSON.stringify(rDelAns.data)}`);
  }

} catch (err) {
  failed = true;
  console.error('Fatal error running REST security suite:', err);
} finally {
  console.log('\nMembersihkan data uji fixture...');
  if (regularAdminUserId) {
    await db.query(`DELETE FROM public.admins WHERE user_id = $1`, [regularAdminUserId]).catch(() => {});
    await db.query(`DELETE FROM auth.users WHERE id = $1`, [regularAdminUserId]).catch(() => {});
  }
  if (targetQuizId) {
    await db.query(`DELETE FROM public.quizzes WHERE id = $1`, [targetQuizId]).catch(() => {});
  }
  await db.query(`DELETE FROM public.exam_answers WHERE session_id = $1`, [targetSessionId]).catch(() => {});
  await db.query(`DELETE FROM public.exam_sessions WHERE id = $1`, [targetSessionId]).catch(() => {});
  await db.end().catch(() => {});
}

console.log('='.repeat(60));
console.log(`RINGKASAN: ${results.filter((r) => r.startsWith('PASS')).length} PASS, ${results.filter((r) => r.startsWith('FAIL')).length} FAIL`);
console.log('='.repeat(60));
process.exit(failed ? 1 : 0);
