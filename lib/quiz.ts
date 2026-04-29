import { supabase } from './supabase';
import { type PublicQuestion, type ShuffledQuestion, shuffleOptions } from './questions';

// Safe columns list — excludes question_ids (VULN-01 fix)
const KUIS_SAFE_COLUMNS = 'id, quiz_code, bab, sub_bab, question_count, duration_minutes, status, created_at, started_at, finished_at, expires_at, paused_at, scheduled_at';
export const QUIZ_CODE_LENGTH = 6;

const QUIZ_CODE_ALPHABET = '0123456789';

export type KuisStatus = 'waiting' | 'active' | 'finished' | 'paused';

export type KuisLog = {
  id: string;
  quiz_code: string;
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
export async function createQuizSession(bab: string, subBab: string, questionCount: number, durationMinutes: number, scheduledAt?: string): Promise<KuisLog | null> {
  const code = generateQuizCode();
  
  // Fetch random questions
  let query = supabase.from('questions').select('id');
  
  if (bab !== 'None' && bab !== 'Semua BAB') {
    query = query.contains('babs', [bab]);
  }
  if (subBab !== 'Semua Sub-bab') {
    query = query.contains('sub_babs', [subBab]);
  }
  
  const { data: qData, error: qErr } = await query;
  if (qErr || !qData) {
    console.error('Error fetching questions for quiz:', qErr);
    return null;
  }
  
  // Shuffle and pick
  const shuffled = qData.sort(() => 0.5 - Math.random()).slice(0, questionCount);
  const questionIds = shuffled.map(q => q.id);
  
  const insertData: Record<string, unknown> = {
    quiz_code: code,
    bab: bab,
    sub_bab: subBab,
    question_count: questionCount,
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
    .from('kuis_logs')
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
    .from('player')
    .select('*')
    .eq('id', result.player_id)
    .single();

  if (fetchError || !player) {
    return { error: 'Gagal mengambil data pemain.' };
  }

  return player;
}

export async function getJitQuestion(playerId: string, index: number): Promise<ShuffledQuestion | null> {
  const { data, error } = await supabase.rpc('get_live_quiz_question', {
    p_player_id: playerId,
    p_index: index
  });

  if (error) {
    console.error('JIT fetch failed:', error.message);
    return null;
  }

  const result = data as LiveQuizQuestionRpcResult | null;
  if (!result || !result.success) {
    console.error('JIT fetch logic failed:', result?.error || 'Unknown error');
    return null;
  }

  return shuffleOptions(result.data);
}

export async function submitSecureAnswer(
  playerId: string,
  questionId: number,
  userAnswer: string,
  timeTaken: number
): Promise<{ success: boolean; is_correct?: boolean }> {
  const { data, error } = await supabase.rpc('submit_live_quiz_answer_v2', {
    p_player_id: playerId,
    p_question_id: questionId,
    p_user_answer: userAnswer,
    p_time_taken: timeTaken
  });

  if (error) {
    console.error('Security verification failed:', error.message);
    return { success: false };
  }

  const result = data as SubmitLiveQuizAnswerRpcResult | null;
  return { 
    success: result?.success || false, 
    is_correct: result?.is_correct 
  };
}

export async function finishPlayerQuiz(playerId: string): Promise<void> {
  await supabase
    .from('player')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', playerId);
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
