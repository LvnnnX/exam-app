-- Fix sweeper overload: remove 'category' dependency which no longer exists.
CREATE OR REPLACE FUNCTION public.submit_session_exam(p_session_id uuid, p_answers jsonb, p_end_time timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  v_recap JSONB := '[]'::jsonb;
  v_question_text TEXT;
BEGIN
  SELECT * INTO v_log FROM exam_logs WHERE session_id = p_session_id;

  IF v_log.session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_q_index := (v_elem->>'question_index')::INT;
    v_user_ans_text := v_elem->>'user_answer';
    v_q_id := v_log.question_ids[v_q_index + 1];

    IF v_q_id IS NOT NULL THEN
        SELECT question_text, correct_answer INTO v_question_text, v_correct_label FROM questions WHERE id = v_q_id;

        IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = v_q_id;
        END IF;

        v_is_correct := (regexp_replace(lower(strip_html(v_user_ans_text)), '\s+', '', 'g') = regexp_replace(lower(strip_html(v_correct_text)), '\s+', '', 'g'));

        IF v_is_correct THEN
          v_score := v_score + 1;
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
    END IF;
  END LOOP;

  INSERT INTO exam_results (name, score, total_questions, mapel, bab, sub_bab, question_count, taken_at, user_answers, start_time, end_time, mode, duration_seconds)
  VALUES (v_log.name, v_score, v_log.question_count, v_log.mapel, v_log.bab, v_log.sub_bab, v_log.question_count, p_end_time, v_processed_answers, v_log.start_time, p_end_time, v_log.mode, EXTRACT(EPOCH FROM (p_end_time - v_log.start_time))::INTEGER);

  DELETE FROM exam_logs WHERE session_id = p_session_id;

  RETURN jsonb_build_object('score', v_score, 'recap', v_recap);
END;
$function$;
