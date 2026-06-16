"use server";

import { requirePermissionAnyOf } from "@/lib/admin-server";
import { getSupabaseServer } from "@/lib/supabase";

export type AttemptAnswerRow = {
  question_id: number;
  question_index: number;
  user_answer: string | null;
  is_correct: boolean;
};

export type AttemptDetailsResult = {
  user_answers: AttemptAnswerRow[];
  score: number;
  total_questions: number;
  started_at: string | null;
  submitted_at: string | null;
};

/**
 * Fetches the per-question answer breakdown for a single scheduled exam attempt.
 * Joins exam_logs (user_answers + question_ids) with questions (correct_answer)
 * using the service role to bypass RLS.
 */
export async function fetchAttemptAnswersAction(
  accessToken: string,
  attemptId: string
): Promise<AttemptDetailsResult | null> {
  // Verify caller has manage permission
  const { supabase: adminClient } = await requirePermissionAnyOf(accessToken, [
    "quiz:manage:any",
    "quiz:manage:own",
  ]);

  // Fetch the attempt row (has session_id, score, recap, etc.)
  const { data: attempt, error: attemptErr } = await adminClient
    .from("scheduled_exam_attempts")
    .select("id, session_id, score, started_at, submitted_at, scheduled_exam_id, recap")
    .eq("id", attemptId)
    .single();

  if (attemptErr || !attempt) return null;

  // Fetch question count from the scheduled exam
  const { data: exam, error: examErr } = await adminClient
    .from("scheduled_exams")
    .select("question_count")
    .eq("id", attempt.scheduled_exam_id)
    .single();

  if (examErr || !exam) return null;

  if (!attempt.session_id) {
    return {
      user_answers: [],
      score: attempt.score ?? 0,
      total_questions: exam.question_count,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
    };
  }

  // Use service role to read exam_logs (bypasses RLS)
  const supabaseService = getSupabaseServer();
  const { data: log, error: logErr } = await supabaseService
    .from("exam_logs")
    .select("user_answers, question_ids")
    .eq("session_id", attempt.session_id)
    .single();

  if (logErr || !log || !log.question_ids || !log.user_answers) {
    // exam_logs was deleted on submit — fall back to the stored recap on the attempt row
    const recapRows = (attempt as unknown as { recap?: { question_id?: number; user_answer?: string | null; is_correct?: boolean }[] }).recap ?? [];
    const recapAnswers: AttemptAnswerRow[] = recapRows
      .filter((r) => r.question_id != null)
      .map((r, idx) => ({
        question_id: r.question_id!,
        question_index: idx,
        user_answer: r.user_answer ?? null,
        is_correct: r.is_correct ?? false,
      }));
    return {
      user_answers: recapAnswers,
      score: attempt.score ?? 0,
      total_questions: exam.question_count,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
    };
  }

  const questionIds: number[] = log.question_ids;
  // user_answers is a JSONB object keyed by string index: { "0": "A", "1": "C", ... }
  const rawAnswers: Record<string, string> =
    typeof log.user_answers === "object" && !Array.isArray(log.user_answers)
      ? (log.user_answers as Record<string, string>)
      : {};

  // Fetch all question correct answers in one query
  const { data: questions, error: qErr } = await supabaseService
    .from("questions")
    .select("id, correct_answer, question_type, short_answer")
    .in("id", questionIds);

  if (qErr || !questions) {
    return {
      user_answers: [],
      score: attempt.score ?? 0,
      total_questions: exam.question_count,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
    };
  }

  const qMap = new Map(
    questions.map((q) => [
      q.id,
      { correct_answer: q.correct_answer as string, question_type: q.question_type as string, short_answer: q.short_answer as string | null },
    ])
  );

  const userAnswers: AttemptAnswerRow[] = questionIds.map((qid, idx) => {
    const userAnswer = rawAnswers[String(idx)] ?? null;
    const q = qMap.get(qid);
    let isCorrect = false;
    if (q && userAnswer !== null) {
      if (q.question_type === "short_answer") {
        isCorrect =
          userAnswer.trim().toLowerCase() ===
          (q.short_answer ?? "").trim().toLowerCase();
      } else {
        isCorrect =
          userAnswer.trim().toUpperCase() ===
          (q.correct_answer ?? "").trim().toUpperCase();
      }
    }
    return {
      question_id: qid,
      question_index: idx,
      user_answer: userAnswer,
      is_correct: isCorrect,
    };
  });

  return {
    user_answers: userAnswers,
    score: attempt.score ?? 0,
    total_questions: exam.question_count,
    started_at: attempt.started_at,
    submitted_at: attempt.submitted_at,
  };
}
