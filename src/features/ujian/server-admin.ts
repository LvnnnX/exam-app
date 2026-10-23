// Admin data layer for self-paced exam results (server only).
import { createAdminSupabaseClient } from '@/src/lib/supabase-server';
import { requireActiveAdmin } from '@/src/features/auth/server';
import type { AdminResultDetail, AdminResultFilter, AdminResultRow } from './types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type RpcCaller = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function adminListResults(filter: AdminResultFilter): Promise<AdminResultRow[]> {
  await requireActiveAdmin();

  const from = filter.from && DATE_REGEX.test(filter.from) ? filter.from : null;
  const to = filter.to && DATE_REGEX.test(filter.to) ? filter.to : null;
  const search = filter.search ? filter.search.trim().slice(0, 50) : null;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_admin_ujian_results', {
    p_from: from,
    p_to: to,
    p_search: search,
    p_limit: 200,
  });

  if (error) {
    console.error('[adminListResults] rpc error:', error.message);
    throw new Error('Gagal memuat daftar hasil ujian');
  }

  return (data || []) as AdminResultRow[];
}

export async function adminGetDetail(sessionId: string): Promise<AdminResultDetail> {
  await requireActiveAdmin();

  if (!UUID_REGEX.test(sessionId)) {
    throw new Error('ID sesi tidak valid');
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_admin_ujian_detail', {
    p_session_id: sessionId,
  });

  if (error) {
    console.error('[adminGetDetail] rpc error:', error.message);
    throw new Error('Sesi tidak ditemukan atau gagal memuat detail');
  }

  return data as AdminResultDetail;
}
