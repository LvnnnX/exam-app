import { supabase } from './supabase';
import { type PublicQuestion, type ShuffledQuestion, shuffleOptions } from './questions';

// Safe columns list — excludes question_ids (VULN-01 fix)
const KUIS_SAFE_COLUMNS = 'id, quiz_code, mapel, bab, sub_bab, question_count, duration_minutes, status, created_at, started_at, finished_at, expires_at, paused_at, scheduled_at, quiz_mode, allow_join_mid_game';
export const QUIZ_CODE_LENGTH = 6;

export type KuisStatus = 'waiting' | 'active' | 'finished' | 'paused';

export type KuisLog = {
  id: string;
  quiz_code: string;
  mapel: string;
  bab: string;
  sub_bab: string;
  question_count: number;
  duration_minutes: number;
  status: KuisStatus;
  question_ids?: number[];
  created_at: string;
  started_at?: string;
  finished_at?: string;
  player_count?: number;
  winner?: string;
  top_score?: number;
  expires_at?: string;
  paused_at?: string;
  scheduled_at?: string;
  quiz_mode?: 'strict' | 'standard';
  allow_join_mid_game?: boolean;
};

export type Player = {
  id: string;
  kuis_id: string;
  name: string;
  score: number;
  total_time: number;
  joined_at: string;
  finished_at?: string;
  question_ids?: number[];
  horse_skin?: string | null;
};

export type KuisResult = {
  id: string;
  player_id: string;
  question_id: number;
  user_answer: string;
  is_correct: boolean;
  time_taken: number;
  answered_at: string;
};

type JoinLiveQuizRpcResult = {
  success: boolean;
  message?: string;
  player_id: string;
};

export function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  const parts = [];
  if (h > 0) parts.push(`${h} Jam`);
  if (m > 0) parts.push(`${m} Menit`);
  if (s > 0 || (h === 0 && m === 0)) parts.push(`${s} Detik`);
  
  return parts.join(' ');
}

type ScrambledQuestionPayload = {
  scrambled?: string;
  data?: PublicQuestion;
};

type QuizHistoryRow = KuisLog & {
  player?: Player[];
};

export function normalizeQuizCode(value: string): string {
  return String(value ?? '')
    .replace(/[^0-9]/g, '')
    .slice(0, QUIZ_CODE_LENGTH);
}

export async function fetchQuizByCode(code: string): Promise<KuisLog | null> {
  const normalizedCode = normalizeQuizCode(code);

  const { data, error } = await supabase
    .from('public_kuis_logs')
    .select(KUIS_SAFE_COLUMNS)
    .eq('quiz_code', normalizedCode)
    .single();

  if (error) return null;
  return data;
}

export async function joinLiveQuiz(code: string, name: string): Promise<Player | { error: string }> {
  const normalizedCode = normalizeQuizCode(code);

  // Ensure we have a valid auth session for RLS
  const { data: { session: currentSession } } = await supabase.auth.getSession();

  if (!currentSession) {
    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) {
      console.error('Auth failed:', signInError);
      return { error: 'Gagal mengamankan sesi kuis.' };
    }
  }

  const { data, error } = await supabase.rpc('join_live_quiz', {
    p_quiz_code: normalizedCode,
    p_name: name
  });

  if (error) {
    console.error('Join RPC failed:', error.message);
    return { error: error.message };
  }

  const result = data as JoinLiveQuizRpcResult | null;
  if (!result || !result.success) {
    return { error: result?.message || 'Gagal bergabung kuis.' };
  }

  const { data: player, error: fetchError } = await supabase
    .from('public_players')
    .select('*')
    .eq('id', result.player_id)
    .single();

  if (fetchError || !player) {
    return { error: 'Gagal mengambil data pemain.' };
  }

  return { ...player, question_ids: [] } as Player;
}

export async function updatePlayerHorseSkin(playerId: string, horseSkin: string): Promise<{ horse_skin: string } | { error: string }> {
  const { data, error } = await supabase.rpc('set_player_horse_skin', {
    p_player_id: playerId,
    p_horse_skin: horseSkin,
  });

  if (error) {
    console.error('Update horse skin failed:', error.message);
    return { error: error.message };
  }

  const result = data as { success?: boolean; message?: string; horse_skin?: string } | null;
  if (!result?.success || !result.horse_skin) {
    return { error: result?.message || 'Gagal mengubah skin kuda.' };
  }

  return { horse_skin: result.horse_skin };
}

import { getLiveQuizQuestionAction, submitLiveQuizAnswerAction } from '@/app/actions/exam';
import { scramble, unscramble } from './crypto';

export async function getJitQuestion(playerId: string, index: number): Promise<ShuffledQuestion | null> {
  try {
    const result = await getLiveQuizQuestionAction(playerId, index);
    if (!result || !result.success) {
      console.error('JIT fetch logic failed:', result?.error || 'Unknown error');
      return null;
    }
    
    // Unscramble the data from the server
    const payload = result as ScrambledQuestionPayload;
    const rawData = payload.scrambled
      ? unscramble<PublicQuestion>(payload.scrambled)
      : payload.data;
    if (!rawData) return null;

    return shuffleOptions(rawData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('JIT fetch action failed:', message);
    return null;
  }
}

export async function submitSecureAnswer(
  playerId: string,
  questionId: number,
  userAnswer: string,
  timeTaken: number,
  index: number
): Promise<{ success: boolean; is_correct?: boolean; error?: string }> {
  try {
    // Scramble the answer before sending to server
    const scrambled = scramble(userAnswer);
    
    const result = await submitLiveQuizAnswerAction(playerId, questionId, scrambled, timeTaken, index);
    return {
      success: result?.success || false,
      is_correct: result?.is_correct,
      error: result?.error
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Security verification action failed:', message);
    return { success: false, error: message };
  }
}

export async function finishPlayerQuiz(playerId: string): Promise<void> {
  const { error } = await supabase.rpc('finish_player_quiz_rpc', {
    p_player_id: playerId
  });
  if (error) {
    console.error('Failed to finish player quiz:', error.message);
  }
}

export async function fetchQuizPlayers(kuisId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('public_players')
    .select('*')
    .eq('kuis_id', kuisId)
    .order('score', { ascending: false })
    .order('total_time', { ascending: true });

  if (error) return [];
  return data;
}

export async function fetchPlayerQuestionIds(playerId: string): Promise<number[]> {
  const { data, error } = await supabase.rpc('get_player_question_ids_admin', {
    p_player_id: playerId
  });
  if (error) {
    console.error('Error fetching player question ids:', error);
    return [];
  }
  return data as number[];
}

type QuizHistoryCache = {
  rows: KuisLog[];
  lastCreatedAt: string | null;
  fetchedAt: number;
  limit: number;
};

let quizHistoryCache: QuizHistoryCache | null = null;
const QUIZ_HISTORY_TTL_MS = 5 * 60 * 1000; // 5 minutes
const QUIZ_HISTORY_DEFAULT_LIMIT = 200;

export function invalidateQuizHistoryCache() {
  quizHistoryCache = null;
}

export async function fetchQuizHistory(options?: { force?: boolean; limit?: number }): Promise<KuisLog[]> {
  const force = options?.force ?? false;
  const limit = options?.limit ?? QUIZ_HISTORY_DEFAULT_LIMIT;
  const now = Date.now();

  // Use cache only if non-forced, fresh, and same limit
  if (!force && quizHistoryCache && quizHistoryCache.limit === limit && now - quizHistoryCache.fetchedAt < QUIZ_HISTORY_TTL_MS) {
    return quizHistoryCache.rows;
  }

  // Incremental fetch: only get rows newer than the latest cached entry (when limit unchanged)
  let query = supabase
    .from('kuis_logs')
    .select('*, player(name, score, total_time)')
    .eq('status', 'finished')
    .order('created_at', { ascending: false })
    .limit(limit);

  const incremental = !force && quizHistoryCache?.lastCreatedAt && quizHistoryCache.limit === limit;
  if (incremental) {
    query = query.gt('created_at', quizHistoryCache!.lastCreatedAt!);
  }

  const { data, error } = await query;

  if (error) return quizHistoryCache?.rows ?? [];
  const rows = (data || []) as QuizHistoryRow[];

  const mapped = rows.map((row) => {
    const players = row.player || [];
    const sorted = [...players].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.total_time - b.total_time;
    });
    return {
      ...row,
      player_count: players.length,
      winner: sorted[0]?.name || '-',
      top_score: sorted[0]?.score || 0
    };
  });

  // Merge with cache (incremental) or replace (full fetch); cap to limit
  let merged: KuisLog[];
  if (incremental && quizHistoryCache) {
    merged = [...mapped, ...quizHistoryCache.rows].slice(0, limit);
  } else {
    merged = mapped;
  }

  quizHistoryCache = {
    rows: merged,
    lastCreatedAt: merged[0]?.created_at ?? null,
    fetchedAt: now,
    limit,
  };

  return merged;
}

export async function fetchActiveSessions(): Promise<KuisLog[]> {
  const { data, error } = await supabase
    .from('kuis_logs')
    .select('*, player:player(count)')
    .in('status', ['waiting', 'active', 'paused'])
    .order('created_at', { ascending: false });

  if (error) return [];

  const results: KuisLog[] = [];

  for (const d of data) {
    const createdAt = new Date(d.created_at);
    const expiresAt = d.expires_at ? new Date(d.expires_at) : new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000);

    results.push({
      ...d,
      player_count: d.player?.[0]?.count || 0,
      expires_at: expiresAt.toISOString()
    });
  }

  return results;
}

export async function fetchPlayerAnswers(playerId: string): Promise<KuisResult[]> {
  const { data, error } = await supabase
    .from('kuis_results')
    .select('*')
    .eq('player_id', playerId)
    .order('answered_at', { ascending: true });

  if (error) return [];
  return data;
}
