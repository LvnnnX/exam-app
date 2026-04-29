-- Migration: Add Head Bab Hierarchy

-- 1. QUESTIONS TABLE
ALTER TABLE questions RENAME COLUMN categories TO sub_babs;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS head_babs TEXT[] NOT NULL DEFAULT '{Umum}';

-- Update public_questions view to reflect new columns
DROP VIEW IF EXISTS public_questions;
CREATE OR REPLACE VIEW public_questions AS
SELECT id, question_text, option_a, option_b, option_c, option_d, option_e, head_babs, sub_babs
FROM questions;

-- 2. EXAM_RESULTS TABLE
ALTER TABLE exam_results RENAME COLUMN category TO sub_bab;
ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS head_bab TEXT NOT NULL DEFAULT 'Umum';

-- 3. EXAM_LOGS TABLE
ALTER TABLE exam_logs RENAME COLUMN category TO sub_bab;
ALTER TABLE exam_logs ADD COLUMN IF NOT EXISTS head_bab TEXT NOT NULL DEFAULT 'Umum';

-- 4. KUIS_LOGS TABLE
ALTER TABLE kuis_logs RENAME COLUMN category TO sub_bab;
ALTER TABLE kuis_logs ADD COLUMN IF NOT EXISTS head_bab TEXT NOT NULL DEFAULT 'Umum';

-- 5. APP_SETTINGS TABLE
ALTER TABLE app_settings RENAME COLUMN hidden_categories TO hidden_sub_babs;

-- RECREATE RPCS WITH NEW COLUMNS

-- start_exam_session
-- Drop old function signature to prevent ambiguity
DROP FUNCTION IF EXISTS start_exam_session(TEXT, TEXT, TEXT, INT, INT, TEXT);
CREATE OR REPLACE FUNCTION start_exam_session(
  p_name TEXT, 
  p_head_bab TEXT, 
  p_sub_bab TEXT, 
  p_mode TEXT, 
  p_count INT, 
  p_time_limit_minutes INT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_question_ids INT[];
  v_actual_count INT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_mode = 'survival' THEN
    -- Survival: do NOT pre-load all question IDs.
    IF p_sub_bab = 'Semua Sub-bab' THEN
      SELECT COUNT(*) INTO v_actual_count FROM questions WHERE p_head_bab = ANY(head_babs);
    ELSE
      SELECT COUNT(*) INTO v_actual_count FROM questions WHERE p_head_bab = ANY(head_babs) AND p_sub_bab = ANY(sub_babs);
    END IF;
    v_question_ids := ARRAY[]::INT[];
  ELSE
    -- Normal exam: pre-load and shuffle
    IF p_sub_bab = 'Semua Sub-bab' THEN
      SELECT array_agg(id) INTO v_question_ids FROM (
        SELECT id FROM questions WHERE p_head_bab = ANY(head_babs) ORDER BY random() LIMIT p_count
      ) sq;
    ELSE
      SELECT array_agg(id) INTO v_question_ids FROM (
        SELECT id FROM questions WHERE p_head_bab = ANY(head_babs) AND p_sub_bab = ANY(sub_babs) ORDER BY random() LIMIT p_count
      ) sq;
    END IF;

    IF v_question_ids IS NULL THEN
      v_question_ids := ARRAY[]::INT[];
    END IF;

    v_actual_count := COALESCE(array_length(v_question_ids, 1), 0);
  END IF;

  IF p_time_limit_minutes IS NOT NULL AND p_time_limit_minutes > 0 THEN
    v_expires_at := NOW() + (p_time_limit_minutes || ' minutes')::INTERVAL;
  ELSE
    v_expires_at := NOW() + INTERVAL '2 days';
  END IF;

  INSERT INTO exam_logs (name, head_bab, sub_bab, mode, question_count, question_ids, expires_at, user_agent)
  VALUES (p_name, p_head_bab, p_sub_bab, p_mode, v_actual_count, v_question_ids, v_expires_at, p_user_agent)
  RETURNING session_id INTO v_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'question_count', v_actual_count,
    'expires_at', v_expires_at
  );
END;
$$;

-- get_session_state
CREATE OR REPLACE FUNCTION get_session_state(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log exam_logs%ROWTYPE;
BEGIN
  SELECT * INTO v_log FROM exam_logs WHERE session_id = p_session_id;
  IF v_log.session_id IS NULL THEN RETURN NULL; END IF;
  
  RETURN jsonb_build_object(
    'current_index', v_log.current_index,
    'user_answers', v_log.user_answers,
    'lives', v_log.lives,
    'is_finished', v_log.is_finished,
    'question_count', v_log.question_count,
    'mode', v_log.mode,
    'head_bab', v_log.head_bab,
    'sub_bab', v_log.sub_bab,
    'name', v_log.name,
    'expires_at', v_log.expires_at
  );
END;
$$;

-- get_session_question
CREATE OR REPLACE FUNCTION get_session_question(p_session_id UUID, p_index INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log        exam_logs%ROWTYPE;
  v_question_id INT;
  v_question_data JSONB;
BEGIN
  SELECT * INTO v_log FROM exam_logs WHERE session_id = p_session_id;

  IF v_log.session_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_question_id := v_log.question_ids[p_index + 1];

  IF v_question_id IS NULL AND v_log.mode = 'survival' THEN
    IF v_log.sub_bab = 'Semua Sub-bab' THEN
      SELECT id INTO v_question_id
      FROM questions
      WHERE v_log.head_bab = ANY(head_babs)
        AND id <> ALL(COALESCE(v_log.question_ids, ARRAY[]::INT[]))
      ORDER BY random()
      LIMIT 1;
    ELSE
      SELECT id INTO v_question_id
      FROM questions
      WHERE v_log.head_bab = ANY(head_babs)
        AND v_log.sub_bab = ANY(sub_babs)
        AND id <> ALL(COALESCE(v_log.question_ids, ARRAY[]::INT[]))
      ORDER BY random()
      LIMIT 1;
    END IF;

    IF v_question_id IS NULL THEN
      RETURN NULL;
    END IF;

    UPDATE exam_logs
    SET question_ids = array_append(question_ids, v_question_id)
    WHERE session_id = p_session_id;
  END IF;

  IF v_question_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'question_text', question_text,
    'option_a', option_a,
    'option_b', option_b,
    'option_c', option_c,
    'option_d', option_d,
    'option_e', option_e,
    'head_babs', head_babs,
    'sub_babs', sub_babs
  ) INTO v_question_data
  FROM questions
  WHERE id = v_question_id;

  RETURN v_question_data;
END;
$$;

-- submit_session_exam
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

    SELECT question_text, correct_answer INTO v_question_text, v_correct_label FROM questions WHERE id = v_q_id;

    IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = v_q_id;
    ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = v_q_id;
    ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = v_q_id;
    ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = v_q_id;
    ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = v_q_id;
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
    INSERT INTO exam_results (name, score, total_questions, head_bab, sub_bab, question_count, taken_at, user_answers, start_time, end_time, mode, duration_seconds)
    VALUES (v_log.name, v_score, v_attempted, v_log.head_bab, v_log.sub_bab, v_attempted, p_end_time, v_processed_answers, v_log.start_time, p_end_time, v_log.mode, v_duration_seconds);
  ELSE
    INSERT INTO exam_results (name, score, total_questions, head_bab, sub_bab, question_count, taken_at, user_answers, start_time, end_time, mode, duration_seconds)
    VALUES (v_log.name, v_score, v_log.question_count, v_log.head_bab, v_log.sub_bab, v_log.question_count, p_end_time, v_processed_answers, v_log.start_time, p_end_time, v_log.mode, v_duration_seconds);
  END IF;
  
  DELETE FROM exam_logs WHERE session_id = p_session_id;
  
  RETURN jsonb_build_object('score', v_score, 'recap', v_recap, 'total_attempted', v_attempted);
END;
$$;
