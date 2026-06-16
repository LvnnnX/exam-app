-- Migration: replace ALL create_scheduled_exam overloads with correct 15-param version
-- 2026-06-16
--
-- Root cause: 14-param version (hardcoded 'draft') coexists with 15-param version.
-- PostgreSQL picks by positional args — the 14-param version shadows the 15-param one.
-- This migration nukes ALL overloads and creates only the correct 15-param version.
--
-- Status lifecycle:
--   created → 'scheduled' (window_start > now) or 'active' (window_start <= now < window_end)
--   cron every 1min: 'scheduled' → 'active' when window_start arrives
--   cron every 5min: 'active' → 'expired' when window_end passes

-- ═══════════════════════════════════════════════
-- STEP 1: Drop all existing overloads
-- ═══════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.create_scheduled_exam(
  text, uuid, text[], text[], text[], text, int, int, timestamptz, timestamptz, text, text
);
DROP FUNCTION IF EXISTS public.create_scheduled_exam(
  text, uuid, text[], text[], text[], text, int, int, timestamptz, timestamptz, text, text, text
);
DROP FUNCTION IF EXISTS public.create_scheduled_exam(
  text, uuid, text[], text[], text[], text, int, int, timestamptz, timestamptz, text, text, text, jsonb
);
DROP FUNCTION IF EXISTS public.create_scheduled_exam(
  text, uuid, text[], text[], text[], text, int, int, timestamptz, timestamptz, text, text, text, jsonb, int[]
);

-- ═══════════════════════════════════════════════
-- STEP 2: Status constraint — already done in previous migration, idempotent
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
-- STEP 3: Create ONLY the 15-param version with correct status logic
-- ═══════════════════════════════════════════════

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

  -- Initial status: 'active' if window already started, else 'scheduled'
  -- 'active' → visible to students immediately; 'scheduled' → hidden until cron activates
  IF p_window_start > NOW() THEN
    v_status := 'scheduled';
    v_visible := false;
  ELSE
    v_status := 'active';
    v_visible := true;
  END IF;

  INSERT INTO scheduled_exams (
    title, created_by, mapels, babs, sub_babs, mode,
    question_count, time_limit_minutes, window_start, window_end, attempt_mode,
    access_code, status, is_visible, nav_mode, sub_bab_percentages, question_ids
  ) VALUES (
    v_safe_title, p_created_by, p_mapels, p_babs, p_sub_babs, p_mode,
    p_question_count, p_time_limit_minutes, p_window_start, p_window_end,
    p_attempt_mode, v_safe_code, v_status, v_visible,
    v_nav_mode, p_sub_bab_percentages, p_question_ids
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- ═══════════════════════════════════════════════
-- STEP 4: Cron — activate scheduled exams when window starts
-- ═══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.activate_scheduled_exams()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  UPDATE scheduled_exams
  SET status = 'active'
  WHERE status = 'scheduled'
    AND window_start <= NOW();
END;
$fn$;

SELECT cron.schedule(
  'activate-scheduled-exams',
  '* * * * *',
  $$SELECT public.activate_scheduled_exams()$$
);

-- ═══════════════════════════════════════════════
-- STEP 5: Cron — expire exams whose window has closed
-- ═══════════════════════════════════════════════

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

SELECT cron.schedule(
  'close-expired-scheduled-exams',
  '*/5 * * * *',
  $$SELECT public.close_expired_scheduled_exams()$$
);
