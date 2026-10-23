import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const PG_CONFIG = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 54329),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
};

describe('Fase 6: Auth Admin, Super Admin Approval, Role Management & Rate Limit Test Suite', () => {
  let client: pg.Client;
  let testSuperAdminId: string;
  let testAdminId: string;
  let testPendingAdminId: string;
  let testAuthUserId: string;

  before(async () => {
    client = new pg.Client(PG_CONFIG);
    await client.connect();

    // Pastikan super_admin lokal ada
    const superRow = await client.query(
      `SELECT id, user_id FROM public.admins WHERE role = 'super_admin' AND status = 'active' LIMIT 1`,
    );
    assert.ok(superRow.rows[0], 'Super admin aktif harus ada di database');
    testSuperAdminId = superRow.rows[0].id;

    // Bersihkan data tes jika ada sisa run sebelumnya
    await client.query(`DELETE FROM public.admins WHERE username LIKE 'e2e_test_%'`);
    await client.query(`DELETE FROM auth.users WHERE email LIKE 'e2e_test_%@test.local'`);
    await client.query(`DELETE FROM public.admin_login_attempts WHERE identifier LIKE '%test_ratelimit%'`);
  });

  after(async () => {
    // Cleanup data tes
    await client.query(`DELETE FROM public.admins WHERE username LIKE 'e2e_test_%'`);
    await client.query(`DELETE FROM auth.users WHERE email LIKE 'e2e_test_%@test.local'`);
    await client.query(`DELETE FROM public.admin_login_attempts WHERE identifier LIKE '%test_ratelimit%'`);
    await client.end();
  });

  test('AU-04 Rate Limit: 5 kali gagal dalam 15 menit memblokir percobaan ke-6, login sukses mereset', async () => {
    const testEmail = 'user_test_ratelimit@test.local';

    // Awalnya login diizinkan
    const initialCheck = await client.query(
      `SELECT public.check_admin_login_allowed($1, 'unknown') as allowed`,
      [testEmail],
    );
    assert.equal(initialCheck.rows[0].allowed, true, 'Awalnya harus allowed');

    // Catat 4 kali kegagalan
    for (let i = 0; i < 4; i++) {
      await client.query(`SELECT public.record_admin_login_attempt($1, 'unknown', false)`, [testEmail]);
    }
    const checkAfter4 = await client.query(
      `SELECT public.check_admin_login_allowed($1, 'unknown') as allowed`,
      [testEmail],
    );
    assert.equal(checkAfter4.rows[0].allowed, true, 'Setelah 4 kali gagal masih allowed');

    // Catat kegagalan ke-5
    await client.query(`SELECT public.record_admin_login_attempt($1, 'unknown', false)`, [testEmail]);
    const checkAfter5 = await client.query(
      `SELECT public.check_admin_login_allowed($1, 'unknown') as allowed`,
      [testEmail],
    );
    assert.equal(checkAfter5.rows[0].allowed, false, 'Setelah 5 kali gagal wajib diblokir (false)');

    // Login berhasil mereset batas gagal
    await client.query(`SELECT public.record_admin_login_attempt($1, 'unknown', true)`, [testEmail]);
    const checkAfterSuccess = await client.query(
      `SELECT public.check_admin_login_allowed($1, 'unknown') as allowed`,
      [testEmail],
    );
    assert.equal(checkAfterSuccess.rows[0].allowed, true, 'Setelah login sukses harus allowed kembali');
  });

  test('AU-02 & AU-03 Registrasi & Status Pending: Admin baru dibuat dengan status pending', async () => {
    const email = 'e2e_test_newbie@test.local';
    const username = 'e2e_test_newbie';

    // Buat auth user
    const uRes = await client.query(
      `INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id`,
      [email],
    );
    testAuthUserId = uRes.rows[0].id;

    // Insert ke public.admins dengan status pending
    const aRes = await client.query(
      `INSERT INTO public.admins (user_id, username, role, status)
       VALUES ($1, $2, 'admin', 'pending')
       RETURNING id, role, status`,
      [testAuthUserId, username],
    );
    testPendingAdminId = aRes.rows[0].id;
    assert.equal(aRes.rows[0].role, 'admin');
    assert.equal(aRes.rows[0].status, 'pending');
  });

  test('AU-03 Approval Workflow: Super Admin menyetujui permohonan pending -> status menjadi active', async () => {
    // Jalankan dalam konteks super admin
    const superUser = await client.query(
      `SELECT user_id FROM public.admins WHERE id = $1`,
      [testSuperAdminId],
    );
    const superUid = superUser.rows[0].user_id;

    await client.query('BEGIN');
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [superUid]);
    await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);

    const approveRes = await client.query(
      `SELECT public.rpc_approve_admin_request($1) as result`,
      [testPendingAdminId],
    );
    await client.query('COMMIT');

    const result = approveRes.rows[0].result;
    assert.equal(result.success, true, 'Approval harus sukses');
    assert.equal(result.status, 'active');

    // Verifikasi di DB
    const checkDb = await client.query(
      `SELECT status, reviewed_by, reviewed_at FROM public.admins WHERE id = $1`,
      [testPendingAdminId],
    );
    assert.equal(checkDb.rows[0].status, 'active');
    assert.equal(checkDb.rows[0].reviewed_by, superUid);
    assert.ok(checkDb.rows[0].reviewed_at);

    testAdminId = testPendingAdminId;
  });

  test('AU-05 Kelola Role: Super Admin dapat mengubah role admin menjadi super_admin dan sebaliknya', async () => {
    const superUser = await client.query(
      `SELECT user_id FROM public.admins WHERE id = $1`,
      [testSuperAdminId],
    );
    const superUid = superUser.rows[0].user_id;

    await client.query('BEGIN');
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [superUid]);
    await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);

    // Ubah role admin target menjadi super_admin
    const upRes = await client.query(
      `SELECT public.rpc_update_admin_role($1, 'super_admin') as result`,
      [testAdminId],
    );
    assert.equal(upRes.rows[0].result.success, true);
    assert.equal(upRes.rows[0].result.role, 'super_admin');

    // Kembalikan ke admin
    const downRes = await client.query(
      `SELECT public.rpc_update_admin_role($1, 'admin') as result`,
      [testAdminId],
    );
    assert.equal(downRes.rows[0].result.success, true);
    assert.equal(downRes.rows[0].result.role, 'admin');

    await client.query('COMMIT');
  });

  test('AU-05 Proteksi Diri: Menolak self-demote jika menjadi satu-satunya super admin aktif', async () => {
    // Hitung jumlah super admin aktif
    const supers = await client.query(
      `SELECT id, user_id FROM public.admins WHERE role = 'super_admin' AND status = 'active'`,
    );

    // Jika ada lebih dari 1 super admin aktif, nonaktifkan yang lain sementara
    const otherSuperIds = supers.rows.filter((r) => r.id !== testSuperAdminId).map((r) => r.id);
    for (const sid of otherSuperIds) {
      await client.query(`UPDATE public.admins SET status = 'rejected' WHERE id = $1`, [sid]);
    }

    const singleSuper = await client.query(
      `SELECT user_id FROM public.admins WHERE id = $1`,
      [testSuperAdminId],
    );
    const singleSuperUid = singleSuper.rows[0].user_id;

    await client.query('BEGIN');
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [singleSuperUid]);
    await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);

    // Coba self-demote
    const demoteRes = await client.query(
      `SELECT public.rpc_update_admin_role($1, 'admin') as result`,
      [testSuperAdminId],
    );
    assert.equal(demoteRes.rows[0].result.success, false, 'Self-demote harus ditolak');
    assert.match(demoteRes.rows[0].result.error, /satu-satunya super admin/);

    // Coba self-deactivate
    const deactRes = await client.query(
      `SELECT public.rpc_toggle_admin_status($1, 'rejected') as result`,
      [testSuperAdminId],
    );
    assert.equal(deactRes.rows[0].result.success, false, 'Self-deactivate harus ditolak');
    assert.match(deactRes.rows[0].result.error, /satu-satunya super admin/);

    await client.query('ROLLBACK');

    // Kembalikan status super admin lain
    for (const sid of otherSuperIds) {
      await client.query(`UPDATE public.admins SET status = 'active' WHERE id = $1`, [sid]);
    }
  });

  test('AU-04 Rejection: Super Admin menolak admin -> status rejected', async () => {
    const superUser = await client.query(
      `SELECT user_id FROM public.admins WHERE id = $1`,
      [testSuperAdminId],
    );
    const superUid = superUser.rows[0].user_id;

    await client.query('BEGIN');
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [superUid]);
    await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);

    const rejRes = await client.query(
      `SELECT public.rpc_reject_admin_request($1, 'Data pengajar tidak valid') as result`,
      [testAdminId],
    );
    await client.query('COMMIT');

    const result = rejRes.rows[0].result;
    assert.equal(result.success, true);
    assert.equal(result.status, 'rejected');

    const checkDb = await client.query(
      `SELECT status, rejection_reason FROM public.admins WHERE id = $1`,
      [testAdminId],
    );
    assert.equal(checkDb.rows[0].status, 'rejected');
    assert.equal(checkDb.rows[0].rejection_reason, 'Data pengajar tidak valid');
  });

  test('AU-07 & AU-08 RLS: Non-super-admin ditolak saat memanggil RPC super admin', async () => {
    // Simulasikan pemanggil adalah admin biasa (bukan super admin)
    const adminUser = await client.query(
      `SELECT user_id FROM public.admins WHERE role = 'admin' AND status = 'active' LIMIT 1`,
    );
    assert.ok(adminUser.rows[0], 'Admin biasa aktif harus ada di database');
    const adminUid = adminUser.rows[0].user_id;

    await client.query('BEGIN');
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [adminUid]);
    await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);

    const approveByNormalAdmin = await client.query(
      `SELECT public.rpc_approve_admin_request($1) as result`,
      [testAdminId],
    );
    assert.equal(approveByNormalAdmin.rows[0].result.success, false);
    assert.match(approveByNormalAdmin.rows[0].result.error, /Hanya super admin/);

    const updateRoleByNormalAdmin = await client.query(
      `SELECT public.rpc_update_admin_role($1, 'super_admin') as result`,
      [testAdminId],
    );
    assert.equal(updateRoleByNormalAdmin.rows[0].result.success, false);
    assert.match(updateRoleByNormalAdmin.rows[0].result.error, /Hanya super admin/);

    await client.query('COMMIT');
  });
});
