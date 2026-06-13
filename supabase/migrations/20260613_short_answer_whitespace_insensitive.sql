-- 20260613_short_answer_whitespace_insensitive.sql
--
-- Make short_answer comparison whitespace-insensitive in the two grading RPCs.
--
-- Before: lower(trim(strip_html(x))) = lower(trim(strip_html(y)))
-- After:  regexp_replace(lower(strip_html(x)), '\s+', '', 'g')
--         = regexp_replace(lower(strip_html(y)), '\s+', '', 'g')
--
-- Rationale: the previous rule only trimmed leading/trailing whitespace, so a
-- stored answer of "1, 3" did not match "1,3" or "1,    3". Authors space
-- comma-separated lists / formulas inconsistently. Whitespace-stripping makes
-- grading robust to that without changing semantics for prose answers
-- (real mismatches like "Soekarno" vs "Hatta" still fail).
--
-- Affected RPCs (only the signatures actually called by the app):
--   - submit_session_exam(p_session_id uuid, p_end_time timestamptz)
--     called from lib/questions.ts:649
--   - submit_live_quiz_answer_v2(p_player_id text, p_question_id integer,
--       p_user_answer text, p_time_taken integer, p_index integer,
--       p_secret text DEFAULT NULL::text)
--     called from app/actions/exam.ts:89-96
--
-- Other overloads of submit_live_quiz_answer_v2 (4-arg, 5-arg) and the
-- 3-arg submit_session_exam are unused by the app and intentionally left
-- alone to keep blast radius minimal.
--
-- Doc updates in the same change:
--   docs/srs/functional-requirements/live-quiz-execution.md (FR-QUIZ-013)
--   docs/srs/functional-requirements/admin-question-management.md (FR-QM-012)
--   docs/srs/functional-requirements/self-paced-exam-execution.md (FR-EXAM-008)

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

  DELETE FROM exam_logs WHERE session_id = p_session_id;

  RETURN jsonb_build_object('score', v_score, 'recap', v_recap, 'total_attempted', v_attempted);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_live_quiz_answer_v2(p_player_id text, p_question_id integer, p_user_answer text, p_time_taken integer, p_index integer, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_correct_answer CHAR(1);
  v_correct_text TEXT;
  v_short_answer TEXT;
  v_is_correct BOOLEAN := false;
  v_kuis_id UUID;
  v_quiz_status TEXT;
  v_quiz_mode TEXT;
  v_player_question_ids INT[];
  v_current_player_index INT;
  v_old_is_correct BOOLEAN;
BEGIN
  IF NOT validate_exam_secret(p_secret) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized access. Invalid or missing secret key.');
  END IF;

  SELECT kuis_id, current_index, question_ids
  INTO v_kuis_id, v_current_player_index, v_player_question_ids
  FROM player WHERE id = p_player_id::UUID;

  IF v_kuis_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Player not found'); END IF;

  SELECT status, quiz_mode INTO v_quiz_status, v_quiz_mode FROM kuis_logs WHERE id = v_kuis_id;
  IF v_quiz_status != 'active' THEN RETURN jsonb_build_object('success', false, 'error', 'Quiz is not active'); END IF;

  -- Flow Lock: Only enforce sequential index in strict mode
  IF COALESCE(v_quiz_mode, 'strict') = 'strict' THEN
    IF p_index != v_current_player_index THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid question sequence (Flow Lock)');
    END IF;
  END IF;

  -- ID Validation: Ensure question ID matches the index in the player's assigned sequence
  IF v_player_question_ids[p_index + 1] != p_question_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized question access (ID mismatch)');
  END IF;

  -- Grade the answer
  SELECT correct_answer, short_answer INTO v_correct_answer, v_short_answer FROM questions WHERE id = p_question_id;
  IF v_short_answer IS NOT NULL AND trim(v_short_answer) != '' THEN v_correct_text := v_short_answer;
  ELSE
    IF v_correct_answer = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = p_question_id;
    ELSIF v_correct_answer = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = p_question_id;
    ELSIF v_correct_answer = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = p_question_id;
    ELSIF v_correct_answer = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = p_question_id;
    ELSIF v_correct_answer = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = p_question_id;
    END IF;
  END IF;

  v_is_correct := (regexp_replace(lower(strip_html(p_user_answer)), '\s+', '', 'g') = regexp_replace(lower(strip_html(v_correct_text)), '\s+', '', 'g'));

  -- Standard mode: UPSERT (allow re-answering)
  IF COALESCE(v_quiz_mode, 'strict') = 'standard' THEN
    -- Check if answer already exists
    SELECT is_correct INTO v_old_is_correct
    FROM kuis_results
    WHERE player_id = p_player_id::UUID AND question_id = p_question_id;

    IF FOUND THEN
      -- Update existing answer
      UPDATE kuis_results
      SET user_answer = p_user_answer, is_correct = v_is_correct, time_taken = p_time_taken
      WHERE player_id = p_player_id::UUID AND question_id = p_question_id;

      -- Adjust score: remove old, add new
      UPDATE player SET
        score = score - CASE WHEN v_old_is_correct THEN 1 ELSE 0 END + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
        total_time = total_time + p_time_taken
      WHERE id = p_player_id::UUID;
    ELSE
      -- Insert new answer
      INSERT INTO kuis_results (player_id, question_id, user_answer, is_correct, time_taken)
      VALUES (p_player_id::UUID, p_question_id, p_user_answer, v_is_correct, p_time_taken);

      UPDATE player SET
        score = score + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
        total_time = total_time + p_time_taken,
        current_index = GREATEST(current_index, p_index + 1)
      WHERE id = p_player_id::UUID;
    END IF;
  ELSE
    -- Strict mode: INSERT only (original behavior)
    INSERT INTO kuis_results (player_id, question_id, user_answer, is_correct, time_taken)
    VALUES (p_player_id::UUID, p_question_id, p_user_answer, v_is_correct, p_time_taken);

    UPDATE player SET
      score = score + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
      total_time = total_time + p_time_taken,
      current_index = current_index + 1
    WHERE id = p_player_id::UUID;
  END IF;

  RETURN jsonb_build_object('success', true, 'is_correct', v_is_correct);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
