-- Compatibility wrappers for student-facing performance page
-- These RPCs now read from question_ids + user_answers and reconstruct recap on the fly

-- 1. get_scheduled_exam_recap: reconstruct recap from question_ids + user_answers
CREATE OR REPLACE FUNCTION public.get_scheduled_exam_recap(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt RECORD;
  v_q_index integer;
  v_q_id    integer;
  v_user_ans_text text;
  v_correct_label CHAR(1);
  v_correct_text  text;
  v_short_answer  text;
  v_question_type text;
  v_question_text text;
  v_is_correct    boolean;
  v_recap         jsonb := '[]'::jsonb;
BEGIN
  SELECT sea.question_ids, sea.user_answers, sea.score,
         se.question_count,
         sea.student_name, sea.started_at, sea.submitted_at
  INTO v_attempt
  FROM scheduled_exam_attempts sea
  JOIN scheduled_exams se ON se.id = sea.scheduled_exam_id
  WHERE sea.session_id = p_session_id
    AND sea.submitted_at IS NOT NULL;

  IF v_attempt.student_name IS NULL THEN
    RETURN NULL;
  END IF;

  -- Reconstruct recap from question_ids + user_answers
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
$function$;

-- 2. finalize_scheduled_exam_attempt: convert recap to user_answers
CREATE OR REPLACE FUNCTION public.finalize_scheduled_exam_attempt(p_session_id uuid, p_score integer, p_recap jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_answers jsonb := '{}'::jsonb;
  v_elem jsonb;
  v_idx integer := 0;
BEGIN
  -- Reconstruct user_answers map from the incoming recap array
  -- Use coalesce/null handling to avoid errors if p_recap elements are malformed
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_recap)
  LOOP
    IF v_elem->>'user_answer' IS NOT NULL THEN
      v_user_answers := v_user_answers || jsonb_build_object(v_idx::text, v_elem->>'user_answer');
    ELSE
      v_user_answers := v_user_answers || jsonb_build_object(v_idx::text, 'skipped');
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  UPDATE scheduled_exam_attempts
  SET submitted_at = now(),
      score = p_score,
      user_answers = v_user_answers
  WHERE session_id = p_session_id;
END;
$function$;
