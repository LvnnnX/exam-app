"use server";

import { getExamSecretKey, getSupabaseServer } from "@/lib/supabase";

export type ScheduledExamLookup = {
  found: boolean;
  error?: string;
  id?: string;
  title?: string;
  mapels?: string[];
  babs?: string[];
  sub_babs?: string[];
  mode?: string;
  question_count?: number;
  time_limit_minutes?: number;
  window_start?: string;
  window_end?: string;
  attempt_mode?: string;
  window_status?: 'upcoming' | 'open' | 'closed';
  status?: 'active' | 'scheduled' | 'expired';
};

export type ScheduledExamStartResult = {
  success: boolean;
  error?: string;
  session_id?: string;
  question_count?: number;
  expires_at?: string;
  deadline_at?: string;
  scheduled_exam_id?: string;
  resuming?: boolean;
  window_status?: 'upcoming' | 'open' | 'closed';
  window_start?: string;
  nav_mode?: string;
};

export async function lookupScheduledExamAction(
  accessCode: string
): Promise<ScheduledExamLookup> {
  const supabase = getSupabaseServer();
  const safeCode = accessCode.trim().slice(0, 20);

  const { data, error } = await supabase
    .rpc("get_scheduled_exam", { p_access_code: safeCode })
    .single();

  if (error) {
    return { found: false, error: error.message };
  }

  return data as unknown as ScheduledExamLookup;
}

export async function startScheduledExamAction(
  name: string,
  accessCode: string,
  userAgent: string
): Promise<ScheduledExamStartResult> {
  const supabase = getSupabaseServer();
  const secret = getExamSecretKey();
  const safeName = name.trim().slice(0, 16);
  const safeCode = accessCode.trim().slice(0, 20);

  const { data, error } = await supabase
    .rpc("start_scheduled_exam", {
      p_name: safeName,
      p_access_code: safeCode,
      p_user_agent: userAgent,
      p_secret: secret,
    })
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return data as unknown as ScheduledExamStartResult;
}
