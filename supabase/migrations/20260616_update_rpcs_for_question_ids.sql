-- =====================================================
-- Step 1: Update start_scheduled_exam to save question_ids
-- =====================================================
-- Only change: add question_ids to the INSERT into scheduled_exam_attempts

CREATE OR REPLACE FUNCTION public.start_scheduled_exam(
  p_name text, p_access_code text, p_user_agent text DEFAULT NULL::text, p_secret text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
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
  IF NOT validate_exam_secret(p_secret) THEN
    RAISE EXCEPTION 'Unauthorized: invalid secret';
  END IF;

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

  IF v_exam.status = 'scheduled' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Ujian belum dimulai. Silakan tunggu hingga waktu yang ditentukan.',
      'window_status', 'upcoming', 'window_start', v_exam.window_start);
  ELSIF v_exam.status = 'expired' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Waktu ujian sudah berakhir.', 'window_status', 'closed');
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

  IF v_existing.id IS NOT NULL
     AND v_existing.submitted_at IS NULL
     AND v_existing.session_id IS NOT NULL
     AND v_existing.deadline_at > now()
     AND v_window_status = 'open' THEN
    RETURN jsonb_build_object(
      'success', true, 'session_id', v_existing.session_id,
      'question_count', v_exam.question_count,
      'expires_at', v_existing.deadline_at, 'deadline_at', v_existing.deadline_at,
      'scheduled_exam_id', v_exam.id, 'resuming', true,
      'scheduled_exam_title', v_exam.title,
      'scheduled_mapels', v_exam.mapels, 'scheduled_babs', v_exam.babs,
      'scheduled_sub_babs', v_exam.sub_babs,
      'scheduled_time_limit_minutes', v_exam.time_limit_minutes);
  END IF;

  IF v_window_status = 'upcoming' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ujian belum dibuka.',
      'window_status', 'upcoming', 'window_start', v_exam.window_start);
  ELSIF v_window_status = 'closed' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Waktu ujian sudah berakhir.', 'window_status', 'closed');
  END IF;

  v_deadline := LEAST(
    now() + (v_exam.time_limit_minutes || ' minutes')::INTERVAL,
    v_exam.window_end);

  v_nav_mode := COALESCE(v_exam.nav_mode, 'strict');

  IF v_exam.question_ids IS NOT NULL AND array_length(v_exam.question_ids, 1) > 0 THEN
    v_shuffled := v_exam.question_ids;
    v_n := array_length(v_shuffled, 1);
    v_i := v_n;
    WHILE v_i > 1 LOOP
      v_j := 1 + floor(random() * v_i)::int;
      v_tmp := v_shuffled[v_i];
      v_shuffled[v_i] := v_shuffled[v_j];
      v_shuffled[v_j] := v_tmp;
      v_i := v_i - 1;
    END LOOP;
    v_question_ids   := v_shuffled;
    v_question_count := v_n;

    INSERT INTO exam_logs (
      name, mapel, bab, sub_bab, mode,
      question_count, question_ids, expires_at, user_agent, nav_mode
    ) VALUES (
      p_name,
      array_to_string(v_exam.mapels, ', '),
      array_to_string(v_exam.babs, ', '),
      array_to_string(v_exam.sub_babs, ', '),
      v_exam.mode, v_question_count, v_question_ids,
      v_deadline, p_user_agent, v_nav_mode
    ) RETURNING session_id INTO v_session_id;
  ELSE
    v_session_result := start_exam_session(
      p_name, v_exam.mapels, v_exam.babs, v_exam.sub_babs,
      v_exam.mode, v_exam.question_count, 999999, p_user_agent, p_secret);
    v_session_id     := (v_session_result->>'session_id')::uuid;
    v_question_count := (v_session_result->>'question_count')::int;

    IF v_session_id IS NULL OR v_question_count IS NULL OR v_question_count = 0 THEN
      IF v_session_id IS NOT NULL THEN DELETE FROM exam_logs WHERE session_id = v_session_id; END IF;
      RETURN jsonb_build_object('success', false, 'error', 'Tidak ada soal yang tersedia untuk ujian ini.');
    END IF;

    UPDATE exam_logs SET expires_at = v_deadline WHERE session_id = v_session_id;

    -- Fetch the question_ids that start_exam_session assigned
    SELECT question_ids INTO v_question_ids FROM exam_logs WHERE session_id = v_session_id;
  END IF;

  -- ─── Register attempt WITH question_ids and empty user_answers ─────────
  INSERT INTO scheduled_exam_attempts
    (scheduled_exam_id, student_name, session_id, started_at, deadline_at, question_ids, user_answers)
  VALUES (v_exam.id, p_name, v_session_id, now(), v_deadline, v_question_ids, '{}'::jsonb);

  RETURN jsonb_build_object(
    'success', true, 'session_id', v_session_id,
    'question_count', v_question_count,
    'expires_at', v_deadline, 'deadline_at', v_deadline,
    'scheduled_exam_id', v_exam.id, 'resuming', false,
    'scheduled_exam_title', v_exam.title,
    'scheduled_mapels', v_exam.mapels, 'scheduled_babs', v_exam.babs,
    'scheduled_sub_babs', v_exam.sub_babs,
    'scheduled_time_limit_minutes', v_exam.time_limit_minutes);
END;
$$;

-- =====================================================
-- Step 2: Update submit_session_exam (2-arg) to save user_answers
-- =====================================================
CREATE OR REPLACE FUNCTION public.submit_session_exam(
  p_session_id uuid, p_end_time timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_log exam_logs%ROWTYPE;
  v_score INTEGER := 0;
  v_q_index INT;
  v_q_id INT;
  v_user_ans_text TEXT;
  v_question_type TEXT;
  v_correct_label CHAR(1);
  v_correct_text TEXT;
  v_short_answer TEXT;
  v_is_correct BOOLEAN;
  v_processed_answers JSONB := '[]'::jsonb;
  v_question_text TEXT;
  v_attempted INT := 0;
  v_duration_seconds INTEGER;
  -- New: structured user_answers for scheduled_exam_attempts
  v_user_answers_map JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO v_log FROM exam_logs WHERE session_id = p_session_id;
  IF v_log.session_id IS NULL THEN RAISE EXCEPTION 'Session not found'; END IF;

  v_duration_seconds := EXTRACT(EPOCH FROM (p_end_time - v_log.start_time))::INTEGER;
  UPDATE exam_logs SET is_finished = true WHERE session_id = p_session_id;

  FOR v_q_index IN 0..(
    CASE WHEN v_log.mode = 'survival'
      THEN COALESCE(array_length(v_log.question_ids, 1), 0) - 1
      ELSE v_log.question_count - 1 END
  ) LOOP
    v_user_ans_text := v_log.user_answers->>(v_q_index::text);
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

    v_processed_answers := v_processed_answers || jsonb_build_object(
      'question_id', v_q_id, 'user_answer', v_user_ans_text, 'is_correct', v_is_correct);

    -- Build index-keyed answer map for scheduled_exam_attempts.user_answers
    IF v_user_ans_text IS NOT NULL THEN
      v_user_answers_map := v_user_answers_map || jsonb_build_object(v_q_index::text, v_user_ans_text);
    END IF;
  END LOOP;

  INSERT INTO exam_results (name, score, total_questions, mapel, bab, sub_bab, question_count,
    taken_at, user_answers, start_time, end_time, mode, duration_seconds)
  VALUES (v_log.name, v_score,
    CASE WHEN v_log.mode = 'survival' THEN v_attempted ELSE v_log.question_count END,
    v_log.mapel, v_log.bab, v_log.sub_bab,
    CASE WHEN v_log.mode = 'survival' THEN v_attempted ELSE v_log.question_count END,
    p_end_time, v_processed_answers, v_log.start_time, p_end_time, v_log.mode, v_duration_seconds);

  -- Seal scheduled exam attempt: set submitted_at + score + user_answers
  UPDATE scheduled_exam_attempts
  SET submitted_at = p_end_time,
      score = v_score,
      user_answers = v_user_answers_map
  WHERE session_id = p_session_id
    AND submitted_at IS NULL;

  DELETE FROM exam_logs WHERE session_id = p_session_id;

  RETURN jsonb_build_object('score', v_score, 'total_attempted', v_attempted);
END;
$$;

-- =====================================================
-- Step 3: Update submit_session_exam (3-arg, sweeper overload)
-- =====================================================
CREATE OR REPLACE FUNCTION public.submit_session_exam(
  p_session_id uuid, p_answers jsonb, p_end_time timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_log exam_logs%ROWTYPE;
  v_score INTEGER := 0;
  v_elem JSONB;
  v_q_index INT;
  v_q_id INT;
  v_user_ans_text TEXT;
  v_correct_label CHAR(1);
  v_correct_text TEXT;
  v_is_correct BOOLEAN;
  v_processed_answers JSONB := '[]'::jsonb;
  v_question_text TEXT;
  v_user_answers_map JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO v_log FROM exam_logs WHERE session_id = p_session_id;
  IF v_log.session_id IS NULL THEN RAISE EXCEPTION 'Session not found'; END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_q_index := (v_elem->>'question_index')::INT;
    v_user_ans_text := v_elem->>'user_answer';
    v_q_id := v_log.question_ids[v_q_index + 1];

    IF v_q_id IS NOT NULL THEN
      SELECT question_text, correct_answer INTO v_question_text, v_correct_label
      FROM questions WHERE id = v_q_id;

      IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = v_q_id;
      ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = v_q_id;
      ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = v_q_id;
      ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = v_q_id;
      ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = v_q_id;
      END IF;

      v_is_correct := (regexp_replace(lower(strip_html(v_user_ans_text)), '\s+', '', 'g')
                     = regexp_replace(lower(strip_html(v_correct_text)), '\s+', '', 'g'));

      IF v_is_correct THEN v_score := v_score + 1; END IF;

      v_processed_answers := v_processed_answers || jsonb_build_object(
        'question_id', v_q_id, 'user_answer', v_user_ans_text, 'is_correct', v_is_correct);

      IF v_user_ans_text IS NOT NULL AND v_user_ans_text != 'skipped' THEN
        v_user_answers_map := v_user_answers_map || jsonb_build_object(v_q_index::text, v_user_ans_text);
      END IF;
    END IF;
  END LOOP;

  INSERT INTO exam_results (name, score, total_questions, mapel, bab, sub_bab, question_count,
    taken_at, user_answers, start_time, end_time, mode, duration_seconds)
  VALUES (v_log.name, v_score, v_log.question_count,
    v_log.mapel, v_log.bab, v_log.sub_bab, v_log.question_count,
    p_end_time, v_processed_answers, v_log.start_time, p_end_time, v_log.mode,
    EXTRACT(EPOCH FROM (p_end_time - v_log.start_time))::INTEGER);

  DELETE FROM exam_logs WHERE session_id = p_session_id;

  RETURN jsonb_build_object('score', v_score, 'user_answers', v_user_answers_map);
END;
$$;

-- =====================================================
-- Step 4: Update seal_overdue_scheduled_exams to save user_answers
-- =====================================================
CREATE OR REPLACE FUNCTION public.seal_overdue_scheduled_exams()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_attempt RECORD;
  v_log RECORD;
  v_answers JSONB;
  v_result JSONB;
  v_idx INT;
  v_elem JSONB;
  v_score INT;
  v_server_time TIMESTAMPTZ := now();
  v_user_answers JSONB;
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

    IF v_attempt.session_id IS NOT NULL THEN
      SELECT * INTO v_log FROM exam_logs WHERE session_id = v_attempt.session_id;
      IF v_log IS NOT NULL AND v_log.user_answers IS NOT NULL AND v_log.question_ids IS NOT NULL THEN
        v_answers := '[]'::jsonb;
        FOR v_elem IN SELECT * FROM jsonb_object_keys(v_log.user_answers) AS k(key)
        LOOP
          v_idx := (v_elem->>'key')::int;
          IF v_log.question_ids[v_idx + 1] IS NOT NULL THEN
            v_answers := v_answers || jsonb_build_object(
              'question_index', v_idx,
              'user_answer', v_log.user_answers->>(v_elem->>'key'));
          END IF;
        END LOOP;
        IF jsonb_array_length(v_answers) > 0 THEN
          v_result := submit_session_exam(v_attempt.session_id, v_answers, v_server_time);
          v_score := (v_result->>'score')::int;
          v_user_answers := v_result->'user_answers';
        ELSE
          UPDATE exam_logs SET is_finished = true WHERE session_id = v_attempt.session_id;
          v_score := 0;
          v_user_answers := '{}'::jsonb;
        END IF;
      ELSE
        UPDATE exam_logs SET is_finished = true WHERE session_id = v_attempt.session_id;
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
    WHERE id = v_attempt.id;
  END LOOP;
END;
$$;

-- =====================================================
-- Step 5: Update save_session_answer to sync user_answers to attempt
-- =====================================================
-- Extends existing function to also update scheduled_exam_attempts.user_answers
CREATE OR REPLACE FUNCTION public.save_session_answer(
  p_session_id uuid, p_index integer, p_answer_text text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_log exam_logs%ROWTYPE;
  v_question_id INT;
  v_correct_label CHAR(1);
  v_correct_text TEXT;
  v_is_correct BOOLEAN := false;
BEGIN
  SELECT * INTO v_log FROM exam_logs WHERE session_id = p_session_id;
  IF v_log.session_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  IF v_log.is_finished THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_finished');
  END IF;

  IF v_log.expires_at < NOW() THEN
    UPDATE exam_logs SET is_finished = true WHERE session_id = p_session_id;
    RETURN jsonb_build_object('success', false, 'error', 'time_expired');
  END IF;

  UPDATE exam_logs
  SET user_answers = jsonb_set(user_answers, ARRAY[p_index::text], to_jsonb(p_answer_text)),
      current_index = p_index
  WHERE session_id = p_session_id;

  -- Sync to scheduled_exam_attempts.user_answers
  UPDATE scheduled_exam_attempts
  SET user_answers = jsonb_set(user_answers, ARRAY[p_index::text], to_jsonb(p_answer_text))
  WHERE session_id = p_session_id
    AND submitted_at IS NULL;

  IF v_log.mode = 'survival' THEN
    v_question_id := v_log.question_ids[p_index + 1];
    IF v_question_id IS NOT NULL THEN
      SELECT correct_answer INTO v_correct_label FROM questions WHERE id = v_question_id;
      IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = v_question_id;
      END IF;

      v_is_correct := (strip_html(p_answer_text) = strip_html(v_correct_text));

      IF NOT v_is_correct THEN
        UPDATE exam_logs SET lives = GREATEST(0, lives - 1) WHERE session_id = p_session_id;
      END IF;

      RETURN jsonb_build_object('success', true, 'is_correct', v_is_correct);
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
