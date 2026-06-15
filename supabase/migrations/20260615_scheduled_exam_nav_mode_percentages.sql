-- Scheduled Exam: nav_mode + sub_bab_percentages
-- 2026-06-15
-- Run di Supabase Dashboard > SQL Editor

-- ═══════════════════════════════════════════
-- STEP 1: ADD COLUMNS
-- ═══════════════════════════════════════════

ALTER TABLE public.scheduled_exams ADD COLUMN IF NOT EXISTS nav_mode text NOT NULL DEFAULT 'strict';
ALTER TABLE public.scheduled_exams ADD COLUMN IF NOT EXISTS sub_bab_percentages jsonb;
ALTER TABLE public.scheduled_exams ADD CONSTRAINT IF NOT EXISTS scheduled_exams_nav_mode_check CHECK (nav_mode IN ('strict', 'standard'));

-- ═══════════════════════════════════════════
-- STEP 2: UPDATE create_scheduled_exam RPC
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_scheduled_exam(
  p_title text, p_created_by uuid, p_mapels text[], p_babs text[],
  p_sub_babs text[], p_mode text, p_question_count int,
  p_time_limit_minutes int, p_window_start timestamptz, p_window_end timestamptz,
  p_attempt_mode text, p_access_code text,
  p_nav_mode text DEFAULT 'strict',
  p_sub_bab_percentages jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_id UUID;
  v_safe_title TEXT := trim(p_title);
  v_safe_code TEXT := CASE WHEN p_access_code IS NOT NULL THEN trim(p_access_code) ELSE NULL END;
  v_nav_mode TEXT := COALESCE(p_nav_mode, 'strict');
BEGIN
  IF v_nav_mode NOT IN ('strict', 'standard') THEN
    RAISE EXCEPTION 'nav_mode must be strict or standard';
  END IF;

  IF v_safe_code IS NOT NULL AND EXISTS (SELECT 1 FROM scheduled_exams WHERE access_code = v_safe_code) THEN
    RAISE EXCEPTION 'Access code already exists';
  END IF;
  IF p_time_limit_minutes <= 0 THEN RAISE EXCEPTION 'time_limit_minutes must be positive'; END IF;
  IF p_window_end <= p_window_start THEN RAISE EXCEPTION 'window_end must be after window_start'; END IF;

  INSERT INTO scheduled_exams (title, created_by, mapels, babs, sub_babs, mode,
    question_count, time_limit_minutes, window_start, window_end, attempt_mode,
    access_code, status, is_visible, nav_mode, sub_bab_percentages)
  VALUES (v_safe_title, p_created_by, p_mapels, p_babs, p_sub_babs, p_mode,
    p_question_count, p_time_limit_minutes, p_window_start, p_window_end,
    p_attempt_mode, v_safe_code, 'draft', false, v_nav_mode, p_sub_bab_percentages)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- ═══════════════════════════════════════════
-- STEP 3: UPDATE start_scheduled_exam RPC
-- ═══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.start_scheduled_exam(
  p_name text, p_access_code text, p_user_agent text DEFAULT NULL, p_secret text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_exam RECORD;
  v_window_status TEXT;
  v_existing RECORD;
  v_deadline TIMESTAMPTZ;
  v_session_result JSONB;
  v_session_id UUID;
  v_question_count INT;
BEGIN
  IF NOT validate_exam_secret(p_secret) THEN
    RAISE EXCEPTION 'Unauthorized: invalid secret';
  END IF;

  SELECT id, title, mapels, babs, sub_babs, mode, question_count,
         time_limit_minutes, window_start, window_end, attempt_mode,
         nav_mode, sub_bab_percentages
  INTO v_exam
  FROM scheduled_exams
  WHERE access_code = p_access_code AND access_code IS NOT NULL
    AND status = 'published' AND is_visible = true;

  IF v_exam.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exam not found or not available.');
  END IF;

  IF now() < v_exam.window_start THEN v_window_status := 'upcoming';
  ELSIF now() > v_exam.window_end THEN v_window_status := 'closed';
  ELSE v_window_status := 'open';
  END IF;

  SELECT * INTO v_existing FROM scheduled_exam_attempts
  WHERE scheduled_exam_id = v_exam.id AND student_name = p_name
  ORDER BY started_at DESC LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NOT NULL THEN
    IF v_exam.attempt_mode = 'single' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Kamu sudah menyelesaikan ujian ini.');
    ELSIF v_exam.attempt_mode = 'retake' AND v_window_status != 'open' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Kamu sudah menyelesaikan ujian ini.');
    END IF;
  END IF;

  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NULL AND v_existing.session_id IS NOT NULL THEN
    IF v_existing.deadline_at > now() AND v_window_status = 'open' THEN
      RETURN jsonb_build_object('success', true, 'session_id', v_existing.session_id,
        'question_count', v_exam.question_count, 'expires_at', v_existing.deadline_at,
        'deadline_at', v_existing.deadline_at, 'scheduled_exam_id', v_exam.id,
        'nav_mode', COALESCE(v_exam.nav_mode, 'strict'),
        'resuming', true);
    END IF;
  END IF;

  IF v_window_status = 'upcoming' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ujian belum dibuka.',
      'window_status', 'upcoming', 'window_start', v_exam.window_start);
  ELSIF v_window_status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Waktu ujian sudah berakhir.', 'window_status', 'closed');
  END IF;

  v_deadline := LEAST(
    now() + (v_exam.time_limit_minutes || ' minutes')::INTERVAL,
    v_exam.window_end
  );

  -- start_exam_session signature: (p_name, p_mapels, p_babs, p_sub_babs, p_mode, p_count, p_time_limit, p_user_agent, p_secret)
  -- Nav mode + percentages: stored in DB but applied at session start by start_exam_session.
  -- If start_exam_session gains percentage/nav_mode params, add them here.
  v_session_result := start_exam_session(
    p_name, v_exam.mapels, v_exam.babs, v_exam.sub_babs,
    v_exam.mode, v_exam.question_count,
    999999, p_user_agent, p_secret
  );

  v_session_id := (v_session_result->>'session_id')::uuid;
  v_question_count := (v_session_result->>'question_count')::int;

  IF v_session_id IS NULL OR v_question_count IS NULL OR v_question_count = 0 THEN
    IF v_session_id IS NOT NULL THEN
      DELETE FROM exam_logs WHERE session_id = v_session_id;
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'Tidak ada soal yang tersedia untuk ujian ini.');
  END IF;

  UPDATE exam_logs SET expires_at = v_deadline WHERE session_id = v_session_id;

  INSERT INTO scheduled_exam_attempts
    (scheduled_exam_id, student_name, session_id, started_at, deadline_at)
  VALUES (v_exam.id, p_name, v_session_id, now(), v_deadline);

  RETURN jsonb_build_object(
    'success', true, 'session_id', v_session_id,
    'question_count', v_question_count, 'expires_at', v_deadline,
    'deadline_at', v_deadline, 'scheduled_exam_id', v_exam.id,
    'nav_mode', COALESCE(v_exam.nav_mode, 'strict'),
    'resuming', false
  );
END;
$fn$;

-- ═══════════════════════════════════════════
-- STEP 4: UPDATE public_scheduled_exams VIEW
-- ═══════════════════════════════════════════

CREATE OR REPLACE VIEW public_scheduled_exams WITH (security_invoker = true) AS
  SELECT id, title, mapels, babs, sub_babs, mode, question_count,
         time_limit_minutes, window_start, window_end, attempt_mode,
         status, is_visible, created_at, nav_mode
  FROM scheduled_exams
  WHERE is_visible = true AND status != 'closed';
