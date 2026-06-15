-- Migration: replace draft/published/closed status with active/scheduled/expired
-- 2026-06-16
--
-- Old statuses: draft, published, closed
-- New statuses: active, scheduled, expired
--
-- Business rules:
--   - New exam created by admin → status = 'active'
--   - If window_start is in the future → status = 'scheduled'
--   - After window_end passes → status = 'expired' (moved to history)
--
-- Auto-transition from active/scheduled → expired is handled by pg_cron job
-- close_expired_scheduled_exams() (see STEP 4).

-- ═══════════════════════════════════════════════
-- STEP 1: Drop old status constraint, add new one
-- ═══════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'scheduled_exams_status_check') THEN
    ALTER TABLE public.scheduled_exams DROP CONSTRAINT scheduled_exams_status_check;
  END IF;
END $$;

ALTER TABLE public.scheduled_exams
  ADD CONSTRAINT scheduled_exams_status_check
  CHECK (status IN ('active', 'scheduled', 'expired'));

-- ═══════════════════════════════════════════════
-- STEP 2: Update create_scheduled_exam to set status = 'active' or 'scheduled'
-- ═══════════════════════════════════════════════

-- Replace the existing create_scheduled_exam function.
-- Previous version set status = 'draft'. Now:
--   - If window_start > now() → 'scheduled'
--   - Otherwise → 'active'

CREATE OR REPLACE FUNCTION public.create_scheduled_exam(
  p_title text,
  p_created_by uuid,
  p_mapels text[],
  p_babs text[],
  p_sub_babs text[],
  p_mode text,
  p_question_count int,
  p_time_limit_minutes int,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_attempt_mode text,
  p_access_code text,
  p_nav_mode text DEFAULT 'strict',
  p_sub_bab_percentages jsonb DEFAULT NULL,
  p_question_ids int[] DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_id UUID;
  v_safe_title TEXT := trim(p_title);
  v_safe_code TEXT := CASE WHEN p_access_code IS NOT NULL THEN trim(p_access_code) ELSE NULL END;
  v_nav_mode TEXT := COALESCE(p_nav_mode, 'strict');
  v_status TEXT;
BEGIN
  IF v_nav_mode NOT IN ('strict', 'standard') THEN
    RAISE EXCEPTION 'nav_mode must be strict or standard';
  END IF;

  IF v_safe_code IS NOT NULL AND EXISTS (
    SELECT 1 FROM scheduled_exams WHERE access_code = v_safe_code AND v_safe_code IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Access code already exists';
  END IF;
  IF p_time_limit_minutes <= 0 THEN
    RAISE EXCEPTION 'time_limit_minutes must be positive';
  END IF;
  IF p_window_end <= p_window_start THEN
    RAISE EXCEPTION 'window_end must be after window_start';
  END IF;

  -- Determine initial status based on window timing
  IF p_window_start > NOW() THEN
    v_status := 'scheduled';
  ELSE
    v_status := 'active';
  END IF;

  INSERT INTO scheduled_exams (
    title, created_by, mapels, babs, sub_babs, mode,
    question_count, time_limit_minutes, window_start, window_end, attempt_mode,
    access_code, status, is_visible, nav_mode, sub_bab_percentages, question_ids
  ) VALUES (
    v_safe_title, p_created_by, p_mapels, p_babs, p_sub_babs, p_mode,
    p_question_count, p_time_limit_minutes, p_window_start, p_window_end,
    p_attempt_mode, v_safe_code, v_status, false,
    v_nav_mode, p_sub_bab_percentages, p_question_ids
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- ═══════════════════════════════════════════════
-- STEP 3: Update publish_scheduled_exam RPC
-- Now just re-activates a paused exam. Kept for backward compat.
-- ═══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.publish_scheduled_exam(
  p_exam_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  UPDATE scheduled_exams
  SET status = 'active', is_visible = true
  WHERE id = p_exam_id AND status IN ('scheduled', 'active');
END;
$fn$;

-- ═══════════════════════════════════════════════
-- STEP 4: Auto-close expired exams via pg_cron
-- ═══════════════════════════════════════════════

-- Function to expire exams whose window has passed
CREATE OR REPLACE FUNCTION public.close_expired_scheduled_exams()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  UPDATE scheduled_exams
  SET status = 'expired', is_visible = false
  WHERE status IN ('active', 'scheduled')
    AND window_end < NOW();
END;
$fn$;

-- Schedule: run every 5 minutes
-- Uses supabase.grants to allow pg_cron to call SECURITY DEFINER function
SELECT cron.schedule(
  'close-expired-scheduled-exams',
  '*/5 * * * *',
  $$SELECT public.close_expired_scheduled_exams()$$
);
