-- Migration: 20260617 cron + recap criticals fix
-- Repairs five production bugs in scheduled-exam infrastructure:
--   CRIT-2: activate_scheduled_exams must also flip is_visible=true
--   CRIT-3: seal_overdue_scheduled_exams iterates jsonb_object_keys wrong (NULL keys)
--   CRIT-4: 3-arg submit_session_exam (sweeper variant) writes nothing atomic to attempts
--   CRIT-5: get_scheduled_exam_recap reads sea.recap with fallback to reconstruction
--   HIGH-1: finalize_scheduled_exam_attempt missing WHERE submitted_at IS NULL guard

-- =====================================================
-- 1. CRIT-2: activate_scheduled_exams flips is_visible too
-- =====================================================
DROP FUNCTION IF EXISTS public.activate_scheduled_exams();

CREATE OR REPLACE FUNCTION public.activate_scheduled_exams()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  UPDATE scheduled_exams
  SET status = 'active',
      is_visible = true
  WHERE status = 'scheduled'
    AND window_start <= NOW();
END;
$fn$;

-- =====================================================
-- 2. CRIT-4: 3-arg submit_session_exam (sweeper variant)
-- =====================================================
DROP FUNCTION IF EXISTS public.submit_session_exam(uuid, jsonb, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.submit_session_exam(
  p_session_id uuid,
  p_answers jsonb,
  p_finalize_at timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_log exam_logs%ROWTYPE;
  v_score INT := 0;
  v_attempted INT := 0;
  v_elem JSONB;
  v_q_index INT;
  v_q_id INT;
  v_user_ans_text TEXT;
  v_question_type TEXT;
  v_question_text TEXT;
  v_correct_label CHAR(1);
  v_correct_text TEXT;
  v_short_answer TEXT;
  v_is_correct BOOLEAN;
  v_user_answers JSONB := '{}'::jsonb;
  v_recap JSONB := '[]'::jsonb;
  v_processed_answers JSONB := '[]'::jsonb;
  v_duration_seconds INTEGER;
BEGIN
  SELECT * INTO v_log FROM exam_logs WHERE session_id = p_session_id;
  IF v_log.session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  v_duration_seconds := EXTRACT(EPOCH FROM (p_finalize_at - v_log.start_time))::INTEGER;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_q_index := (v_elem->>'question_index')::INT;
    v_user_ans_text := v_elem->>'user_answer';
    v_q_id := v_log.question_ids[v_q_index + 1];
    IF v_q_id IS NULL THEN CONTINUE; END IF;

    SELECT question_text, question_type, correct_answer, short_answer
    INTO v_question_text, v_question_type, v_correct_label, v_short_answer
    FROM questions WHERE id = v_q_id;

    IF v_question_type = 'short_answer' THEN
      v_correct_text := COALESCE(v_short_answer, '');
    ELSE
      IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = v_q_id;
      ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = v_q_id;
      ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = v_q_id;
      ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = v_q_id;
      ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = v_q_id;
      END IF;
    END IF;

    IF v_user_ans_text IS NOT NULL AND v_user_ans_text != 'skipped' THEN
      v_attempted := v_attempted + 1;
      v_is_correct := (regexp_replace(lower(strip_html(v_user_ans_text)), '\s+', '', 'g')
                     = regexp_replace(lower(strip_html(v_correct_text)), '\s+', '', 'g'));
    ELSE
      v_is_correct := false;
      v_user_ans_text := NULL;
    END IF;

    IF v_is_correct THEN v_score := v_score + 1; END IF;
    IF v_log.mode = 'survival' AND v_user_ans_text IS NULL THEN CONTINUE; END IF;

    v_user_answers := v_user_answers || jsonb_build_object(
      v_q_index::text,
      COALESCE(v_user_ans_text, 'skipped')
    );
    v_processed_answers := v_processed_answers || jsonb_build_object(
      'question_id', v_q_id,
      'user_answer', v_user_ans_text,
      'is_correct', v_is_correct
    );
    v_recap := v_recap || jsonb_build_object(
      'question_id', v_q_id,
      'question_text', v_question_text,
      'user_answer', v_user_ans_text,
      'correct_text', v_correct_text,
      'is_correct', v_is_correct
    );
  END LOOP;

  UPDATE exam_logs SET is_finished = true WHERE session_id = p_session_id;

  INSERT INTO exam_results (
    name, score, total_questions, mapel, bab, sub_bab, question_count,
    taken_at, user_answers, start_time, end_time, mode, duration_seconds
  ) VALUES (
    v_log.name,
    v_score,
    CASE WHEN v_log.mode = 'survival' THEN v_attempted ELSE v_log.question_count END,
    v_log.mapel, v_log.bab, v_log.sub_bab,
    CASE WHEN v_log.mode = 'survival' THEN v_attempted ELSE v_log.question_count END,
    p_finalize_at, v_processed_answers, v_log.start_time, p_finalize_at, v_log.mode, v_duration_seconds
  );

  UPDATE scheduled_exam_attempts
  SET submitted_at = p_finalize_at,
      auto_submitted = true,
      score = v_score,
      user_answers = v_user_answers,
      recap = v_recap
  WHERE session_id = p_session_id
    AND submitted_at IS NULL;

  DELETE FROM exam_logs WHERE session_id = p_session_id;

  RETURN jsonb_build_object(
    'score', v_score,
    'recap', v_recap,
    'total_attempted', v_attempted,
    'user_answers', v_user_answers
  );
END;
$fn$;

-- =====================================================
-- 3. CRIT-3: seal_overdue_scheduled_exams uses jsonb_each_text
-- =====================================================
DROP FUNCTION IF EXISTS public.seal_overdue_scheduled_exams();

CREATE OR REPLACE FUNCTION public.seal_overdue_scheduled_exams()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_attempt RECORD;
  v_log RECORD;
  v_answers JSONB;
  v_result JSONB;
  v_idx INT;
  v_key TEXT;
  v_value TEXT;
  v_score INT;
  v_user_answers JSONB;
  v_server_time TIMESTAMPTZ := now();
BEGIN
  FOR v_attempt IN
    SELECT sea.id, sea.session_id, sea.student_name, se.question_count
    FROM scheduled_exam_attempts sea
    JOIN scheduled_exams se ON se.id = sea.scheduled_exam_id
    WHERE sea.submitted_at IS NULL
      AND sea.deadline_at IS NOT NULL
      AND sea.deadline_at <= v_server_time
  LOOP
    v_user_answers := NULL;
    v_score := 0;

    IF v_attempt.session_id IS NOT NULL THEN
      SELECT * INTO v_log FROM exam_logs WHERE session_id = v_attempt.session_id;
      IF v_log IS NOT NULL AND v_log.user_answers IS NOT NULL AND v_log.question_ids IS NOT NULL THEN
        v_answers := '[]'::jsonb;
        FOR v_key, v_value IN
          SELECT * FROM jsonb_each_text(COALESCE(v_log.user_answers, '{}'::jsonb))
        LOOP
          v_idx := v_key::int;
          IF v_log.question_ids[v_idx + 1] IS NOT NULL THEN
            v_answers := v_answers || jsonb_build_object(
              'question_index', v_idx,
              'user_answer', v_value
            );
          END IF;
        END LOOP;

        IF jsonb_array_length(v_answers) > 0 THEN
          v_result := submit_session_exam(v_attempt.session_id, v_answers, v_server_time);
          v_score := COALESCE((v_result->>'score')::int, 0);
          v_user_answers := v_result->'user_answers';
        ELSE
          UPDATE exam_logs SET is_finished = true WHERE session_id = v_attempt.session_id;
          v_score := 0;
          v_user_answers := '{}'::jsonb;
        END IF;
      ELSE
        IF v_log.session_id IS NOT NULL THEN
          UPDATE exam_logs SET is_finished = true WHERE session_id = v_attempt.session_id;
        END IF;
        v_score := 0;
        v_user_answers := '{}'::jsonb;
      END IF;
    ELSE
      v_score := 0;
      v_user_answers := '{}'::jsonb;
    END IF;

    UPDATE scheduled_exam_attempts
    SET score = v_score,
        auto_submitted = true,
        submitted_at = v_server_time,
        user_answers = COALESCE(v_user_answers, user_answers)
    WHERE id = v_attempt.id
      AND submitted_at IS NULL;
  END LOOP;
END;
$fn$;

-- =====================================================
-- 4. CRIT-5: get_scheduled_exam_recap reads sea.recap first
-- =====================================================
DROP FUNCTION IF EXISTS public.get_scheduled_exam_recap(uuid);

CREATE OR REPLACE FUNCTION public.get_scheduled_exam_recap(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_attempt RECORD;
  v_recap_stored jsonb;
  v_recap jsonb := '[]'::jsonb;
  v_q_index integer;
  v_q_id integer;
  v_user_ans_text text;
  v_correct_label CHAR(1);
  v_correct_text text;
  v_short_answer text;
  v_question_type text;
  v_question_text text;
  v_is_correct boolean;
BEGIN
  SELECT sea.recap, sea.question_ids, sea.user_answers, sea.score,
         se.question_count, sea.student_name, sea.started_at, sea.submitted_at
  INTO v_attempt
  FROM scheduled_exam_attempts sea
  JOIN scheduled_exams se ON se.id = sea.scheduled_exam_id
  WHERE sea.session_id = p_session_id
    AND sea.submitted_at IS NOT NULL;

  IF v_attempt.student_name IS NULL THEN
    RETURN NULL;
  END IF;

  v_recap_stored := v_attempt.recap;

  IF v_recap_stored IS NOT NULL AND jsonb_array_length(v_recap_stored) > 0 THEN
    RETURN jsonb_build_object(
      'recap', v_recap_stored,
      'score', COALESCE(v_attempt.score, 0),
      'total', COALESCE(v_attempt.question_count, 0),
      'name', v_attempt.student_name,
      'started_at', v_attempt.started_at,
      'submitted_at', v_attempt.submitted_at
    );
  END IF;

  IF v_attempt.question_ids IS NOT NULL AND array_length(v_attempt.question_ids, 1) > 0 THEN
    FOR v_q_index IN 0..(array_length(v_attempt.question_ids, 1) - 1)
    LOOP
      v_q_id := v_attempt.question_ids[v_q_index + 1];
      IF v_q_id IS NULL THEN CONTINUE; END IF;
      v_user_ans_text := v_attempt.user_answers->>(v_q_index::text);

      SELECT question_text, question_type, correct_answer, short_answer
      INTO v_question_text, v_question_type, v_correct_label, v_short_answer
      FROM questions WHERE id = v_q_id;

      IF v_question_type = 'short_answer' THEN
        v_correct_text := COALESCE(v_short_answer, '');
      ELSE
        IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = v_q_id;
        END IF;
      END IF;

      IF v_user_ans_text IS NOT NULL AND v_user_ans_text != 'skipped' THEN
        v_is_correct := (regexp_replace(lower(strip_html(v_user_ans_text)), '\s+', '', 'g')
                       = regexp_replace(lower(strip_html(v_correct_text)), '\s+', '', 'g'));
      ELSE
        v_is_correct := false;
      END IF;

      v_recap := v_recap || jsonb_build_object(
        'question_id', v_q_id,
        'question_text', v_question_text,
        'user_answer', v_user_ans_text,
        'correct_text', v_correct_text,
        'is_correct', v_is_correct
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'recap', v_recap,
    'score', COALESCE(v_attempt.score, 0),
    'total', COALESCE(v_attempt.question_count, 0),
    'name', v_attempt.student_name,
    'started_at', v_attempt.started_at,
    'submitted_at', v_attempt.submitted_at
  );
END;
$fn$;

-- =====================================================
-- 5. HIGH-1: finalize_scheduled_exam_attempt
-- =====================================================
DROP FUNCTION IF EXISTS public.finalize_scheduled_exam_attempt(uuid, integer, jsonb);

CREATE OR REPLACE FUNCTION public.finalize_scheduled_exam_attempt(
  p_session_id uuid,
  p_score integer,
  p_recap jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_user_answers jsonb := '{}'::jsonb;
  v_elem jsonb;
  v_q_index_text text;
BEGIN
  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_recap, '[]'::jsonb))
  LOOP
    v_q_index_text := COALESCE(v_elem->>'question_index', NULL);
    IF v_q_index_text IS NULL THEN CONTINUE; END IF;

    IF v_elem->>'user_answer' IS NOT NULL THEN
      v_user_answers := v_user_answers || jsonb_build_object(v_q_index_text, v_elem->>'user_answer');
    ELSE
      v_user_answers := v_user_answers || jsonb_build_object(v_q_index_text, 'skipped');
    END IF;
  END LOOP;

  UPDATE scheduled_exam_attempts
  SET submitted_at = now(),
      score = p_score,
      recap = p_recap,
      user_answers = CASE
        WHEN v_user_answers = '{}'::jsonb THEN user_answers
        ELSE v_user_answers
      END
  WHERE session_id = p_session_id
    AND submitted_at IS NULL;
END;
$fn$;
