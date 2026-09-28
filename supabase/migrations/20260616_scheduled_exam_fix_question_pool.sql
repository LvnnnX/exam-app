-- Migration: fix start_scheduled_exam to use the stored question pool
-- (shuffled per-student) instead of calling start_exam_session which
-- re-selects random questions per student.
--
-- Root cause: the question_pool.sql migration's CREATE OR REPLACE was
-- silently ignored because enforce_status_rpc.sql ran AFTER and also
-- used CREATE OR REPLACE, and the body in the DB is the enforce_status
-- version which still delegates to start_exam_session. The exam pool
-- stored in scheduled_exams.question_ids was never used.
--
-- Fix:
--   1. DROP + CREATE the function so it's a clean slate.
--   2. Use scheduled_exams.question_ids as the fixed pool.
--   3. Shuffle the pool per-student using Fisher-Yates in PL/pgSQL.
--   4. INSERT directly into exam_logs (no start_exam_session call).
--   5. Fallback: if question_ids is NULL/empty, call start_exam_session
--      (backward compat for exams created before the pool feature).

DROP FUNCTION IF EXISTS public.start_scheduled_exam(text, text, text, text);

CREATE OR REPLACE FUNCTION public.start_scheduled_exam(
  p_name        text,
  p_access_code text,
  p_user_agent  text DEFAULT NULL,
  p_secret      text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_exam            RECORD;
  v_window_status   TEXT;
  v_existing        RECORD;
  v_deadline        TIMESTAMPTZ;
  v_session_id      UUID;
  v_question_ids    INT[];
  v_shuffled        INT[];
  v_question_count  INT;
  v_n               INT;
  v_i               INT;
  v_j               INT;
  v_tmp             INT;
  v_nav_mode        TEXT;
  v_session_result  JSONB;
BEGIN
  -- ─── 1. Auth ────────────────────────────────────────────────────────────
  IF NOT validate_exam_secret(p_secret) THEN
    RAISE EXCEPTION 'Unauthorized: invalid secret';
  END IF;

  -- ─── 2. Fetch exam ──────────────────────────────────────────────────────
  SELECT id, title, mapels, babs, sub_babs, mode, question_count,
         time_limit_minutes, window_start, window_end, attempt_mode,
         status, nav_mode, question_ids
  INTO v_exam
  FROM scheduled_exams
  WHERE access_code = p_access_code AND access_code IS NOT NULL
    AND status = 'active' AND is_visible = true;

  IF v_exam.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Exam not found or not available.');
  END IF;

  -- ─── 3. Status guard (belt-and-suspenders) ──────────────────────────────
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

  -- ─── 4. Window status ───────────────────────────────────────────────────
  IF now() < v_exam.window_start THEN
    v_window_status := 'upcoming';
  ELSIF now() > v_exam.window_end THEN
    v_window_status := 'closed';
  ELSE
    v_window_status := 'open';
  END IF;

  -- ─── 5. Attempt mode checks ─────────────────────────────────────────────
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

  -- ─── 6. Resume in-progress attempt ──────────────────────────────────────
  IF v_existing.id IS NOT NULL
     AND v_existing.submitted_at IS NULL
     AND v_existing.session_id IS NOT NULL
     AND v_existing.deadline_at > now()
     AND v_window_status = 'open' THEN
    RETURN jsonb_build_object(
      'success', true,
      'session_id', v_existing.session_id,
      'question_count', v_exam.question_count,
      'expires_at', v_existing.deadline_at,
      'deadline_at', v_existing.deadline_at,
      'scheduled_exam_id', v_exam.id,
      'resuming', true,
      'scheduled_exam_title', v_exam.title,
      'scheduled_mapels', v_exam.mapels,
      'scheduled_babs', v_exam.babs,
      'scheduled_sub_babs', v_exam.sub_babs,
      'scheduled_time_limit_minutes', v_exam.time_limit_minutes
    );
  END IF;

  -- ─── 7. Window guard ────────────────────────────────────────────────────
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

  -- ─── 8. Deadline ────────────────────────────────────────────────────────
  v_deadline := LEAST(
    now() + (v_exam.time_limit_minutes || ' minutes')::INTERVAL,
    v_exam.window_end
  );

  -- ─── 9. Question selection ───────────────────────────────────────────────
  -- If the exam has a stored question pool, use it with per-student shuffle.
  -- Fallback: delegate to start_exam_session (old behaviour, no pool).
  v_nav_mode := COALESCE(v_exam.nav_mode, 'strict');

  IF v_exam.question_ids IS NOT NULL AND array_length(v_exam.question_ids, 1) > 0 THEN
    -- Copy pool into local array
    v_shuffled := v_exam.question_ids;
    v_n := array_length(v_shuffled, 1);

    -- Fisher-Yates shuffle (1-indexed PL/pgSQL arrays)
    v_i := v_n;
    WHILE v_i > 1 LOOP
      v_j := 1 + floor(random() * v_i)::int;
      v_tmp        := v_shuffled[v_i];
      v_shuffled[v_i] := v_shuffled[v_j];
      v_shuffled[v_j] := v_tmp;
      v_i := v_i - 1;
    END LOOP;

    v_question_ids   := v_shuffled;
    v_question_count := v_n;

    -- Insert exam_logs row directly (bypass start_exam_session)
    INSERT INTO exam_logs (
      name, mapel, bab, sub_bab, mode,
      question_count, question_ids, expires_at, user_agent, nav_mode
    ) VALUES (
      p_name,
      array_to_string(v_exam.mapels,  ', '),
      array_to_string(v_exam.babs,    ', '),
      array_to_string(v_exam.sub_babs,', '),
      v_exam.mode,
      v_question_count,
      v_question_ids,
      v_deadline,
      p_user_agent,
      v_nav_mode
    )
    RETURNING session_id INTO v_session_id;

  ELSE
    -- Fallback: original behaviour (no stored pool)
    v_session_result := start_exam_session(
      p_name, v_exam.mapels, v_exam.babs, v_exam.sub_babs,
      v_exam.mode, v_exam.question_count,
      999999, p_user_agent, p_secret
    );
    v_session_id     := (v_session_result->>'session_id')::uuid;
    v_question_count := (v_session_result->>'question_count')::int;

    IF v_session_id IS NULL OR v_question_count IS NULL OR v_question_count = 0 THEN
      IF v_session_id IS NOT NULL THEN
        DELETE FROM exam_logs WHERE session_id = v_session_id;
      END IF;
      RETURN jsonb_build_object('success', false, 'error', 'Tidak ada soal yang tersedia untuk ujian ini.');
    END IF;

    UPDATE exam_logs SET expires_at = v_deadline WHERE session_id = v_session_id;
  END IF;

  -- ─── 10. Register attempt ────────────────────────────────────────────────
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
    'scheduled_exam_title', v_exam.title,
    'scheduled_mapels', v_exam.mapels,
    'scheduled_babs', v_exam.babs,
    'scheduled_sub_babs', v_exam.sub_babs,
    'scheduled_time_limit_minutes', v_exam.time_limit_minutes
  );
END;
$fn$;
