"use server";

import { requirePermissionAnyOf } from "@/lib/admin-server";

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
  status: string;
  is_visible: boolean;
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
  status: string;
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
    .order("created_at", { ascending: false });

  if (scope === "own") {
    query = query.eq("created_by", user.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as ScheduledExamRow[];
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
    .update({ status: "closed", is_visible: false })
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
    .eq("status", "closed")
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
