-- Fix get_live_quiz_question to dynamically compute question_type based on short_answer
DROP FUNCTION IF EXISTS get_live_quiz_question(TEXT, INT);
CREATE OR REPLACE FUNCTION get_live_quiz_question(p_player_id TEXT, p_index INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kuis_id UUID;
  v_q_id INT;
  v_result JSONB;
BEGIN
  -- 1. Get kuis_id from player
  SELECT kuis_id INTO v_kuis_id FROM player WHERE id = p_player_id::UUID;
  
  IF v_kuis_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found: ' || p_player_id);
  END IF;

  -- 2. Get question_id at index from player (randomized per user)
  SELECT question_ids[p_index + 1] INTO v_q_id FROM player WHERE id = p_player_id::UUID;
  
  IF v_q_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Question index out of bounds');
  END IF;

  -- 3. Get question data
  SELECT jsonb_build_object(
    'id', q.id,
    'question_text', q.question_text,
    'option_a', q.option_a,
    'option_b', q.option_b,
    'option_c', q.option_c,
    'option_d', q.option_d,
    'option_e', q.option_e,
    'question_type', CASE WHEN q.short_answer IS NOT NULL AND trim(q.short_answer) != '' THEN 'short_answer' ELSE 'multiple_choice' END,
    'babs', q.babs,
    'sub_babs', q.sub_babs
  ) INTO v_result
  FROM questions q
  WHERE q.id = v_q_id;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Question data missing for ID ' || v_q_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION get_live_quiz_question(TEXT, INT) TO anon, authenticated;

-- Fix get_session_question to dynamically compute question_type based on short_answer
DROP FUNCTION IF EXISTS get_session_question(UUID, INT);
CREATE OR REPLACE FUNCTION get_session_question(p_session_id UUID, p_index INT)
RETURNS TABLE (
  id INT,
  question_text TEXT,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  option_e TEXT,
  question_type TEXT,
  babs TEXT[],
  sub_babs TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_q_id INT;
  v_mode TEXT;
  v_bab TEXT;
  v_sub_bab TEXT;
BEGIN
  SELECT mode, bab, sub_bab INTO v_mode, v_bab, v_sub_bab FROM exam_logs WHERE session_id = p_session_id;

  IF v_mode = 'survival' THEN
    -- Survival: Check if we already picked a question for this index (e.g. on refresh)
    SELECT question_ids[p_index + 1] INTO v_q_id FROM exam_logs WHERE session_id = p_session_id;
    
    IF v_q_id IS NULL THEN
      -- Pick next random question that matches bab/sub_bab
      IF v_sub_bab = 'Semua Sub-bab' THEN
        SELECT q.id INTO v_q_id FROM questions q WHERE v_bab = ANY(q.babs) AND q.is_hidden = false ORDER BY random() LIMIT 1;
      ELSE
        SELECT q.id INTO v_q_id FROM questions q WHERE v_bab = ANY(q.babs) AND v_sub_bab = ANY(q.sub_babs) AND q.is_hidden = false ORDER BY random() LIMIT 1;
      END IF;

      -- Persist it so save_session_answer can find it
      UPDATE exam_logs SET question_ids = question_ids || v_q_id WHERE session_id = p_session_id;
    END IF;
  ELSE
    -- Normal: pick from pre-loaded question_ids
    SELECT question_ids[p_index + 1] INTO v_q_id FROM exam_logs WHERE session_id = p_session_id;
  END IF;

  RETURN QUERY
  SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, 
         (CASE WHEN q.short_answer IS NOT NULL AND trim(q.short_answer) != '' THEN 'short_answer' ELSE 'multiple_choice' END)::TEXT, 
         q.babs, q.sub_babs
  FROM questions q
  WHERE q.id = v_q_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_session_question(UUID, INT) TO anon, authenticated;

-- Update public_questions view to reflect new dynamic question_type
DROP VIEW IF EXISTS public_questions;
CREATE OR REPLACE VIEW public_questions AS
SELECT id, question_text, option_a, option_b, option_c, option_d, option_e, 
       (CASE WHEN short_answer IS NOT NULL AND trim(short_answer) != '' THEN 'short_answer' ELSE 'multiple_choice' END)::TEXT AS question_type, 
       babs, sub_babs
FROM questions
WHERE is_hidden = false;

GRANT SELECT ON public_questions TO anon, authenticated;

-- Fix save_session_answer to correctly grade short answer questions
DROP FUNCTION IF EXISTS save_session_answer(UUID, INT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION save_session_answer(
  p_session_id UUID, 
  p_index INT, 
  p_answer_text TEXT,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log exam_logs%ROWTYPE;
  v_question_id INT;
  v_correct_label CHAR(1);
  v_correct_text TEXT;
  v_short_answer TEXT;
  v_is_correct BOOLEAN := false;
BEGIN
  SELECT * INTO v_log FROM exam_logs WHERE session_id = p_session_id;
  
  IF v_log.session_id IS NULL THEN 
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found'); 
  END IF;

  IF v_log.is_finished THEN 
    RETURN jsonb_build_object('success', false, 'error', 'session_finished'); 
  END IF;

  IF v_log.user_agent IS NOT NULL AND v_log.user_agent <> p_user_agent THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized_device');
  END IF;

  IF p_index < v_log.current_index THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_index_sequence');
  END IF;

  IF v_log.expires_at < NOW() THEN
    UPDATE exam_logs SET is_finished = true WHERE session_id = p_session_id;
    RETURN jsonb_build_object('success', false, 'error', 'time_expired');
  END IF;
  
  UPDATE exam_logs
  SET user_answers = jsonb_set(user_answers, ARRAY[p_index::text], to_jsonb(p_answer_text)),
      current_index = p_index
  WHERE session_id = p_session_id;
  
  -- Grading logic (especially for Survival live feedback)
  v_question_id := v_log.question_ids[p_index + 1];
  IF v_question_id IS NOT NULL THEN
    SELECT correct_answer, short_answer
    INTO v_correct_label, v_short_answer
    FROM questions WHERE id = v_question_id;
    
    IF v_short_answer IS NOT NULL AND trim(v_short_answer) != '' THEN
      v_correct_text := v_short_answer;
    ELSE
      IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = v_question_id;
      END IF;
    END IF;
    
    v_is_correct := (lower(trim(strip_html(p_answer_text))) = lower(trim(strip_html(v_correct_text))));
    
    IF v_log.mode = 'survival' AND NOT v_is_correct THEN
      UPDATE exam_logs SET lives = GREATEST(0, lives - 1) WHERE session_id = p_session_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'is_correct', v_is_correct, 'lives', (SELECT lives FROM exam_logs WHERE session_id = p_session_id));
END;
$$;

GRANT EXECUTE ON FUNCTION save_session_answer(UUID, INT, TEXT, TEXT) TO anon, authenticated;


-- Fix submit_live_quiz_answer_v2 to correctly grade short answer questions
DROP FUNCTION IF EXISTS submit_live_quiz_answer_v2(TEXT, INT, TEXT, INT);
CREATE OR REPLACE FUNCTION submit_live_quiz_answer_v2(
  p_player_id TEXT,
  p_question_id INT,
  p_user_answer TEXT,
  p_time_taken INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correct_answer CHAR(1);
  v_correct_text TEXT;
  v_short_answer TEXT;
  v_is_correct BOOLEAN := false;
  v_kuis_id UUID;
BEGIN
  -- 1. Get correct answer
  SELECT correct_answer, short_answer
  INTO v_correct_answer, v_short_answer
  FROM questions WHERE id = p_question_id;
  
  IF v_short_answer IS NOT NULL AND trim(v_short_answer) != '' THEN
    v_correct_text := v_short_answer;
  ELSE
    IF v_correct_answer = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = p_question_id;
    ELSIF v_correct_answer = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = p_question_id;
    ELSIF v_correct_answer = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = p_question_id;
    ELSIF v_correct_answer = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = p_question_id;
    ELSIF v_correct_answer = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = p_question_id;
    END IF;
  END IF;

  v_is_correct := (lower(trim(strip_html(p_user_answer))) = lower(trim(strip_html(v_correct_text))));

  -- 2. Record result
  INSERT INTO kuis_results (player_id, question_id, user_answer, is_correct, time_taken)
  VALUES (p_player_id::UUID, p_question_id, p_user_answer, v_is_correct, p_time_taken)
  ON CONFLICT (player_id, question_id) DO NOTHING;

  -- 3. Update player score if correct
  IF v_is_correct THEN
    UPDATE player 
    SET score = score + 1, 
        total_time = total_time + p_time_taken 
    WHERE id = p_player_id::UUID;
  ELSE
    UPDATE player 
    SET total_time = total_time + p_time_taken 
    WHERE id = p_player_id::UUID;
  END IF;

  RETURN jsonb_build_object('success', true, 'is_correct', v_is_correct);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_live_quiz_answer_v2(TEXT, INT, TEXT, INT) TO anon, authenticated;


-- Fix submit_session_exam to correctly grade short answer questions
DROP FUNCTION IF EXISTS submit_session_exam(UUID, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION submit_session_exam(p_session_id UUID, p_end_time TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log exam_logs%ROWTYPE;
  v_score INTEGER := 0;
  v_q_index INT;
  v_q_id INT;
  v_user_ans_text TEXT;
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

    SELECT question_text, correct_answer, short_answer
    INTO v_question_text, v_correct_label, v_short_answer
    FROM questions WHERE id = v_q_id;

    IF v_short_answer IS NOT NULL AND trim(v_short_answer) != '' THEN
      v_correct_text := v_short_answer;
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
      v_is_correct := (lower(trim(strip_html(v_user_ans_text))) = lower(trim(strip_html(v_correct_text))));
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

  IF v_log.mode = 'survival' THEN
    INSERT INTO exam_results (name, score, total_questions, bab, sub_bab, question_count, taken_at, user_answers, start_time, end_time, mode, duration_seconds)
    VALUES (v_log.name, v_score, v_attempted, v_log.bab, v_log.sub_bab, v_attempted, p_end_time, v_processed_answers, v_log.start_time, p_end_time, v_log.mode, v_duration_seconds);
  ELSE
    INSERT INTO exam_results (name, score, total_questions, bab, sub_bab, question_count, taken_at, user_answers, start_time, end_time, mode, duration_seconds)
    VALUES (v_log.name, v_score, v_log.question_count, v_log.bab, v_log.sub_bab, v_log.question_count, p_end_time, v_processed_answers, v_log.start_time, p_end_time, v_log.mode, v_duration_seconds);
  END IF;
  
  DELETE FROM exam_logs WHERE session_id = p_session_id;
  
  RETURN jsonb_build_object('score', v_score, 'recap', v_recap, 'total_attempted', v_attempted);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_session_exam(UUID, TIMESTAMPTZ) TO anon, authenticated;
