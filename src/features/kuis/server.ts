import { createServerSupabaseClient, createAdminSupabaseClient } from '@/src/lib/supabase-server';
import type {
  Quiz,
  QuizStreamState,
  LivePlayerProgress,
  CreateQuizInput,
  QuizQuestionJit,
  PlayerAnswerDetail,
} from './types';

type RpcCaller = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function createQuiz(input: CreateQuizInput) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_create_quiz', {
    p_topic_ids: input.topic_ids,
    p_question_count: input.question_count,
    p_duration_minutes: input.duration_minutes,
    p_quiz_mode: input.quiz_mode,
    p_allow_mid_game: input.allow_join_mid_game,
    p_weights: input.weights || {},
  });

  if (error) throw new Error(error.message);
  const result = (data as unknown) as { success: boolean; error?: string; quiz_id?: string; code?: string };
  if (!result.success) throw new Error(result.error || 'Gagal membuat sesi kuis');

  return result;
}

export async function updateQuizStatus(quizId: string, action: 'start' | 'pause' | 'resume' | 'finish' | 'cancel') {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_admin_update_quiz_status', {
    p_quiz_id: quizId,
    p_action: action,
  });

  if (error) throw new Error(error.message);
  const result = (data as unknown) as { success: boolean; error?: string; status?: string };
  if (!result.success) throw new Error(result.error || 'Gagal memperbarui status kuis');

  return result;
}

export async function getQuizByCode(code: string): Promise<Quiz | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('code', code.trim())
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as Quiz;
}

export async function getQuizById(id: string): Promise<Quiz | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as Quiz;
}

export async function listActiveQuizzes(): Promise<Quiz[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .in('status', ['waiting', 'active', 'paused'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as Quiz[];
}

export async function listQuizHistory(limit = 30): Promise<Quiz[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .in('status', ['finished', 'cancelled'])
    .order('finished_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []) as unknown as Quiz[];
}

export async function getQuizStreamState(code: string): Promise<QuizStreamState | null> {
  const supabase = createAdminSupabaseClient();
  const { data: quizData, error: qErr } = await supabase
    .from('quizzes')
    .select('*')
    .eq('code', code.trim())
    .maybeSingle();

  if (qErr || !quizData) return null;
  const quiz = quizData as unknown as Quiz;

  // Fetch players with score & answered count
  const { data: playersData, error: pErr } = await supabase
    .from('players')
    .select('id, name, skin, score, total_time, current_index, question_order, joined_at, finished_at')
    .eq('quiz_id', quiz.id)
    .order('score', { ascending: false })
    .order('total_time', { ascending: true })
    .order('joined_at', { ascending: true });

  if (pErr) throw new Error(pErr.message);

  const players: LivePlayerProgress[] = (playersData || []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    name: String(p.name),
    skin: (p.skin as string) || null,
    score: Number(p.score) || 0,
    total_time: Number(p.total_time) || 0,
    current_index: Number(p.current_index) || 0,
    total_questions: Array.isArray(p.question_order) ? p.question_order.length : 0,
    is_finished: Boolean(p.finished_at),
    finished_at: (p.finished_at as string) || null,
    joined_at: String(p.joined_at),
    answers_count: Number(p.current_index) || 0,
  }));

  return {
    quiz,
    players,
    server_time: new Date().toISOString(),
  };
}

export async function joinLiveQuiz(code: string, name: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc('rpc_join_live_quiz', {
    p_quiz_code: code,
    p_name: name,
  });

  if (error) throw new Error(error.message);
  const result = data as {
    success: boolean;
    error?: string;
    player_id?: string;
    quiz_id?: string;
    name?: string;
    skin?: string;
    question_count?: number;
  };
  if (!result.success) throw new Error(result.error || 'Gagal bergabung dengan kuis');

  return result;
}

export async function getQuizQuestion(playerId: string, index: number): Promise<QuizQuestionJit> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await ((supabase as unknown) as RpcCaller).rpc('rpc_get_quiz_question', {
    p_player_id: playerId,
    p_index: index,
  });

  if (error) throw new Error(error.message);
  const res = (data as unknown) as { success: boolean; error?: string; data?: QuizQuestionJit };
  if (!res.success || !res.data) throw new Error(res.error || 'Gagal mengambil soal');

  return res.data;
}

export async function submitQuizAnswer(
  playerId: string,
  index: number,
  questionId: number,
  userAnswer: string,
  timeTaken: number
) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc('rpc_submit_quiz_answer', {
    p_player_id: playerId,
    p_index: index,
    p_question_id: questionId,
    p_user_answer: userAnswer,
    p_time_taken: timeTaken,
  });

  if (error) throw new Error(error.message);
  const res = data as { success: boolean; error?: string; is_correct?: boolean };
  if (!res.success) throw new Error(res.error || 'Gagal mengirim jawaban');

  return res;
}

export async function finishQuizPlayer(playerId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc('rpc_finish_quiz_player', {
    p_player_id: playerId,
  });

  if (error) throw new Error(error.message);
  const res = data as { success: boolean; error?: string };
  if (!res.success) throw new Error(res.error || 'Gagal menyelesaikan kuis');

  return res;
}

export async function setPlayerSkin(playerId: string, skin: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc('rpc_set_player_skin', {
    p_player_id: playerId,
    p_skin: skin,
  });

  if (error) throw new Error(error.message);
  const res = data as { success: boolean; error?: string; skin?: string };
  if (!res.success) throw new Error(res.error || 'Gagal mengubah tunggangan');

  return res;
}

export async function getPlayerAnswers(playerId: string): Promise<PlayerAnswerDetail[]> {
  const supabase = createAdminSupabaseClient();
  // Fetch answers + question details for admin or finished player
  const { data, error } = await supabase
    .from('answers')
    .select(`
      question_id,
      user_answer,
      is_correct,
      time_taken,
      questions (
        id,
        body_html,
        answer_key
      )
    `)
    .eq('player_id', playerId)
    .order('answered_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((row: Record<string, unknown>, idx: number) => {
    const q = (row.questions as Record<string, unknown>) || {};
    return {
      question_id: Number(row.question_id),
      question_number: idx + 1,
      body_html: (q.body_html as string) || '',
      user_answer: (row.user_answer as string) || null,
      correct_answer: (q.answer_key as string) || null,
      is_correct: Boolean(row.is_correct),
      time_taken: Number(row.time_taken) || 0,
    };
  });
}
