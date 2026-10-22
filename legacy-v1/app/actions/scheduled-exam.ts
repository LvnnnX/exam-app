"use server";

import { z } from "zod";
import { getExamSecretKey, getSupabaseServer } from "@/lib/supabase";

// Zod schema for validating RPC return shape (BUG-T4 fix)
const ScheduledExamLookupSchema = z.object({
  found: z.boolean(),
  error: z.string().optional(),
  id: z.string().optional(),
  title: z.string().optional(),
  mapels: z.array(z.string()).optional(),
  babs: z.array(z.string()).optional(),
  sub_babs: z.array(z.string()).optional(),
  mode: z.string().optional(),
  question_count: z.number().optional(),
  time_limit_minutes: z.number().optional(),
  window_start: z.string().optional(),
  window_end: z.string().optional(),
  attempt_mode: z.string().optional(),
  window_status: z.enum(["upcoming", "open", "closed"]).optional(),
  status: z.enum(["active", "scheduled", "expired"]).optional(),
});

export type ScheduledExamLookup = z.infer<typeof ScheduledExamLookupSchema>;

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
  // Exam metadata for UI display
  scheduled_exam_title?: string;
  scheduled_mapels?: string[];
  scheduled_babs?: string[];
  scheduled_sub_babs?: string[];
  scheduled_time_limit_minutes?: number;
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

  // BUG-T4 fix: Zod parse instead of double-cast `as unknown as T`
  const parsed = ScheduledExamLookupSchema.safeParse(data);
  if (!parsed.success) {
    return { found: false, error: "Invalid response shape from server" };
  }
  return parsed.data;
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

  return data as ScheduledExamStartResult;
}

/**
 * Fetch stored recap + score for a finished scheduled exam attempt.
 * Returns null if attempt was not yet submitted or has no recap.
 */
export type ScheduledExamRecap = {
  recap: unknown[];
  score: number;
  total: number;
  name: string;
  started_at: string;
  submitted_at: string;
};

export async function getScheduledExamRecapAction(
  sessionId: string,
): Promise<ScheduledExamRecap | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc('get_scheduled_exam_recap', {
    p_session_id: sessionId,
  });
  if (error) {
    // BUG-S4 fix: don't console.error sensitive details
    return null;
  }
  if (!data) return null;
  return data as ScheduledExamRecap;
}

// NOTE: finalizeScheduledExamAttemptAction was removed (BUG-S2 fix).
// Atomic recap seal is now performed inside submit_session_exam(uuid, timestamptz)
// via migration 20260616_submit_seals_scheduled_attempt + 20260617_cron_recap_criticals_fix.
// The client-side finalize call was redundant AND was overwriting the 5-field recap
// shape with sanitized 3-field data, breaking ResultsRecapList rendering.
