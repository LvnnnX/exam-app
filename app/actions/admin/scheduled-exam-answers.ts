"use server";

import { requirePermissionAnyOf } from "@/lib/admin-server";
import { getSupabaseServer } from "@/lib/supabase";
import { stripHtml } from "@/lib/questions";

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
 * Now reads directly from scheduled_exam_attempts.question_ids and user_answers.
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

  // Fetch the attempt row (has question_ids, user_answers, score, etc.)
  const { data: attempt, error: attemptErr } = await adminClient
    .from("scheduled_exam_attempts")
    .select("id, question_ids, user_answers, score, started_at, submitted_at, scheduled_exam_id")
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

  const questionIds: number[] = attempt.question_ids ?? [];
  const rawAnswers: Record<string, string> =
    typeof attempt.user_answers === "object" && !Array.isArray(attempt.user_answers)
      ? (attempt.user_answers as Record<string, string>)
      : {};

  if (questionIds.length === 0) {
    return {
      user_answers: [],
      score: attempt.score ?? 0,
      total_questions: exam.question_count,
      started_at: attempt.started_at,
      submitted_at: attempt.submitted_at,
    };
  }

  // Use service role to read questions (bypasses RLS)
  const supabaseService = getSupabaseServer();
  
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
          stripHtml(userAnswer).toLowerCase() ===
          stripHtml(q.short_answer ?? "").toLowerCase();
      } else {
        isCorrect =
          stripHtml(userAnswer).toUpperCase() ===
          stripHtml(q.correct_answer ?? "").toUpperCase();
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
