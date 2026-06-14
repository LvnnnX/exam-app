"use server";

import { getExamSecretKey, getSupabaseServer } from "@/lib/supabase";
import { type PublicQuestion } from "@/lib/questions";
import { scramble, unscramble } from "@/lib/crypto";

/**
 * Server Action to start a new exam session.
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
  const secret = getExamSecretKey();

  // Enforce 16-char limit at the boundary. Defense in depth: even though the
  // homepage input caps at 16, this server action is reachable from any
  // caller of lib/questions.ts. Trimming here keeps leaderboard/recap
  // rendering predictable across web and any future native client.
  const safeName = name.trim().slice(0, 16);

  const { data, error } = await supabase.rpc('start_exam_session', {
    p_name: safeName,
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
 * Returns a SCRAMBLED payload to hide it from DevTools.
 */
export async function getLiveQuizQuestionAction(playerId: string, index: number): Promise<{ success: boolean; error?: string; data: PublicQuestion | null; scrambled?: string }> {
  const supabase = getSupabaseServer();
  const secret = getExamSecretKey();
  
  const { data, error } = await supabase.rpc('get_live_quiz_question', {
    p_player_id: playerId,
    p_index: index,
    p_secret: secret
  }).single();

  if (error) {
    throw new Error(error.message);
  }

  // Scramble the data before sending to browser
  const result = data as { success: boolean; error?: string; data: PublicQuestion | null; scrambled?: string };
  if (result.success && result.data) {
    return { ...result, scrambled: scramble(result.data), data: null };
  }

  return result;
}

/**
 * Server Action to submit a live quiz answer.
 * Accepts an unscrambled answer from the client.
 */
export async function submitLiveQuizAnswerAction(
  playerId: string,
  questionId: number,
  scrambledAnswer: string,
  timeTaken: number,
  index: number
) {
  const supabase = getSupabaseServer();
  const secret = getExamSecretKey();
  
  // Unscramble the user's answer
  const userAnswer = unscramble(scrambledAnswer);
  if (userAnswer === null) {
    throw new Error("Invalid answer payload (Integrity Check Failed)");
  }
  
  const { data, error } = await supabase.rpc('submit_live_quiz_answer_v2', {
    p_player_id: playerId,
    p_question_id: questionId,
    p_user_answer: userAnswer,
    p_time_taken: timeTaken,
    p_index: index,
    p_secret: secret
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as { success: boolean; is_correct?: boolean; error?: string };
}
