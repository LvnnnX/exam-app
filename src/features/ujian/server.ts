// Data layer ujian mandiri (server only). OWNER: BE. Signature dikunci oleh actions.ts + types.ts.
import { createAdminSupabaseClient } from '@/src/lib/supabase-server';
import { validateStart } from './logic';
import { adminListResults, adminGetDetail } from './server-admin';
import type {
  CategorySubject,
  FinishReason,
  FinishResult,
  SaveAnswerResult,
  StartUjianInput,
  StartUjianResult,
  UjianQuestion,
  UjianRecap,
  UjianState,
} from './types';

export { adminListResults, adminGetDetail };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET_REGEX = /^[0-9a-f]{64}$/i;

type RpcCaller = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function assertSessionCredentials(sessionId: string, secret: string): void {
  if (!sessionId || !UUID_REGEX.test(sessionId) || !secret || !SECRET_REGEX.test(secret)) {
    throw new Error('Sesi tidak ditemukan');
  }
}

function assertIndex(index: number): void {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
    throw new Error('Indeks soal tidak valid');
  }
}

function translateRpcError(msg: string): string {
  if (msg.includes('Sesi tidak ditemukan')) return 'Sesi tidak ditemukan';
  if (msg.includes('Sesi sudah selesai')) return 'Sesi sudah selesai';
  if (msg.includes('Indeks soal tidak valid')) return 'Indeks soal tidak valid';
  if (msg.includes('Rekap hanya dapat dilihat')) return 'Rekap hanya dapat dilihat setelah ujian selesai';
  if (msg.includes('Mode strict') || msg.includes('berurutan')) return 'Soal harus dijawab berurutan';
  if (msg.includes('Waktu')) return 'Waktu ujian telah habis';
  return 'Terjadi kesalahan pada server';
}

export async function listCategories(): Promise<CategorySubject[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_get_available_categories', {});

  if (error) {
    console.error('[listCategories] rpc error:', error.message);
    throw new Error('Gagal memuat kategori soal');
  }

  const raw = (data || []) as CategorySubject[];
  return raw
    .map((s) => ({
      ...s,
      chapters: (s.chapters || [])
        .map((c) => ({
          ...c,
          topics: (c.topics || []).filter((t) => t.question_count > 0),
        }))
        .filter((c) => c.topics.length > 0),
    }))
    .filter((s) => s.chapters.length > 0);
}

export async function countQuestions(topicIds: string[]): Promise<number> {
  if (!Array.isArray(topicIds) || topicIds.length === 0) return 0;
  const validIds = topicIds.filter((id) => typeof id === 'string' && UUID_REGEX.test(id));
  if (validIds.length === 0) return 0;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_ujian_count', {
    p_topic_ids: validIds,
  });

  if (error) {
    console.error('[countQuestions] rpc error:', error.message);
    throw new Error('Gagal menghitung jumlah soal');
  }

  return Number(data) || 0;
}

export async function startSession(input: StartUjianInput): Promise<StartUjianResult> {
  const err = validateStart(input);
  if (err) throw new Error(err);

  const validTopicIds = (input.topic_ids || []).filter((id) => typeof id === 'string' && UUID_REGEX.test(id));
  if (validTopicIds.length === 0) {
    throw new Error('Pilih minimal satu sub-bab.');
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_ujian_start', {
    p_name: input.name.trim(),
    p_topic_ids: validTopicIds,
    p_mode: input.mode,
    p_nav_mode: input.nav_mode,
    p_count: input.question_count,
    p_time_limit_minutes: input.time_limit_minutes,
  });

  if (error) {
    console.error('[startSession] rpc error:', error.message);
    throw new Error('Gagal memulai sesi ujian');
  }

  const res = data as { success: boolean; error?: string; session_id?: string; secret?: string };
  if (!res.success || !res.session_id || !res.secret) {
    throw new Error(res.error || 'Gagal memulai sesi ujian');
  }

  return {
    session_id: res.session_id,
    secret: res.secret,
  };
}

export async function getState(sessionId: string, secret: string): Promise<UjianState> {
  assertSessionCredentials(sessionId, secret);

  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_ujian_state', {
    p_session_id: sessionId,
    p_secret: secret,
  });

  if (error) {
    console.error('[getState] rpc error:', error.message);
    throw new Error(translateRpcError(error.message));
  }

  return data as UjianState;
}

export async function getQuestion(sessionId: string, secret: string, index: number): Promise<UjianQuestion> {
  assertSessionCredentials(sessionId, secret);
  assertIndex(index);

  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_ujian_question', {
    p_session_id: sessionId,
    p_secret: secret,
    p_index: index,
  });

  if (error) {
    console.error('[getQuestion] rpc error:', error.message);
    throw new Error(translateRpcError(error.message));
  }

  return data as UjianQuestion;
}

export async function saveAnswer(
  sessionId: string,
  secret: string,
  index: number,
  answer: string | null,
  doubtful: boolean,
  timeTaken: number
): Promise<SaveAnswerResult> {
  assertSessionCredentials(sessionId, secret);
  assertIndex(index);

  const clampedTime = Math.max(0, Math.min(3600, Math.round(Number(timeTaken) || 0)));
  const cleanAnswer = typeof answer === 'string' ? answer.trim().slice(0, 500) || null : null;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_ujian_save', {
    p_session_id: sessionId,
    p_secret: secret,
    p_index: index,
    p_answer: cleanAnswer,
    p_doubtful: Boolean(doubtful),
    p_time_taken: clampedTime,
  });

  if (error) {
    console.error('[saveAnswer] rpc error:', error.message);
    throw new Error(translateRpcError(error.message));
  }

  return data as SaveAnswerResult;
}

export async function reportViolation(sessionId: string, secret: string): Promise<{ violation_count: number; finished: boolean }> {
  assertSessionCredentials(sessionId, secret);

  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_ujian_violation', {
    p_session_id: sessionId,
    p_secret: secret,
  });

  if (error) {
    console.error('[reportViolation] rpc error:', error.message);
    throw new Error(translateRpcError(error.message));
  }

  return data as { violation_count: number; finished: boolean };
}

export async function finishSession(sessionId: string, secret: string, reason: FinishReason): Promise<FinishResult> {
  assertSessionCredentials(sessionId, secret);
  if (!['submit', 'surrender', 'time_up'].includes(reason)) {
    throw new Error('Alasan selesai tidak valid');
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_ujian_finish', {
    p_session_id: sessionId,
    p_secret: secret,
    p_reason: reason,
  });

  if (error) {
    console.error('[finishSession] rpc error:', error.message);
    throw new Error(translateRpcError(error.message));
  }

  return data as FinishResult;
}

export async function getRecap(sessionId: string, secret: string): Promise<UjianRecap> {
  assertSessionCredentials(sessionId, secret);

  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_ujian_recap', {
    p_session_id: sessionId,
    p_secret: secret,
  });

  if (error) {
    console.error('[getRecap] rpc error:', error.message);
    throw new Error(translateRpcError(error.message));
  }

  return data as UjianRecap;
}
