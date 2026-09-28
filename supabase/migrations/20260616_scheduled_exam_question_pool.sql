-- Migration: store fixed question pool per scheduled exam
--
-- Problem: start_scheduled_exam currently calls start_exam_session which
-- selects random questions per student. All students in the same exam should
-- get the SAME question pool (same IDs, same order) — only options get
-- shuffled per-student (handled client-side via shuffleOptions).
--
-- Fix:
--   1. Add question_ids[] column to scheduled_exams
--   2. Update create_scheduled_exam to accept + store the pool
--   3. Update start_scheduled_exam to use the exam's fixed question_ids
--      directly instead of calling start_exam_session

-- ═══════════════════════════════════════════════
-- STEP 1: Add question_ids to scheduled_exams
-- ═══════════════════════════════════════════════

ALTER TABLE public.scheduled_exams
  ADD COLUMN IF NOT EXISTS question_ids int[];

COMMENT ON COLUMN public.scheduled_exams.question_ids IS
  'Fixed question ID pool for this exam. All students get these exact IDs in this order.';

-- ═══════════════════════════════════════════════
-- STEP 2: Update create_scheduled_exam signature
-- ═══════════════════════════════════════════════
-- The RPC is SECURITY DEFINER so we can replace it safely.
-- Old signature (11 args) + new arg p_question_ids (int[])
--
-- New: create_scheduled_exam(p_title, p_created_by, p_mapels, p_babs,
--   p_sub_babs, p_mode, p_question_count, p_time_limit_minutes,
--   p_window_start, p_window_end, p_attempt_mode, p_access_code,
--   p_nav_mode, p_sub_bab_percentages, p_question_ids)
-- Returns: uuid

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
  p_question_ids int[] DEFAULT NULL  -- NEW
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_id UUID;
  v_safe_title TEXT := trim(p_title);
  v_safe_code TEXT := CASE WHEN p_access_code IS NOT NULL THEN trim(p_access_code) ELSE NULL END;
BEGIN
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

  INSERT INTO scheduled_exams (
    title, created_by, mapels, babs, sub_babs, mode,
    question_count, time_limit_minutes, window_start, window_end, attempt_mode,
    access_code, status, is_visible, nav_mode, sub_bab_percentages, question_ids
  ) VALUES (
    v_safe_title, p_created_by, p_mapels, p_babs, p_sub_babs, p_mode,
    p_question_count, p_time_limit_minutes, p_window_start, p_window_end,
    p_attempt_mode, v_safe_code, 'draft', false,
    COALESCE(p_nav_mode, 'strict'), p_sub_bab_percentages, p_question_ids
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- ═══════════════════════════════════════════════
-- STEP 4: Update public_scheduled_exams view
-- ═══════════════════════════════════════════════

CREATE OR REPLACE VIEW public_scheduled_exams WITH (security_invoker = true) AS
  SELECT id, title, created_by, created_at, mapels, babs, sub_babs, mode,
    question_count, time_limit_minutes, window_start, window_end, attempt_mode,
    access_code, status, is_visible, nav_mode, sub_bab_percentages, question_ids
  FROM scheduled_exams;
--
-- OLD BEHAVIOUR: called start_exam_session(...) which selects random
--   question_ids per student via ARRAY[] and random() in SQL.
--
-- NEW BEHAVIOUR: read question_ids from scheduled_exams and insert
--   directly into exam_logs. Each student gets the SAME question_ids
--   (same pool, same order). Option shuffling remains per-student
--   via shuffleOptions() in the client.
--
-- Also threads nav_mode and sub_bab_percentages through.

CREATE OR REPLACE FUNCTION public.start_scheduled_exam(
  p_name text,
  p_access_code text,
  p_user_agent text DEFAULT NULL,
  p_secret text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_exam RECORD;
  v_window_status TEXT;
  v_existing RECORD;
  v_deadline TIMESTAMPTZ;
  v_session_id UUID;
  v_q_count INT;
BEGIN
  IF NOT validate_exam_secret(p_secret) THEN
    RAISE EXCEPTION 'Unauthorized: invalid secret';
  END IF;

  SELECT id, title, mapels, babs, sub_babs, mode, question_count,
         time_limit_minutes, window_start, window_end, attempt_mode,
         nav_mode, sub_bab_percentages, question_ids
  INTO v_exam
  FROM scheduled_exams
  WHERE access_code = p_access_code AND access_code IS NOT NULL
    AND status = 'published' AND is_visible = true;

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
  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NOT NULL THEN
    IF v_exam.attempt_mode = 'single' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Kamu sudah menyelesaikan ujian ini.');
    ELSIF v_exam.attempt_mode = 'retake' AND v_window_status != 'open' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Kamu sudah menyelesaikan ujian ini.');
    END IF;
  END IF;

  -- Resume: same session still valid
  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NULL AND v_existing.session_id IS NOT NULL THEN
    IF v_existing.deadline_at > now() AND v_window_status = 'open' THEN
      RETURN jsonb_build_object(
        'success', true,
        'session_id', v_existing.session_id,
        'question_count', v_exam.question_count,
        'expires_at', v_existing.deadline_at,
        'deadline_at', v_existing.deadline_at,
        'scheduled_exam_id', v_exam.id,
        'nav_mode', COALESCE(v_exam.nav_mode, 'strict'),
        'resuming', true
      );
    END IF;
  END IF;

  -- Window not open
  IF v_window_status = 'upcoming' THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Ujian belum dibuka.',
      'window_status', 'upcoming', 'window_start', v_exam.window_start
    );
  ELSIF v_window_status = 'closed' THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Waktu ujian sudah berakhir.',
      'window_status', 'closed'
    );
  END IF;

  -- ─── FIX: Use fixed question pool from scheduled_exams ───────────────────
  IF v_exam.question_ids IS NULL OR array_length(v_exam.question_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tidak ada soal yang tersedia untuk ujian ini.'
    );
  END IF;

  v_q_count := array_length(v_exam.question_ids, 1);
  IF v_q_count < v_exam.question_count THEN
    -- Not enough questions in pool
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Jumlah soal tidak mencukupi (' || v_q_count || ' soal tersedia, minimal ' || v_exam.question_count || ' dibutuhkan).'
    );
  END IF;

  v_deadline := LEAST(
    now() + (v_exam.time_limit_minutes || ' minutes')::INTERVAL,
    v_exam.window_end
  );

  -- Create unique session_id for this student
  v_session_id := gen_random_uuid();

  -- Insert into exam_logs with the FIXED question pool
  INSERT INTO exam_logs (
    session_id, name, question_ids, current_index, user_answers,
    mode, mapel, bab, sub_bab, started_at, expires_at, user_agent,
    is_finished, lives, nav_mode
  ) VALUES (
    v_session_id,
    p_name,
    v_exam.question_ids,  -- SAME for all students
    0,
    '{}',
    v_exam.mode,
    COALESCE(v_exam.mapels, ARRAY[]::text[]),
    COALESCE(v_exam.babs, ARRAY[]::text[]),
    COALESCE(v_exam.sub_babs, ARRAY[]::text[]),
    now(),
    v_deadline,
    p_user_agent,
    false,
    999999,  -- lives (not used in exam mode but required)
    COALESCE(v_exam.nav_mode, 'strict')
  );

  -- Update deadline to respect exam time limit vs window end
  UPDATE exam_logs SET expires_at = v_deadline WHERE session_id = v_session_id;

  -- Record the attempt
  INSERT INTO scheduled_exam_attempts
    (scheduled_exam_id, student_name, session_id, started_at, deadline_at)
  VALUES (v_exam.id, p_name, v_session_id, now(), v_deadline);

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'question_count', v_exam.question_count,
    'expires_at', v_deadline,
    'deadline_at', v_deadline,
    'scheduled_exam_id', v_exam.id,
    'nav_mode', COALESCE(v_exam.nav_mode, 'strict'),
    'resuming', false
  );
END;
$fn$;