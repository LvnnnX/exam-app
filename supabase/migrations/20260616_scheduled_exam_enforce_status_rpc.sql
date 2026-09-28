-- Migration: enforce status field in student-facing RPCs
-- 2026-06-16
--
-- Update get_scheduled_exam and start_scheduled_exam to use the new
-- status values (active/scheduled/expired) instead of (published/draft/closed).
--
-- Student rules:
--   status = 'scheduled' → cannot join, show "Ujian akan dimulai dalam X jam X menit"
--   status = 'active'   → can join
--   status = 'expired'  → cannot join, show "Waktu ujian sudah berakhir"
--
-- window_status (upcoming/open/closed) is still computed on-the-fly
-- from timestamps for the student UI countdown display.

-- ═══════════════════════════════════════════════
-- STEP 1: Update get_scheduled_exam
-- - Remove old status checks (draft/published/closed)
-- - Add 'status' to returned fields
-- ═══════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_scheduled_exam(p_access_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_exam RECORD;
  v_window_status TEXT;
BEGIN
  SELECT id, title, mapels, babs, sub_babs, mode, question_count,
         time_limit_minutes, window_start, window_end, attempt_mode, status, is_visible
  INTO v_exam
  FROM scheduled_exams
  WHERE access_code = p_access_code AND access_code IS NOT NULL
    AND status != 'expired';

  IF v_exam.id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'error', 'Kode akses tidak ditemukan atau ujian sudah ditutup.');
  END IF;

  -- Compute window_status from timestamps (for student UI countdown)
  IF now() < v_exam.window_start THEN
    v_window_status := 'upcoming';
  ELSIF now() > v_exam.window_end THEN
    v_window_status := 'closed';
  ELSE
    v_window_status := 'open';
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'id', v_exam.id,
    'title', v_exam.title,
    'mapels', v_exam.mapels,
    'babs', v_exam.babs,
    'sub_babs', v_exam.sub_babs,
    'mode', v_exam.mode,
    'question_count', v_exam.question_count,
    'time_limit_minutes', v_exam.time_limit_minutes,
    'window_start', v_exam.window_start,
    'window_end', v_exam.window_end,
    'attempt_mode', v_exam.attempt_mode,
    'window_status', v_window_status,
    'status', v_exam.status
  );
END;
$fn$;

-- ═══════════════════════════════════════════════
-- STEP 2: Update start_scheduled_exam
-- - Change status check from 'published' to 'active'
-- - Add explicit status-based rejection messages
-- ═══════════════════════════════════════════════

-- Drop existing overload first
DROP FUNCTION IF EXISTS public.start_scheduled_exam(text, text, text, text);

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

  -- Look up exam: only active + visible exams can be started
  SELECT id, title, mapels, babs, sub_babs, mode, question_count,
         time_limit_minutes, window_start, window_end, attempt_mode, status
  INTO v_exam
  FROM scheduled_exams
  WHERE access_code = p_access_code AND access_code IS NOT NULL
    AND status = 'active' AND is_visible = true;

  IF v_exam.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exam not found or not available.');
  END IF;

  -- Enforce status gate
  IF v_exam.status = 'scheduled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ujian belum dimulai. Silakan tunggu hingga waktu yang ditentukan.',
      'window_status', 'upcoming',
      'window_start', v_exam.window_start
    );
  ELSIF v_exam.status = 'expired' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Waktu ujian sudah berakhir.',
      'window_status', 'closed'
    );
  END IF;
  -- v_exam.status = 'active' → proceed

  -- Compute window_status from timestamps
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

  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NOT NULL THEN
    IF v_exam.attempt_mode = 'single' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Kamu sudah menyelesaikan ujian ini.');
    ELSIF v_exam.attempt_mode = 'retake' AND v_window_status != 'open' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Kamu sudah menyelesaikan ujian ini.');
    END IF;
  END IF;

  -- Resume active session
  IF v_existing.id IS NOT NULL AND v_existing.submitted_at IS NULL AND v_existing.session_id IS NOT NULL THEN
    IF v_existing.deadline_at > now() AND v_window_status = 'open' THEN
      RETURN jsonb_build_object(
        'success', true,
        'session_id', v_existing.session_id,
        'question_count', v_exam.question_count,
        'expires_at', v_existing.deadline_at,
        'deadline_at', v_existing.deadline_at,
        'scheduled_exam_id', v_exam.id,
        'resuming', true,
        -- Exam metadata for UI display
        'scheduled_exam_title', v_exam.title,
        'scheduled_mapels', v_exam.mapels,
        'scheduled_babs', v_exam.babs,
        'scheduled_sub_babs', v_exam.sub_babs,
        'scheduled_time_limit_minutes', v_exam.time_limit_minutes
      );
    END IF;
  END IF;

  -- Block if window not open
  IF v_window_status = 'upcoming' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ujian belum dibuka.',
      'window_status', 'upcoming',
      'window_start', v_exam.window_start
    );
  ELSIF v_window_status = 'closed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Waktu ujian sudah berakhir.',
      'window_status', 'closed'
    );
  END IF;

  v_deadline := LEAST(
    now() + (v_exam.time_limit_minutes || ' minutes')::INTERVAL,
    v_exam.window_end
  );

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
    'success', true,
    'session_id', v_session_id,
    'question_count', v_question_count,
    'expires_at', v_deadline,
    'deadline_at', v_deadline,
    'scheduled_exam_id', v_exam.id,
    'resuming', false,
    -- Exam metadata for UI display
    'scheduled_exam_title', v_exam.title,
    'scheduled_mapels', v_exam.mapels,
    'scheduled_babs', v_exam.babs,
    'scheduled_sub_babs', v_exam.sub_babs,
    'scheduled_time_limit_minutes', v_exam.time_limit_minutes
  );
END;
$fn$;
