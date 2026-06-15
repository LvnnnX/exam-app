"use server";

import { requirePermission } from "@/lib/admin-server";

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

export async function listScheduledExamsAction(
  accessToken: string
): Promise<ScheduledExamRow[]> {
  const { supabase } = await requirePermission(accessToken, "quiz:manage:any");
  const { data, error } = await supabase
    .from("scheduled_exams")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as ScheduledExamRow[];
}

export async function createScheduledExamAction(
  accessToken: string,
  input: CreateScheduledExamInput
): Promise<string> {
  const { supabase, user } = await requirePermission(accessToken, "quiz:manage:any");

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
  const { supabase } = await requirePermission(accessToken, "quiz:manage:any");

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
  const { supabase } = await requirePermission(accessToken, "quiz:manage:any");

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
  const { supabase } = await requirePermission(accessToken, "quiz:manage:any");

  const { error } = await supabase
    .from("scheduled_exams")
    .update({ status: "closed", is_visible: false })
    .eq("id", examId);

  if (error) throw new Error(error.message);
  return true;
}
