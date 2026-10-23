import { createServerSupabaseClient } from '@/src/lib/supabase-server';
import type { AdminListItem, CurrentAdmin } from './types';

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return null;

    const { data: adminRow, error: adminError } = await supabase
      .from('admins')
      .select('id, user_id, username, role, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError || !adminRow) return null;

    return {
      id: adminRow.id,
      userId: adminRow.user_id,
      email: user.email || '',
      username: adminRow.username,
      role: adminRow.role as CurrentAdmin['role'],
      status: adminRow.status as CurrentAdmin['status'],
    };
  } catch {
    return null;
  }
}

export async function requireActiveAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin || admin.status !== 'active') {
    throw new Error('Akses ditolak: Hanya admin aktif yang diizinkan');
  }
  return admin;
}

export async function requireSuperAdmin(): Promise<CurrentAdmin> {
  const admin = await requireActiveAdmin();
  if (admin.role !== 'super_admin') {
    throw new Error('Akses ditolak: Hanya super_admin yang diizinkan');
  }
  return admin;
}

export async function listAllAdmins(): Promise<AdminListItem[]> {
  await requireSuperAdmin();
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc('rpc_list_admins');
  if (error) {
    throw new Error('Gagal mengambil daftar admin: ' + error.message);
  }

  return (data as unknown as AdminListItem[]) || [];
}
