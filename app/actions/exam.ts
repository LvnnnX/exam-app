"use server";

import { getSupabaseServer } from "@/lib/supabase";
import { type PublicQuestion } from "@/lib/questions";

/**
 * Server Action to start a new exam session.
 * This runs on the server, so the x-exam-secret is never exposed to the client.
 */
export async function startExamSessionAction(
  name: string,
  mapels: string[],
  babs: string[],
  subBabs: string[],
  mode: string,
  count: number,
  timeLimitMinutes: number,
  userAgent: string
) {
  const supabase = getSupabaseServer();
  const secret = process.env.EXAM_SECRET_KEY || process.env.NEXT_PUBLIC_EXAM_SECRET_KEY || 'default-secret-key-123';
  
  const { data, error } = await supabase.rpc('start_exam_session', {
    p_name: name,
    p_mapels: mapels,
    p_babs: babs,
    p_sub_babs: subBabs,
    p_mode: mode,
    p_count: count,
    p_time_limit_minutes: timeLimitMinutes > 0 ? timeLimitMinutes : null,
    p_user_agent: userAgent,
    p_secret: secret
  }).single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to start exam session');
  }

  return data as { session_id: string; question_count: number; expires_at: string };
}

/**
 * Server Action to fetch a question JIT for live quiz.
 */
export async function getLiveQuizQuestionAction(playerId: string, index: number) {
  const supabase = getSupabaseServer();
  const secret = process.env.EXAM_SECRET_KEY || process.env.NEXT_PUBLIC_EXAM_SECRET_KEY || 'default-secret-key-123';
  
  const { data, error } = await supabase.rpc('get_live_quiz_question', {
    p_player_id: playerId,
    p_index: index,
    p_secret: secret
  }).single();

  if (error) {
    throw new Error(error.message);
  }

  return data as { success: boolean; error?: string; data: PublicQuestion };
}

/**
 * Server Action to submit a live quiz answer.
 */
export async function submitLiveQuizAnswerAction(
  playerId: string,
  questionId: number,
  userAnswer: string,
  timeTaken: number
) {
  const supabase = getSupabaseServer();
  const secret = process.env.EXAM_SECRET_KEY || process.env.NEXT_PUBLIC_EXAM_SECRET_KEY || 'default-secret-key-123';
  
  const { data, error } = await supabase.rpc('submit_live_quiz_answer_v2', {
    p_player_id: playerId,
    p_question_id: questionId,
    p_user_answer: userAnswer,
    p_time_taken: timeTaken,
    p_secret: secret
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as { success: boolean; is_correct?: boolean };
}
