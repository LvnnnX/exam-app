-- Make submit_session_exam authoritative for sealing scheduled exam attempts.
-- Root cause: the admin timer (formatDuration) counts now() - started_at while
-- submitted_at IS NULL. The client-side finalizeScheduledExamAttemptAction is
-- fragile (never fires if the tab closes), so attempts stay open forever.
-- Fix: stamp scheduled_exam_attempts (submitted_at + score + recap) inside
-- submit_session_exam itself. Idempotent + no-op for non-scheduled sessions.

CREATE OR REPLACE FUNCTION public.submit_session_exam(p_session_id uuid, p_end_time timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  v_recap JSONB := '[]'::jsonb;
  v_question_text TEXT;
  v_attempted INT := 0;
  v_duration_seconds INTEGER;
BEGIN
  SELECT * INTO v_log FROM exam_logs WHERE session_id = p_session_id;

  IF v_log.session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  v_duration_seconds := EXTRACT(EPOCH FROM (p_end_time - v_log.start_time))::INTEGER;

  UPDATE exam_logs SET is_finished = true WHERE session_id = p_session_id;

  FOR v_q_index IN 0..(
    CASE WHEN v_log.mode = 'survival'
      THEN COALESCE(array_length(v_log.question_ids, 1), 0) - 1
      ELSE v_log.question_count - 1
    END
  )
  LOOP
    v_user_ans_text := v_log.user_answers->>(v_q_index::text);
    v_q_id := v_log.question_ids[v_q_index + 1];

    IF v_q_id IS NULL THEN
      CONTINUE;
    END IF;

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
      v_is_correct := (regexp_replace(lower(strip_html(v_user_ans_text)), '\s+', '', 'g') = regexp_replace(lower(strip_html(v_correct_text)), '\s+', '', 'g'));
    ELSE
      v_is_correct := false;
      v_user_ans_text := NULL;
    END IF;

    IF v_is_correct THEN
      v_score := v_score + 1;
    END IF;

    IF v_log.mode = 'survival' AND v_user_ans_text IS NULL THEN
      CONTINUE;
    END IF;

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

  INSERT INTO exam_results (name, score, total_questions, mapel, bab, sub_bab, question_count, taken_at, user_answers, start_time, end_time, mode, duration_seconds)
  VALUES (
    v_log.name,
    v_score,
    CASE WHEN v_log.mode = 'survival' THEN v_attempted ELSE v_log.question_count END,
    v_log.mapel,
    v_log.bab,
    v_log.sub_bab,
    CASE WHEN v_log.mode = 'survival' THEN v_attempted ELSE v_log.question_count END,
    p_end_time,
    v_processed_answers,
    v_log.start_time,
    p_end_time,
    v_log.mode,
    v_duration_seconds
  );

  -- Seal scheduled exam attempt (idempotent; no-op for non-scheduled sessions).
  -- This is the authoritative stamp so the admin timer stops regardless of
  -- whether the client-side finalize call fires.
  UPDATE scheduled_exam_attempts
  SET submitted_at = p_end_time,
      score = v_score,
      recap = v_recap
  WHERE session_id = p_session_id
    AND submitted_at IS NULL;

  DELETE FROM exam_logs WHERE session_id = p_session_id;

  RETURN jsonb_build_object('score', v_score, 'recap', v_recap, 'total_attempted', v_attempted);
END;
$function$;
