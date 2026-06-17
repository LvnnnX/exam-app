"use server";

import { requirePermissionAnyOf } from "@/lib/admin-server";
import { normalizeCategorySlug } from "@/lib/categories";

/**
 * Fetches the full question data for a scheduled exam question pool.
 * Uses service role (bypasses RLS) — called when admin clicks "Lihat".
 */
export async function fetchScheduledExamQuestionsAction(
  questionIds: number[]
): Promise<number[]> {
  return questionIds; // IDs passed from exam row; questions fetched via getSessionQuestionViaRpc client-side
}

/**
 * Fetches full question objects for a scheduled exam pool.
 * Uses service role key (bypasses RLS).
 */
export async function fetchScheduledExamQuestionPoolAction(
  accessToken: string,
  questionIds: number[]
): Promise<import("@/lib/questions").RawQuestion[]> {
  const { supabase } = await requirePermissionAnyOf(accessToken, ["quiz:manage:any", "quiz:manage:own"]);
  if (!questionIds || questionIds.length === 0) return [];
  const { data, error } = await supabase
    .from('questions')
    .select(
      'id, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, question_type, short_answer, is_hidden, created_by, mapels, babs, sub_babs'
    )
    .in('id', questionIds);

  if (error || !data) return [];
  return data as import("@/lib/questions").RawQuestion[];
}

/**
 * Selects a random pool of visible question IDs for a scheduled exam.
 * Uses the service role key (bypasses RLS) — called by CreateFormCard
 * after admin authentication.
 *
 * All students in the same exam get the SAME question IDs in the SAME
 * order. Only option order is shuffled per-student (client-side).
 */
export async function selectRandomQuestionsAction(
  accessToken: string,
  params: {
    mapels: string[];
    babs: string[];
    subBabs: string[];
    count: number;
  }
): Promise<number[]> {
  const { supabase } = await requirePermissionAnyOf(accessToken, ["quiz:manage:any", "quiz:manage:own"]);
  const { mapels, babs, subBabs, count } = params;

  const safeMapels = mapels.map(normalizeCategorySlug);
  const safeBabs = babs.map(normalizeCategorySlug);
  const safeSubBabs = subBabs.map(normalizeCategorySlug);

  // Build OR filter: question must match at least one of mapel, bab, or subbab
  const orConditions: string[] = [
    ...safeMapels.map(m => `mapels.cs.{"${m}"}`),
    ...safeBabs.map(b => `babs.cs.{"${b}"}`),
    ...safeSubBabs.map(s => `sub_babs.cs.{"${s}"}`),
  ];

  const { data, error } = await supabase
    .from('questions')
    .select('id')
    .eq('is_hidden', false)
    .or(orConditions.join(','))
    .limit(500);

  if (error || !data || data.length === 0) {
    throw new Error('Tidak ada soal yang tersedia untuk pilihan ini.');
  }

  // Fisher-Yates shuffle
  const shuffled = [...data];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const ids = shuffled.slice(0, count).map(q => q.id as number);

  if (ids.length < count) {
    throw new Error(
      `Soal tidak cukup. Butuh ${count} soal, tersedia ${ids.length} soal.`
    );
  }

  return ids;
}

export type ScheduledExamRow = {
  id: string;
  title: string;
  created_by: string | null;
  created_at: string;
  mapels: string[];
  babs: string[];
  sub_babs: string[];
  mode: string;
  question_count: number;
  time_limit_minutes: number;
  window_start: string;
  window_end: string;
  attempt_mode: string;
  access_code: string | null;
  status: 'active' | 'scheduled' | 'expired';
  is_visible: boolean;
  nav_mode: string;
  sub_bab_percentages: Record<string, number> | null;
  question_ids: number[] | null;  // fixed pool — same for all students
  participant_count: number;  // students who have started this exam
};

export type ScheduledExamAttemptRow = {
  id: string;
  scheduled_exam_id: string;
  student_name: string;
  session_id: string | null;
  started_at: string;
  deadline_at: string | null;
  submitted_at: string | null;
  auto_submitted: boolean;
  score: number | null;
  current_question_index: number | null;
  live_score: number | null;
};

type CreateScheduledExamInput = {
  title: string;
  mapels: string[];
  babs: string[];
  subBabs: string[];
  mode: string;
  questionCount: number;
  timeLimitMinutes: number;
  windowStart: string;
  windowEnd: string;
  attemptMode: "single" | "retake";
  accessCode: string;
  navMode?: "strict" | "standard";
  subBabPercentages?: Record<string, number>;
  questionIds?: number[];  // pre-selected question IDs (null = auto-select at creation)
};

export type ScheduledExamHistoryRow = {
  id: string;
  title: string;
  created_by: string | null;
  created_at: string;
  mapels: string[];
  babs: string[];
  sub_babs: string[];
  mode: string;
  question_count: number;
  time_limit_minutes: number;
  window_start: string;
  window_end: string;
  attempt_mode: string;
  status: 'active' | 'scheduled' | 'expired';
  access_code: string | null;
  participant_count: number;
  avg_score: number | null;
  pass_rate: number | null;
};

export async function listScheduledExamsAction(
  accessToken: string
): Promise<ScheduledExamRow[]> {
  const { supabase, user, scope } = await requirePermissionAnyOf(accessToken, ["quiz:manage:any", "quiz:manage:own"]);
  let query = supabase
    .from("scheduled_exams")
    .select("*")
    .neq("status", "expired")
    .order("created_at", { ascending: false });

  if (scope === "own") {
    query = query.eq("created_by", user.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const exams = (data || []) as ScheduledExamRow[];
  const examIds = exams.map((e) => e.id);
  if (examIds.length === 0) return exams;

  // Aggregate participant count per exam (students who have started)
  const { data: attempts, error: attemptsError } = await supabase
    .from("scheduled_exam_attempts")
    .select("scheduled_exam_id")
    .in("scheduled_exam_id", examIds);

  if (attemptsError) throw new Error(attemptsError.message);

  const countMap = new Map<string, number>();
  for (const a of (attempts || []) as { scheduled_exam_id: string }[]) {
    countMap.set(a.scheduled_exam_id, (countMap.get(a.scheduled_exam_id) ?? 0) + 1);
  }

  return exams.map((exam) => ({
    ...exam,
    participant_count: countMap.get(exam.id) ?? 0,
  }));
}

export async function createScheduledExamAction(
  accessToken: string,
  input: CreateScheduledExamInput
): Promise<string> {
  const { supabase, user } = await requirePermissionAnyOf(accessToken, ["quiz:manage:any", "quiz:manage:own"]);

  if (!input.title.trim()) throw new Error("Title is required");
  if (!input.accessCode.trim()) throw new Error("Access code is required");
  if (input.timeLimitMinutes <= 0) throw new Error("Time limit must be positive");
  if (new Date(input.windowEnd) <= new Date(input.windowStart)) throw new Error("Window end must be after start");

  // Validate nav_mode
  if (input.navMode && input.navMode !== 'strict' && input.navMode !== 'standard') {
    throw new Error("navMode must be strict or standard");
  }

  // Validate sub-bab percentages total = 100 if provided
  if (input.subBabPercentages) {
    const pctEntries = Object.entries(input.subBabPercentages);
    const total = pctEntries.reduce<number>((sum, [, v]) => sum + v, 0);
    if (total !== 100) throw new Error(`Sub-bab percentages must total 100 (got ${total})`);
    for (const [key] of pctEntries) {
      if (!input.subBabs.includes(key)) {
        throw new Error(`Percentage key "${key}" is not in selected sub-babs`);
      }
    }
  }

  const { data, error } = await supabase.rpc("create_scheduled_exam", {
    p_title: input.title.trim(),
    p_created_by: user.id,
    p_mapels: input.mapels,
    p_babs: input.babs,
    p_sub_babs: input.subBabs,
    p_mode: input.mode,
    p_question_count: input.questionCount,
    p_time_limit_minutes: input.timeLimitMinutes,
    p_window_start: input.windowStart,
    p_window_end: input.windowEnd,
    p_attempt_mode: input.attemptMode,
    p_access_code: input.accessCode.trim(),
    p_nav_mode: input.navMode || 'strict',
    p_sub_bab_percentages: input.subBabPercentages ? JSON.stringify(input.subBabPercentages) : null,
    p_question_ids: input.questionIds ?? null,
  });

  if (error) throw new Error(error.message);
  return data as string;
}

export async function publishScheduledExamAction(
  accessToken: string,
  examId: string
): Promise<boolean> {
  const { supabase, user, scope } = await requirePermissionAnyOf(accessToken, ["quiz:manage:any", "quiz:manage:own"]);

  // For own-scope, verify ownership first
  if (scope === "own") {
    const { data: exam, error: fetchError } = await supabase
      .from("scheduled_exams")
      .select("created_by")
      .eq("id", examId)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    if (exam.created_by !== user.id) throw new Error("Forbidden");
  }

  const { error } = await supabase.rpc("publish_scheduled_exam", {
    p_exam_id: examId,
  });

  if (error) throw new Error(error.message);
  return true;
}

export async function listScheduledExamAttemptsAction(
  accessToken: string,
  examId: string
): Promise<ScheduledExamAttemptRow[]> {
  const { supabase, user, scope } = await requirePermissionAnyOf(accessToken, ["quiz:manage:any", "quiz:manage:own"]);

  // For own-scope, verify ownership first
  if (scope === "own") {
    const { data: exam, error: fetchError } = await supabase
      .from("scheduled_exams")
      .select("created_by")
      .eq("id", examId)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    if (exam.created_by !== user.id) throw new Error("Forbidden");
  }

  const { data, error } = await supabase
    .from("scheduled_exam_attempts")
    .select("*")
    .eq("scheduled_exam_id", examId)
    .order("started_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as ScheduledExamAttemptRow[];
}

export async function closeScheduledExamAction(
  accessToken: string,
  examId: string
): Promise<boolean> {
  const { supabase, user, scope } = await requirePermissionAnyOf(accessToken, ["quiz:manage:any", "quiz:manage:own"]);

  // For own-scope, verify ownership first
  if (scope === "own") {
    const { data: exam, error: fetchError } = await supabase
      .from("scheduled_exams")
      .select("created_by")
      .eq("id", examId)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    if (exam.created_by !== user.id) throw new Error("Forbidden");
  }

  const { error } = await supabase
    .from("scheduled_exams")
    .update({ status: "expired", is_visible: false })
    .eq("id", examId);

  if (error) throw new Error(error.message);
  return true;
}

export async function getScheduledExamHistoryAction(
  accessToken: string
): Promise<ScheduledExamHistoryRow[]> {
  const { supabase, user, scope } = await requirePermissionAnyOf(accessToken, ["quiz:manage:any", "quiz:manage:own"]);

  let query = supabase
    .from("scheduled_exams")
    .select("*")
    .eq("status", "expired")
    .order("created_at", { ascending: false });

  if (scope === "own") {
    query = query.eq("created_by", user.id);
  }

  const { data: exams, error } = await query;
  if (error) throw new Error(error.message);

  const examIds = (exams || []).map((e: ScheduledExamRow) => e.id);
  if (examIds.length === 0) return [];

  const { data: attempts, error: attemptsError } = await supabase
    .from("scheduled_exam_attempts")
    .select("scheduled_exam_id, score")
    .in("scheduled_exam_id", examIds)
    .not("submitted_at", "is", null);

  if (attemptsError) throw new Error(attemptsError.message);

  const aggMap = new Map<string, { count: number; totalScore: number; passCount: number }>();
  for (const a of (attempts || []) as { scheduled_exam_id: string; score: number | null }[]) {
    const cur = aggMap.get(a.scheduled_exam_id) || { count: 0, totalScore: 0, passCount: 0 };
    cur.count += 1;
    cur.totalScore += a.score ?? 0;
    if ((a.score ?? 0) >= 70) cur.passCount += 1;
    aggMap.set(a.scheduled_exam_id, cur);
  }

  return (exams || []).map((exam: ScheduledExamRow): ScheduledExamHistoryRow => {
    const agg = aggMap.get(exam.id);
    return {
      ...exam,
      participant_count: agg?.count ?? 0,
      avg_score: agg && agg.count > 0 ? Math.round(agg.totalScore / agg.count) : null,
      pass_rate: agg && agg.count > 0 ? Math.round((agg.passCount / agg.count) * 100) : null,
    };
  });
}
