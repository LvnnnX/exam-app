'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/src/lib/supabase-server';

export async function loginAdminAction(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return { success: false, error: 'Email dan password wajib diisi' };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { success: false, error: 'Email atau password salah' };
  }

  // Check admin status
  const { data: adminRow } = await supabase
    .from('admins')
    .select('role, status')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (!adminRow) {
    await supabase.auth.signOut();
    return { success: false, error: 'Akun ini bukan admin' };
  }

  if (adminRow.status === 'pending') {
    await supabase.auth.signOut();
    return { success: false, error: 'Pendaftaran admin kamu masih menunggu persetujuan super admin' };
  }

  if (adminRow.status === 'rejected') {
    await supabase.auth.signOut();
    return { success: false, error: 'Pendaftaran admin kamu ditolak' };
  }

  redirect('/admin/soal');
}

export async function logoutAdminAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
