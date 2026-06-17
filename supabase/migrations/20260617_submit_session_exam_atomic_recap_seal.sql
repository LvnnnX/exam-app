-- Atomic recap seal: submit_session_exam (2-arg) sekarang
-- 1. Build v_recap dengan 5-field shape (question_id, question_text, correct_text, user_answer, is_correct)
--    sesuai dengan RecapItem TS type — sebelumnya 3-field bikin ResultsRecapList render kosong di
--    question_text + correct_text.
-- 2. UPDATE scheduled_exam_attempts SET ..., recap = v_recap dalam transaction yang sama.
--    Sebelumnya recap column ga ke-persist karena finalize_scheduled_exam_attempt
--    NO-OP akibat guard WHERE submitted_at IS NULL (submit sudah stamp duluan).
-- 3. exam_results.user_answers tetap pakai v_processed_answers 3-field (backward compat — ga
--    ubah shape historical column).
--
-- DROP dulu sesuai supabase-app-ops skill: CREATE OR REPLACE bisa silently keep stale body.

DROP FUNCTION IF EXISTS public.submit_session_exam(uuid, timestamptz);

CREATE OR REPLACE FUNCTION public.submit_session_exam(
  p_session_id UUID,
  p_end_time TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_processed_answers JSONB := '[]'::jsonb;  -- 3-field, untuk exam_results.user_answers
  v_recap JSONB := '[]'::jsonb;              -- 5-field, untuk client + recap column
  v_question_text TEXT;
  v_attempted INT := 0;
  v_duration_seconds INTEGER;
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

    -- 3-field minimal untuk exam_results.user_answers (backward compat dengan history page)
    v_processed_answers := v_processed_answers || jsonb_build_object(
      'question_id', v_q_id, 'user_answer', v_user_ans_text, 'is_correct', v_is_correct);

    -- 5-field full untuk client recap render + scheduled_exam_attempts.recap column
    v_recap := v_recap || jsonb_build_object(
      'question_id', v_q_id,
      'question_text', v_question_text,
      'correct_text', v_correct_text,
      'user_answer', v_user_ans_text,
      'is_correct', v_is_correct);

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

  -- ATOMIC SEAL: stamp submitted_at + score + user_answers + recap di SINGLE statement.
  -- Bootstrap restore (get_scheduled_exam_recap) sekarang bisa baca recap column.
  UPDATE scheduled_exam_attempts
  SET submitted_at = p_end_time,
      score = v_score,
      user_answers = v_user_answers_map,
      recap = v_recap
  WHERE session_id = p_session_id
    AND submitted_at IS NULL;

  DELETE FROM exam_logs WHERE session_id = p_session_id;

  RETURN jsonb_build_object('score', v_score, 'total_attempted', v_attempted, 'recap', v_recap);
END;
$$;
