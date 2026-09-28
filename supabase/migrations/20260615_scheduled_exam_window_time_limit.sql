-- Scheduled Exam (Window + Time Limit) migration
-- 2026-06-15
--
-- Tables: scheduled_exams, scheduled_exam_attempts
-- RPCs: get_scheduled_exam, start_scheduled_exam, submit_scheduled_exam_attempt,
--        seal_overdue_scheduled_exams, create_scheduled_exam, publish_scheduled_exam
-- pg_cron: seal_overdue_scheduled_exams (every minute)

-- ═══════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.scheduled_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  mapels text[] NOT NULL DEFAULT '{}',
  babs text[] NOT NULL DEFAULT '{}',
  sub_babs text[] NOT NULL DEFAULT '{}',
  mode text NOT NULL DEFAULT 'exam',
  question_count integer NOT NULL DEFAULT 20,
  time_limit_minutes integer NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  attempt_mode text NOT NULL DEFAULT 'single',
  access_code text,
  status text NOT NULL DEFAULT 'draft',
  is_visible boolean NOT NULL DEFAULT false,
  CONSTRAINT scheduled_exams_attempt_mode_check CHECK (attempt_mode IN ('single', 'retake')),
  CONSTRAINT scheduled_exams_status_check CHECK (status IN ('draft', 'published', 'closed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scheduled_exams_access_code
  ON public.scheduled_exams(access_code) WHERE access_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.scheduled_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_exam_id uuid NOT NULL REFERENCES public.scheduled_exams(id),
  student_name text NOT NULL,
  session_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz,
  submitted_at timestamptz,
  auto_submitted boolean NOT NULL DEFAULT false,
  score integer
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_scheduled_attempts_session') THEN
    ALTER TABLE public.scheduled_exam_attempts
      ADD CONSTRAINT fk_scheduled_attempts_session
      FOREIGN KEY (session_id) REFERENCES public.exam_logs(session_id) ON DELETE SET NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════

ALTER TABLE public.scheduled_exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheduled_exams_admin_all ON public.scheduled_exams;
CREATE POLICY scheduled_exams_admin_all ON public.scheduled_exams
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS scheduled_exams_service_read ON public.scheduled_exams;
CREATE POLICY scheduled_exams_service_read ON public.scheduled_exams
  FOR SELECT TO anon USING (is_valid_secret());

ALTER TABLE public.scheduled_exam_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheduled_exam_attempts_admin_all ON public.scheduled_exam_attempts;
CREATE POLICY scheduled_exam_attempts_admin_all ON public.scheduled_exam_attempts
  FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS scheduled_exam_attempts_service_insert ON public.scheduled_exam_attempts;
CREATE POLICY scheduled_exam_attempts_service_insert ON public.scheduled_exam_attempts
  FOR INSERT TO anon WITH CHECK (is_valid_secret());

-- ═══════════════════════════════════════════
-- PUBLIC VIEW
-- ═══════════════════════════════════════════

CREATE OR REPLACE VIEW public_scheduled_exams WITH (security_invoker = true) AS
  SELECT id, title, mapels, babs, sub_babs, mode, question_count,
         time_limit_minutes, window_start, window_end, attempt_mode,
         status, is_visible, created_at
  FROM scheduled_exams
  WHERE is_visible = true AND status != 'closed';

GRANT SELECT ON public_scheduled_exams TO anon;
GRANT SELECT ON public_scheduled_exams TO authenticated;

-- ═══════════════════════════════════════════
-- RPCs
-- ═══════════════════════════════════════════

-- Student: look up a scheduled exam by access code
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
    AND status != 'closed';

  IF v_exam.id IS NULL OR v_exam.status = 'draft' THEN
    RETURN jsonb_build_object('found', false, 'error', 'Kode akses tidak ditemukan atau ujian sudah ditutup.');
  END IF;

  IF now() < v_exam.window_start THEN v_window_status := 'upcoming';
  ELSIF now() > v_exam.window_end THEN v_window_status := 'closed';
  ELSE v_window_status := 'open';
  END IF;

  RETURN jsonb_build_object(
    'found', true, 'id', v_exam.id, 'title', v_exam.title,
    'mapels', v_exam.mapels, 'babs', v_exam.babs, 'sub_babs', v_exam.sub_babs,
    'mode', v_exam.mode, 'question_count', v_exam.question_count,
    'time_limit_minutes', v_exam.time_limit_minutes,
    'window_start', v_exam.window_start, 'window_end', v_exam.window_end,
    'attempt_mode', v_exam.attempt_mode, 'window_status', v_window_status
  );
END;
$fn$;

-- Student: start or resume a scheduled exam
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
         time_limit_minutes, window_start, window_end, attempt_mode
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
        'deadline_at', v_existing.deadline_at, 'scheduled_exam_id', v_exam.id, 'resuming', true);
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
    'deadline_at', v_deadline, 'scheduled_exam_id', v_exam.id, 'resuming', false
  );
END;
$fn$;

-- Student/server: submit (or seal) an attempt
CREATE OR REPLACE FUNCTION public.submit_scheduled_exam_attempt(
  p_attempt_id uuid, p_secret text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_attempt RECORD;
  v_log RECORD;
  v_answers JSONB := '[]'::jsonb;
  v_elem JSONB;
  v_result JSONB;
  v_idx INT;
  v_server_time TIMESTAMPTZ := now();
BEGIN
  IF NOT validate_exam_secret(p_secret) THEN
    RAISE EXCEPTION 'Unauthorized: invalid secret';
  END IF;

  SELECT sea.id, sea.session_id, sea.submitted_at, sea.deadline_at,
         sea.scheduled_exam_id, sea.student_name, se.question_count
  INTO v_attempt
  FROM scheduled_exam_attempts sea
  JOIN scheduled_exams se ON se.id = sea.scheduled_exam_id
  WHERE sea.id = p_attempt_id;

  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Attempt not found');
  END IF;

  IF v_attempt.submitted_at IS NOT NULL THEN
    SELECT er.score INTO v_attempt.score FROM exam_results er
    WHERE er.name = v_attempt.student_name ORDER BY er.taken_at DESC LIMIT 1;
    RETURN jsonb_build_object('success', true, 'already_submitted', true,
      'score', v_attempt.score, 'total', v_attempt.question_count);
  END IF;

  IF v_attempt.deadline_at IS NOT NULL AND v_server_time < v_attempt.deadline_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ujian belum berakhir.',
      'deadline_at', v_attempt.deadline_at);
  END IF;

  IF v_attempt.session_id IS NOT NULL THEN
    SELECT * INTO v_log FROM exam_logs WHERE session_id = v_attempt.session_id;
    IF v_log IS NOT NULL AND v_log.user_answers IS NOT NULL AND v_log.question_ids IS NOT NULL THEN
      FOR v_elem IN SELECT jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_log.user_answers) = 'object'
             THEN (SELECT jsonb_agg(key) FROM jsonb_object_keys(v_log.user_answers) AS k(key))
             ELSE '[]'::jsonb END)
      LOOP
        v_idx := v_elem::text::int;
        IF v_log.question_ids[v_idx + 1] IS NOT NULL THEN
          v_answers := v_answers || jsonb_build_object(
            'question_index', v_idx,
            'user_answer', v_log.user_answers->>v_idx::text
          );
        END IF;
      END LOOP;

      IF jsonb_array_length(v_answers) > 0 THEN
        v_result := submit_session_exam(v_attempt.session_id, v_answers, v_server_time);
        UPDATE scheduled_exam_attempts SET score = (v_result->>'score')::int,
          auto_submitted = true, submitted_at = v_server_time WHERE id = v_attempt.id;
        RETURN jsonb_build_object('success', true, 'auto_submitted', true,
          'score', (v_result->>'score')::int, 'total', v_attempt.question_count);
      END IF;
    END IF;
    UPDATE exam_logs SET is_finished = true WHERE session_id = v_attempt.session_id;
  END IF;

  UPDATE scheduled_exam_attempts SET score = 0, auto_submitted = true,
    submitted_at = v_server_time WHERE id = v_attempt.id;
  RETURN jsonb_build_object('success', true, 'auto_submitted', true,
    'score', 0, 'total', v_attempt.question_count);
END;
$fn$;

-- pg_cron sweeper: auto-submit overdue attempts
CREATE OR REPLACE FUNCTION public.seal_overdue_scheduled_exams()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_attempt RECORD;
  v_log RECORD;
  v_answers JSONB;
  v_result JSONB;
  v_score INT;
  v_elem JSONB;
  v_idx INT;
  v_server_time TIMESTAMPTZ := now();
BEGIN
  FOR v_attempt IN
    SELECT sea.id, sea.session_id, sea.student_name, se.question_count
    FROM scheduled_exam_attempts sea
    JOIN scheduled_exams se ON se.id = sea.scheduled_exam_id
    WHERE sea.submitted_at IS NULL AND sea.deadline_at IS NOT NULL AND sea.deadline_at <= v_server_time
  LOOP
    IF v_attempt.session_id IS NOT NULL THEN
      SELECT * INTO v_log FROM exam_logs WHERE session_id = v_attempt.session_id;
      IF v_log IS NOT NULL AND v_log.user_answers IS NOT NULL AND v_log.question_ids IS NOT NULL THEN
        v_answers := '[]'::jsonb;
        FOR v_elem IN SELECT jsonb_array_elements(
          CASE WHEN jsonb_typeof(v_log.user_answers) = 'object'
               THEN (SELECT jsonb_agg(key) FROM jsonb_object_keys(v_log.user_answers) AS k(key))
               ELSE '[]'::jsonb END)
        LOOP
          v_idx := v_elem::text::int;
          IF v_log.question_ids[v_idx + 1] IS NOT NULL THEN
            v_answers := v_answers || jsonb_build_object(
              'question_index', v_idx,
              'user_answer', v_log.user_answers->>v_idx::text
            );
          END IF;
        END LOOP;
        IF jsonb_array_length(v_answers) > 0 THEN
          v_result := submit_session_exam(v_attempt.session_id, v_answers, v_server_time);
          v_score := (v_result->>'score')::int;
        ELSE
          UPDATE exam_logs SET is_finished = true WHERE session_id = v_attempt.session_id;
          v_score := 0;
        END IF;
      ELSE
        UPDATE exam_logs SET is_finished = true WHERE session_id = v_attempt.session_id;
        v_score := 0;
      END IF;
    ELSE
      v_score := 0;
    END IF;
    UPDATE scheduled_exam_attempts SET score = v_score,
      auto_submitted = true, submitted_at = v_server_time WHERE id = v_attempt.id;
  END LOOP;
END;
$fn$;

-- Admin: create a scheduled exam (draft)
CREATE OR REPLACE FUNCTION public.create_scheduled_exam(
  p_title text, p_created_by uuid, p_mapels text[], p_babs text[],
  p_sub_babs text[], p_mode text, p_question_count int,
  p_time_limit_minutes int, p_window_start timestamptz, p_window_end timestamptz,
  p_attempt_mode text, p_access_code text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_id UUID;
  v_safe_title TEXT := trim(p_title);
  v_safe_code TEXT := CASE WHEN p_access_code IS NOT NULL THEN trim(p_access_code) ELSE NULL END;
BEGIN
  IF v_safe_code IS NOT NULL AND EXISTS (SELECT 1 FROM scheduled_exams WHERE access_code = v_safe_code) THEN
    RAISE EXCEPTION 'Access code already exists';
  END IF;
  IF p_time_limit_minutes <= 0 THEN RAISE EXCEPTION 'time_limit_minutes must be positive'; END IF;
  IF p_window_end <= p_window_start THEN RAISE EXCEPTION 'window_end must be after window_start'; END IF;

  INSERT INTO scheduled_exams (title, created_by, mapels, babs, sub_babs, mode,
    question_count, time_limit_minutes, window_start, window_end, attempt_mode,
    access_code, status, is_visible)
  VALUES (v_safe_title, p_created_by, p_mapels, p_babs, p_sub_babs, p_mode,
    p_question_count, p_time_limit_minutes, p_window_start, p_window_end,
    p_attempt_mode, v_safe_code, 'draft', false)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- Admin: publish a scheduled exam
CREATE OR REPLACE FUNCTION public.publish_scheduled_exam(p_exam_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM scheduled_exams WHERE id = p_exam_id) THEN
    RAISE EXCEPTION 'Exam not found';
  END IF;
  UPDATE scheduled_exams SET status = 'published', is_visible = true WHERE id = p_exam_id;
  RETURN true;
END;
$fn$;

-- ═══════════════════════════════════════════
-- pg_cron
-- ═══════════════════════════════════════════

SELECT cron.schedule('seal_overdue_scheduled_exams', '* * * * *', 'SELECT public.seal_overdue_scheduled_exams()');
