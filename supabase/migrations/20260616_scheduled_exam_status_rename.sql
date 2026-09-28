-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 20260616_scheduled_exam_status_rename
-- Purpose: Rename scheduled_exams.status from (draft/published/closed) to
--          (scheduled/active/expired) + update all RPCs and constraints
--
-- Status mapping:
--   'draft'     → 'scheduled'
--   'published' → 'active'
--   'closed'    → 'expired'
--
-- window_status (upcoming/open/closed) is separate computed field, NOT changed.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. DROP old constraint + ADD new constraint
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.scheduled_exams
  DROP CONSTRAINT IF EXISTS scheduled_exams_status_check,
  ADD CONSTRAINT scheduled_exams_status_check
    CHECK (status IN ('scheduled', 'active', 'expired'));

-- Update default
ALTER TABLE public.scheduled_exams
  ALTER COLUMN status SET DEFAULT 'scheduled';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. UPDATE existing rows from old → new status names
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE public.scheduled_exams SET status = 'expired' WHERE status = 'closed';
UPDATE public.scheduled_exams SET status = 'active'  WHERE status = 'published';
UPDATE public.scheduled_exams SET status = 'scheduled' WHERE status = 'draft';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. UPDATE publish_scheduled_exam RPC — 'published' → 'active'
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.publish_scheduled_exam(p_exam_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM scheduled_exams WHERE id = p_exam_id) THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;
  UPDATE scheduled_exams SET status = 'active', is_visible = true WHERE id = p_exam_id;
  RETURN true;
END;
$fn$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. UPDATE get_scheduled_exam RPC — status checks
--    (file: 20260615_scheduled_exam_window_time_limit.sql, lines ~90-120)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_scheduled_exam(p_access_code text, p_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_exam record;
  v_window_status text;
  v_existing record;
  v_resumable boolean;
  v_session_id uuid;
  v_expires_at timestamptz;
  v_deadline_at timestamptz;
  v_question_count integer;
  v_attempt_mode text;
  v_nav_mode text;
BEGIN
  SELECT * INTO v_exam FROM scheduled_exams
  WHERE access_code = p_access_code
    AND is_visible = true
    AND status != 'expired'  -- CHANGED: 'closed' → 'expired'
    AND window_start IS NOT NULL
    AND window_end IS NOT NULL;

  IF v_exam.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exam not found or not available.');
  END IF;

  -- Window status check (unchanged — this is window_status, not exam status)
  IF now() < v_exam.window_start THEN
    v_window_status := 'upcoming';
  ELSIF now() > v_exam.window_end THEN
    v_window_status := 'closed';
  ELSE
    v_window_status := 'open';
  END IF;

  -- Check existing attempt
  SELECT * INTO v_existing FROM scheduled_exam_attempts
  WHERE scheduled_exam_id = v_exam.id AND student_name = p_name
  ORDER BY started_at DESC LIMIT 1;

  -- single: already submitted = denied
  IF v_exam.attempt_mode = 'single' AND v_existing.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Kamu sudah mengerjakan ujian ini.',
      'window_status', v_window_status
    );
  END IF;

  -- retake: window closed = denied
  IF v_exam.attempt_mode = 'retake' AND v_window_status = 'closed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Waktu ujian sudah berakhir.',
      'window_status', 'closed'
    );
  END IF;

  -- upcoming window = show countdown, deny start
  IF v_window_status = 'upcoming' THEN
    RETURN jsonb_build_object(
      'success', true,
      'found', true,
      'window_status', 'upcoming',
      'window_start', v_exam.window_start,
      'window_end', v_exam.window_end,
      'title', v_exam.title,
      'time_limit_minutes', v_exam.time_limit_minutes,
      'attempt_mode', v_exam.attempt_mode,
      'nav_mode', COALESCE(v_exam.nav_mode, 'strict')
    );
  END IF;

  -- closed window = denied
  IF v_window_status = 'closed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Waktu ujian sudah berakhir.',
      'window_status', 'closed'
    );
  END IF;

  -- open window: check resumable session
  v_resumable := false;
  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NULL THEN
    IF v_existing.deadline_at > now() THEN
      v_resumable := true;
      v_session_id := v_existing.session_id;
      v_deadline_at := v_existing.deadline_at;
    END IF;
  END IF;

  IF v_resumable THEN
    RETURN jsonb_build_object(
      'success', true,
      'found', true,
      'window_status', 'open',
      'title', v_exam.title,
      'time_limit_minutes', v_exam.time_limit_minutes,
      'attempt_mode', v_exam.attempt_mode,
      'nav_mode', COALESCE(v_exam.nav_mode, 'strict'),
      'session_id', v_session_id,
      'expires_at', v_deadline_at,
      'resuming', true,
      'deadline_at', v_deadline_at
    );
  END IF;

  -- Start new session
  SELECT v_exam.question_count INTO v_question_count;
  SELECT COALESCE(v_exam.nav_mode, 'strict') INTO v_nav_mode;

  SELECT start_exam_session(
    COALESCE(p_name, 'Anonim'),
    'exam',
    v_exam.mapels,
    v_exam.babs,
    v_exam.sub_babs,
    v_question_count,
    v_exam.time_limit_minutes,
    v_nav_mode,
    v_exam.sub_bab_percentages,
    v_exam.question_ids
  ) INTO v_session_id;

  v_expires_at := now() + v_exam.time_limit_minutes * INTERVAL '1 minute';
  v_deadline_at := LEAST(v_expires_at, v_exam.window_end);

  INSERT INTO scheduled_exam_attempts (scheduled_exam_id, student_name, session_id, deadline_at)
  VALUES (v_exam.id, COALESCE(p_name, 'Anonim'), v_session_id, v_deadline_at);

  UPDATE scheduled_exams SET status = 'active' WHERE id = v_exam.id;  -- CHANGED: 'published' → 'active'

  RETURN jsonb_build_object(
    'success', true,
    'found', true,
    'window_status', 'open',
    'title', v_exam.title,
    'time_limit_minutes', v_exam.time_limit_minutes,
    'attempt_mode', v_exam.attempt_mode,
    'nav_mode', COALESCE(v_exam.nav_mode, 'strict'),
    'session_id', v_session_id,
    'expires_at', v_deadline_at,
    'resuming', false,
    'deadline_at', v_deadline_at
  );
END;
$fn$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. UPDATE start_scheduled_exam RPC — status checks
--    (file: 20260616_scheduled_exam_question_pool.sql, lines ~90-115)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.start_scheduled_exam(p_access_code text, p_name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_exam record;
  v_window_status text;
  v_existing record;
  v_resumable boolean;
  v_session_id uuid;
  v_expires_at timestamptz;
  v_deadline_at timestamptz;
  v_question_count integer;
  v_attempt_mode text;
  v_nav_mode text;
BEGIN
  SELECT * INTO v_exam FROM scheduled_exams
  WHERE access_code = p_access_code
    AND is_visible = true
    AND status != 'expired'  -- CHANGED: 'closed' → 'expired'
    AND window_start IS NOT NULL
    AND window_end IS NOT NULL;

  IF v_exam.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exam not found or not available.');
  END IF;

  -- Window status check
  IF now() < v_exam.window_start THEN
    v_window_status := 'upcoming';
  ELSIF now() > v_exam.window_end THEN
    v_window_status := 'closed';
  ELSE
    v_window_status := 'open';
  END IF;

  -- Check existing attempt
  SELECT * INTO v_existing FROM scheduled_exam_attempts
  WHERE scheduled_exam_id = v_exam.id AND student_name = p_name
  ORDER BY started_at DESC LIMIT 1;

  -- single: already submitted = denied
  IF v_exam.attempt_mode = 'single' AND v_existing.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Kamu sudah mengerjakan ujian ini.',
      'window_status', v_window_status
    );
  END IF;

  -- retake: window closed = denied
  IF v_exam.attempt_mode = 'retake' AND v_window_status = 'closed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Waktu ujian sudah berakhir.',
      'window_status', 'closed'
    );
  END IF;

  -- upcoming window = show countdown, deny start
  IF v_window_status = 'upcoming' THEN
    RETURN jsonb_build_object(
      'success', true,
      'found', true,
      'window_status', 'upcoming',
      'window_start', v_exam.window_start,
      'window_end', v_exam.window_end,
      'title', v_exam.title,
      'time_limit_minutes', v_exam.time_limit_minutes,
      'attempt_mode', v_exam.attempt_mode,
      'nav_mode', COALESCE(v_exam.nav_mode, 'strict')
    );
  END IF;

  -- closed window = denied
  IF v_window_status = 'closed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Waktu ujian sudah berakhir.',
      'window_status', 'closed'
    );
  END IF;

  -- open window: check resumable session
  v_resumable := false;
  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NULL THEN
    IF v_existing.deadline_at > now() THEN
      v_resumable := true;
      v_session_id := v_existing.session_id;
      v_deadline_at := v_existing.deadline_at;
    END IF;
  END IF;

  IF v_resumable THEN
    RETURN jsonb_build_object(
      'success', true,
      'found', true,
      'window_status', 'open',
      'title', v_exam.title,
      'time_limit_minutes', v_exam.time_limit_minutes,
      'attempt_mode', v_exam.attempt_mode,
      'nav_mode', COALESCE(v_exam.nav_mode, 'strict'),
      'session_id', v_session_id,
      'expires_at', v_deadline_at,
      'resuming', true,
      'deadline_at', v_deadline_at
    );
  END IF;

  -- Start new session
  SELECT v_exam.question_count INTO v_question_count;
  SELECT COALESCE(v_exam.nav_mode, 'strict') INTO v_nav_mode;

  SELECT start_exam_session(
    p_name,
    'exam',
    v_exam.mapels,
    v_exam.babs,
    v_exam.sub_babs,
    v_question_count,
    v_exam.time_limit_minutes,
    v_nav_mode,
    v_exam.sub_bab_percentages,
    v_exam.question_ids
  ) INTO v_session_id;

  v_expires_at := now() + v_exam.time_limit_minutes * INTERVAL '1 minute';
  v_deadline_at := LEAST(v_expires_at, v_exam.window_end);

  INSERT INTO scheduled_exam_attempts (scheduled_exam_id, student_name, session_id, deadline_at)
  VALUES (v_exam.id, p_name, v_session_id, v_deadline_at);

  UPDATE scheduled_exams SET status = 'active' WHERE id = v_exam.id;  -- CHANGED: 'published' → 'active'

  RETURN jsonb_build_object(
    'success', true,
    'found', true,
    'window_status', 'open',
    'title', v_exam.title,
    'time_limit_minutes', v_exam.time_limit_minutes,
    'attempt_mode', v_exam.attempt_mode,
    'nav_mode', COALESCE(v_exam.nav_mode, 'strict'),
    'session_id', v_session_id,
    'expires_at', v_deadline_at,
    'resuming', false,
    'deadline_at', v_deadline_at
  );
END;
$fn$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. UPDATE seal_overdue_scheduled_exams pg_cron job
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.seal_overdue_scheduled_exams()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_attempt record;
BEGIN
  FOR v_attempt IN
    SELECT sa.id, sa.session_id, sa.scheduled_exam_id
    FROM scheduled_exam_attempts sa
    JOIN scheduled_exams se ON se.id = sa.scheduled_exam_id
    WHERE sa.submitted_at IS NULL
      AND sa.deadline_at <= now()
      AND se.status != 'expired'  -- CHANGED: 'closed' → 'expired'
  LOOP
    PERFORM submit_session_exam(v_attempt.session_id);
    UPDATE scheduled_exam_attempts
    SET submitted_at = now(), auto_submitted = true
    WHERE id = v_attempt.id;
  END LOOP;
END;
$fn$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. UPDATE create_scheduled_exam RPC — initial status = 'scheduled'
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_scheduled_exam(
  p_title text,
  p_created_by uuid,
  p_mapels text[],
  p_babs text[],
  p_sub_babs text[],
  p_mode text,
  p_question_count integer,
  p_time_limit_minutes integer,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_attempt_mode text,
  p_access_code text,
  p_nav_mode text,
  p_sub_bab_percentages jsonb,
  p_question_ids integer[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_id uuid;
BEGIN
  SELECT gen_random_uuid() INTO v_id;

  INSERT INTO scheduled_exams (
    id, title, created_by, mapels, babs, sub_babs,
    mode, question_count, time_limit_minutes,
    window_start, window_end, attempt_mode, access_code,
    nav_mode, sub_bab_percentages, question_ids,
    status, is_visible
  ) VALUES (
    v_id, p_title, p_created_by, p_mapels, p_babs, p_sub_babs,
    p_mode, p_question_count, p_time_limit_minutes,
    p_window_start, p_window_end, p_attempt_mode, p_access_code,
    p_nav_mode, p_sub_bab_percentages, p_question_ids,
    'scheduled', false  -- CHANGED: 'draft' → 'scheduled'
  );

  RETURN v_id;
END;
$fn$;
