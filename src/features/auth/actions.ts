'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminSupabaseClient, createServerSupabaseClient, REMEMBER_COOKIE } from '@/src/lib/supabase-server';
import { requireSuperAdmin } from './server';
import type { AdminRole, AdminStatus } from './types';
import { EMAIL_RE, USERNAME_RE, passwordProblem, safeAdminRedirect } from './validation';

type ActionResult = { success: boolean; error?: string; message?: string };

async function ipHash() {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim();
  return ip ? createHash('sha256').update(ip).digest('hex').slice(0, 32) : 'unknown';
}

export async function loginAdminAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const remember = formData.get('rememberMe') === 'on';

  if (!email || !password) return { success: false, error: 'Email dan password wajib diisi' };

  // AU-04: rate-limit RPCs are service_role only, so a client cannot reset its own counter.
  const service = createAdminSupabaseClient();
  const ip = await ipHash();
  const { data: allowed } = await service.rpc('check_admin_login_allowed', { p_identifier: email, p_ip_hash: ip });
  // Fail-closed: block if false or if the RPC errored (null).
  if (allowed !== true) {
    return { success: false, error: 'Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.' };
  }
  const record = (ok: boolean) =>
    service.rpc('record_admin_login_attempt', { p_identifier: email, p_ip_hash: ip, p_success: ok });

  // Set before signIn so the auth cookies written below already honour it.
  const jar = await cookies();
  if (remember) jar.delete(REMEMBER_COOKIE);
  else jar.set(REMEMBER_COOKIE, '0', { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' });

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await record(false);
    return { success: false, error: 'Email atau password salah' };
  }

  const { data: adminRow } = await supabase.from('admins').select('status').eq('user_id', data.user.id).maybeSingle();
  if (!adminRow || adminRow.status !== 'active') {
    await supabase.auth.signOut();
    if (!adminRow) {
      await record(false);
      return { success: false, error: 'Akun ini tidak terdaftar sebagai admin' };
    }
    return {
      success: false,
      error:
        adminRow.status === 'pending'
          ? 'Akun kamu masih menunggu persetujuan super admin'
          : 'Akun kamu ditolak atau dinonaktifkan. Hubungi super admin.',
    };
  }

  await record(true);
  redirect(safeAdminRedirect(String(formData.get('redirect') || '')));
}

export async function registerAdminAction(formData: FormData): Promise<ActionResult> {
  const username = String(formData.get('username') || '').trim().toLowerCase();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (!USERNAME_RE.test(username)) {
    return { success: false, error: 'Username 3 sampai 32 karakter: huruf kecil, angka, titik, atau garis bawah' };
  }
  if (!EMAIL_RE.test(email)) return { success: false, error: 'Format email tidak valid' };
  const pwErr = passwordProblem(password);
  if (pwErr) return { success: false, error: pwErr };
  if (password !== confirmPassword) return { success: false, error: 'Konfirmasi password tidak cocok' };

  const service = createAdminSupabaseClient();
  const { data: taken } = await service.from('admins').select('id').eq('username', username).maybeSingle();
  if (taken) return { success: false, error: 'Username sudah dipakai, pilih yang lain' };

  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError || !authData.user) {
    if (/already|exists|registered/i.test(authError?.message || '')) {
      return { success: false, error: 'Email sudah terdaftar' };
    }
    return { success: false, error: 'Pendaftaran gagal, coba lagi' };
  }

  // Role and status are fixed server-side, never read from the form (no self-approval).
  // ponytail: if this insert fails the auth user is orphaned (cannot log in as admin);
  // clean up with auth.admin.deleteUser once real GoTrue replaces the local gateway.
  const { error: insertError } = await service
    .from('admins')
    .insert({ user_id: authData.user.id, username, role: 'admin', status: 'pending' });
  await supabase.auth.signOut();
  if (insertError) return { success: false, error: 'Gagal menyimpan permohonan admin, coba lagi' };

  return { success: true, message: 'Permohonan kamu sudah dikirim dan menunggu persetujuan super admin.' };
}

type SuperRpc =
  | { fn: 'rpc_approve_admin_request'; args: { p_admin_id: string } }
  | { fn: 'rpc_reject_admin_request'; args: { p_admin_id: string; p_reason: string | null } }
  | { fn: 'rpc_update_admin_role'; args: { p_admin_id: string; p_new_role: string } }
  | { fn: 'rpc_toggle_admin_status'; args: { p_admin_id: string; p_new_status: string } };

// Defence in depth: the action checks the role, then the SECURITY DEFINER RPC checks again.
async function superAdminRpc(call: SuperRpc): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
  } catch {
    return { success: false, error: 'Akses ditolak: hanya super admin' };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(call.fn, call.args as never);
  if (error) {
    return { success: false, error: /super admin aktif/.test(error.message) ? error.message : 'Aksi gagal, coba lagi' };
  }
  const res = data as { success?: boolean; error?: string } | null;
  if (!res?.success) return { success: false, error: res?.error || 'Aksi gagal' };
  revalidatePath('/admin/kelola-admin');
  return { success: true };
}

export async function approveAdminAction(adminId: string) {
  return superAdminRpc({ fn: 'rpc_approve_admin_request', args: { p_admin_id: adminId } });
}

export async function rejectAdminAction(adminId: string, reason?: string) {
  return superAdminRpc({
    fn: 'rpc_reject_admin_request',
    args: { p_admin_id: adminId, p_reason: reason?.trim().slice(0, 500) || null },
  });
}

export async function updateAdminRoleAction(adminId: string, newRole: AdminRole) {
  return superAdminRpc({ fn: 'rpc_update_admin_role', args: { p_admin_id: adminId, p_new_role: newRole } });
}

export async function toggleAdminStatusAction(adminId: string, newStatus: AdminStatus) {
  return superAdminRpc({ fn: 'rpc_toggle_admin_status', args: { p_admin_id: adminId, p_new_status: newStatus } });
}

export async function logoutAdminAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  (await cookies()).delete(REMEMBER_COOKIE);
  redirect('/admin/login');
}
