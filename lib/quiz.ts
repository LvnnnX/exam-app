import { supabase, EXAM_SECRET_KEY } from './supabase';
import { type PublicQuestion, type ShuffledQuestion, shuffleOptions } from './questions';

// Safe columns list — excludes question_ids (VULN-01 fix)
const KUIS_SAFE_COLUMNS = 'id, quiz_code, mapel, bab, sub_bab, question_count, duration_minutes, status, created_at, started_at, finished_at, expires_at, paused_at, scheduled_at';
export const QUIZ_CODE_LENGTH = 6;

const QUIZ_CODE_ALPHABET = '0123456789';

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

type LiveQuizQuestionRpcResult = {
  success: boolean;
  error?: string;
  data: PublicQuestion;
};

type SubmitLiveQuizAnswerRpcResult = {
  success?: boolean;
  is_correct?: boolean;
};

type QuizHistoryRow = KuisLog & {
  player?: Player[];
};

type QuizStatusUpdates = Partial<Pick<KuisLog, 'status' | 'started_at' | 'finished_at' | 'paused_at' | 'expires_at' | 'scheduled_at'>>;

export function normalizeQuizCode(value: string): string {
  return String(value ?? '')
    .replace(/[^0-9]/g, '')
    .slice(0, QUIZ_CODE_LENGTH);
}

function generateQuizCode(length = QUIZ_CODE_LENGTH): string {
  const cryptoObject = globalThis.crypto;
  const randomBytes = cryptoObject?.getRandomValues
    ? cryptoObject.getRandomValues(new Uint8Array(length))
    : Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));

  return Array.from(randomBytes, (byte) => QUIZ_CODE_ALPHABET[byte % QUIZ_CODE_ALPHABET.length]).join('');
}

// Admin: Create a new Quiz Live Session
export async function createQuizSession(
  mapel: string | string[],
  bab: string | string[],
  subBabs: string[],
  questionCount: number,
  durationMinutes: number,
  scheduledAt?: string,
  percentages?: Record<string, number>
): Promise<KuisLog | null> {
  const code = generateQuizCode();
  let questionIds: number[] = [];

  const isAllSubBabs = subBabs.length === 0 || subBabs.includes('Semua Sub-bab');

  let targetSubBabs = subBabs;
  let activePercentages = percentages;

  if (!percentages) {
    // If toggle OFF, distribute equally.
    // If "Semua Sub-bab", fetch ALL sub-babs from visible questions.
    if (isAllSubBabs) {
      let q = supabase.from('public_categories').select('sub_babs');
      const mapels = Array.isArray(mapel) ? mapel : [mapel];
      const filteredMapels = mapels.filter(m => m !== 'None' && m !== 'Semua MAPEL');
      if (filteredMapels.length > 0) {
        q = q.overlaps('mapels', filteredMapels);
      }

      const babs = Array.isArray(bab) ? bab : [bab];
      const filteredBabs = babs.filter(b => b !== 'None' && b !== 'Semua BAB');
      if (filteredBabs.length > 0) {
        q = q.overlaps('babs', filteredBabs);
      }

      const { data } = await q;
      if (data) {
        const allSubs = new Set<string>();
        data.forEach(row => {
          if (row.sub_babs) row.sub_babs.forEach((s: string) => allSubs.add(s));
        });
        targetSubBabs = Array.from(allSubs);
      }
    }

    if (targetSubBabs.length > 0) {
      activePercentages = {};
      const equal = 100 / targetSubBabs.length;
      targetSubBabs.forEach(s => activePercentages![s] = equal);
    }
  }

  if (activePercentages && targetSubBabs.length > 0) {
    // Fetch with percentages
    const pool = new Set<number>();

    for (const sub of targetSubBabs) {
      let query = supabase.from('questions').select('id').eq('is_hidden', false);

      const mapels = Array.isArray(mapel) ? mapel : [mapel];
      const filteredMapels = mapels.filter(m => m !== 'None' && m !== 'Semua MAPEL');
      if (filteredMapels.length > 0) {
        query = query.overlaps('mapels', filteredMapels);
      }

      const babs = Array.isArray(bab) ? bab : [bab];
      const filteredBabs = babs.filter(b => b !== 'None' && b !== 'Semua BAB');
      if (filteredBabs.length > 0) {
        query = query.overlaps('babs', filteredBabs);
      }

      query = query.contains('sub_babs', [sub]);

      const { data } = await query;
      if (data) {
        const ids = data.map(q => q.id as number);
        ids.forEach(id => pool.add(id));

        const pct = activePercentages[sub] || 0;
        const count = Math.round(questionCount * (pct / 100));

        // Filter out already selected IDs to avoid duplicates across sub-chapters
        const availableIds = ids.filter(id => !questionIds.includes(id));
        const shuffled = availableIds.sort(() => 0.5 - Math.random()).slice(0, count);
        questionIds.push(...shuffled);
      }
    }

    // Fallback if we don't have enough questions due to overlap or small pool
    if (questionIds.length < questionCount) {
      const remainingNeeded = questionCount - questionIds.length;
      const unusedPool = Array.from(pool).filter(id => !questionIds.includes(id));
      const fallback = unusedPool.sort(() => 0.5 - Math.random()).slice(0, remainingNeeded);
      questionIds.push(...fallback);
    }

    // Slice just in case it exceeded due to rounding
    questionIds = questionIds.slice(0, questionCount);
    // Shuffle final array
    questionIds.sort(() => 0.5 - Math.random());

  } else {
    // Failsafe: Fetch without percentages or subbabs
    let query = supabase.from('questions').select('id').eq('is_hidden', false);

    if (mapel !== 'None' && mapel !== 'Semua MAPEL') {
      query = query.contains('mapels', [mapel]);
    }
    if (bab !== 'None' && bab !== 'Semua BAB') {
      query = query.contains('babs', [bab]);
    }

    const { data: qData, error: qErr } = await query;
    if (qErr || !qData) {
      console.error('Error fetching questions for quiz:', qErr);
      return null;
    }

    const shuffled = qData.sort(() => 0.5 - Math.random()).slice(0, questionCount);
    questionIds = shuffled.map(q => q.id);
  }

  const actualQuestionCount = questionIds.length;
  if (actualQuestionCount === 0) {
    console.error('No questions found for the given criteria.');
    return null;
  }

  const isAllMapels = !mapel || (Array.isArray(mapel) && mapel.length === 0) || (typeof mapel === 'string' && mapel === 'Semua MAPEL');
  const isAllBabs = !bab || (Array.isArray(bab) && bab.length === 0) || (typeof bab === 'string' && bab === 'Semua BAB');

  const insertData: Record<string, unknown> = {
    quiz_code: code,
    mapel: isAllMapels ? 'Semua MAPEL' : (Array.isArray(mapel) ? mapel.join(', ') : mapel),
    bab: isAllBabs ? 'Semua BAB' : (Array.isArray(bab) ? bab.join(', ') : bab),
    sub_bab: isAllSubBabs ? 'Semua Sub-bab' : subBabs.join(', '),
    question_count: actualQuestionCount,
    duration_minutes: durationMinutes,
    status: 'waiting',
    question_ids: questionIds,
  };
  if (scheduledAt) {
    insertData.scheduled_at = scheduledAt;
  }

  const { data, error } = await supabase
    .from('kuis_logs')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error('Error creating quiz session:', error);
    return null;
  }
  return data;
}

// Schedule or update schedule for a waiting quiz
export async function updateQuizSchedule(id: string, scheduledAt: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('kuis_logs')
    .update({ scheduled_at: scheduledAt })
    .eq('id', id)
    .eq('status', 'waiting');

  if (error) {
    console.error('Error updating quiz schedule:', error);
    return false;
  }
  return true;
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
    const rawData = (result as any).scrambled ? unscramble((result as any).scrambled) : result.data;
    if (!rawData) return null;

    return shuffleOptions(rawData);
  } catch (err: any) {
    console.error('JIT fetch action failed:', err.message);
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
  } catch (err: any) {
    console.error('Security verification action failed:', err.message);
    return { success: false, error: err.message };
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

// Admin actions
export async function updateQuizStatus(id: string, status: KuisStatus): Promise<boolean> {
  const { data: current } = await supabase.from('kuis_logs').select('*').eq('id', id).single();
  if (!current) return false;

  const updates: QuizStatusUpdates = { status };
  const now = new Date().toISOString();

  if (status === 'active') {
    if (current.status === 'waiting') {
      updates.started_at = now;
      // Set expires_at to the end of the quiz duration
      updates.expires_at = new Date(new Date().getTime() + current.duration_minutes * 60000).toISOString();
    } else if (current.status === 'paused' && current.paused_at && current.started_at) {
      // Calculate how long it was paused and shift started_at and expires_at
      const pauseDuration = new Date().getTime() - new Date(current.paused_at).getTime();
      const newStartedAt = new Date(new Date(current.started_at).getTime() + pauseDuration).toISOString();
      updates.started_at = newStartedAt;
      if (current.expires_at) {
        updates.expires_at = new Date(new Date(current.expires_at).getTime() + pauseDuration).toISOString();
      }
      updates.paused_at = undefined;
    }
  } else if (status === 'paused') {
    updates.paused_at = now;
  } else if (status === 'finished') {
    updates.finished_at = now;
  }

  const { error } = await supabase
    .from('kuis_logs')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating quiz status:', error);
    return false;
  }

  return true;
}

export async function deleteQuizSession(id: string): Promise<boolean> {
  const { error } = await supabase.from('kuis_logs').delete().eq('id', id);
  if (error) {
    console.error('Error deleting quiz:', error);
    return false;
  }
  return true;
}

export async function fetchQuizPlayers(kuisId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from('player')
    .select('*')
    .eq('kuis_id', kuisId)
    .order('score', { ascending: false })
    .order('total_time', { ascending: true });

  if (error) return [];
  return data;
}

export async function fetchQuizHistory(): Promise<KuisLog[]> {
  const { data, error } = await supabase
    .from('kuis_logs')
    .select('*, player(name, score, total_time)')
    .eq('status', 'finished')
    .order('created_at', { ascending: false });

  if (error) return [];
  const rows = (data || []) as QuizHistoryRow[];

  return rows.map((row) => {
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
}

export async function fetchActiveSessions(): Promise<KuisLog[]> {
  // Delete quizzes that were never started and are older than 2 days
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  await supabase
    .from('kuis_logs')
    .delete()
    .eq('status', 'waiting')
    .lt('created_at', twoDaysAgo.toISOString());

  const { data, error } = await supabase
    .from('kuis_logs')
    .select('*, player:player(count)')
    .in('status', ['waiting', 'active', 'paused'])
    .order('created_at', { ascending: false });

  if (error) return [];

  const now = Date.now();
  const results: KuisLog[] = [];

  for (const d of data) {
    const createdAt = new Date(d.created_at);
    const expiresAt = d.expires_at ? new Date(d.expires_at) : new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000);

    // Auto-finish expired sessions
    if (d.status === 'active' && expiresAt.getTime() <= now) {
      await updateQuizStatus(d.id, 'finished');
      continue; // Skip — it's now in history
    }

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
