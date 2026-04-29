-- Migration: Add Bab Hierarchy (Renamed from Head Bab)

DO $$ 
BEGIN
  -- 1. QUESTIONS TABLE
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='categories') THEN
    ALTER TABLE questions RENAME COLUMN categories TO sub_babs;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='head_bab') THEN
    ALTER TABLE questions RENAME COLUMN head_bab TO bab;
  END IF;

  -- 2. EXAM_RESULTS TABLE
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_results' AND column_name='category') THEN
    ALTER TABLE exam_results RENAME COLUMN category TO sub_bab;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_results' AND column_name='head_bab') THEN
    ALTER TABLE exam_results RENAME COLUMN head_bab TO bab;
  END IF;

  -- 3. EXAM_LOGS TABLE
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_logs' AND column_name='category') THEN
    ALTER TABLE exam_logs RENAME COLUMN category TO sub_bab;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_logs' AND column_name='head_bab') THEN
    ALTER TABLE exam_logs RENAME COLUMN head_bab TO bab;
  END IF;

  -- 4. KUIS_LOGS TABLE
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kuis_logs' AND column_name='category') THEN
    ALTER TABLE kuis_logs RENAME COLUMN category TO sub_bab;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kuis_logs' AND column_name='head_bab') THEN
    ALTER TABLE kuis_logs RENAME COLUMN head_bab TO bab;
  END IF;

  -- 5. APP_SETTINGS TABLE
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_settings' AND column_name='hidden_categories') THEN
    ALTER TABLE app_settings RENAME COLUMN hidden_categories TO hidden_sub_babs;
  END IF;
END $$;

ALTER TABLE questions ADD COLUMN IF NOT EXISTS babs TEXT[] NOT NULL DEFAULT '{INFORMATIKA}';

-- Update public_questions view to reflect new columns
DROP VIEW IF EXISTS public_questions;
CREATE OR REPLACE VIEW public_questions AS
SELECT id, question_text, option_a, option_b, option_c, option_d, option_e, babs, sub_babs
FROM questions;

ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS bab TEXT NOT NULL DEFAULT 'INFORMATIKA';
ALTER TABLE exam_logs ADD COLUMN IF NOT EXISTS bab TEXT NOT NULL DEFAULT 'INFORMATIKA';
ALTER TABLE kuis_logs ADD COLUMN IF NOT EXISTS bab TEXT NOT NULL DEFAULT 'INFORMATIKA';

-- ENSURE QUESTIONS ACCESSIBLE TO PLAYERS
DROP POLICY IF EXISTS "questions_select" ON questions;
CREATE POLICY "questions_select" ON questions FOR SELECT USING (true);
GRANT SELECT ON questions TO anon, authenticated;
GRANT SELECT ON public_questions TO anon, authenticated;

-- RECREATE RPCS WITH NEW COLUMNS

-- start_exam_session
DROP FUNCTION IF EXISTS start_exam_session(TEXT, TEXT, TEXT, INT, INT, TEXT);
DROP FUNCTION IF EXISTS start_exam_session(TEXT, TEXT, TEXT, TEXT, INT, INT, TEXT);
CREATE OR REPLACE FUNCTION start_exam_session(
  p_name TEXT, 
  p_bab TEXT, 
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
    IF p_sub_bab = 'Semua Sub-bab' THEN
      SELECT COUNT(*) INTO v_actual_count FROM questions WHERE p_bab = ANY(babs);
    ELSE
      SELECT COUNT(*) INTO v_actual_count FROM questions WHERE p_bab = ANY(babs) AND p_sub_bab = ANY(sub_babs);
    END IF;
    v_question_ids := ARRAY[]::INT[];
  ELSE
    IF p_sub_bab = 'Semua Sub-bab' THEN
      SELECT array_agg(id) INTO v_question_ids FROM (
        SELECT id FROM questions WHERE p_bab = ANY(babs) ORDER BY random() LIMIT p_count
      ) sq;
    ELSE
      SELECT array_agg(id) INTO v_question_ids FROM (
        SELECT id FROM questions WHERE p_bab = ANY(babs) AND p_sub_bab = ANY(sub_babs) ORDER BY random() LIMIT p_count
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

  INSERT INTO exam_logs (name, bab, sub_bab, mode, question_count, question_ids, expires_at, user_agent)
  VALUES (p_name, p_bab, p_sub_bab, p_mode, v_actual_count, v_question_ids, v_expires_at, p_user_agent)
  RETURNING session_id INTO v_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'question_count', v_actual_count,
    'expires_at', v_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION start_exam_session(TEXT, TEXT, TEXT, TEXT, INT, INT, TEXT) TO anon, authenticated;

-- get_session_state
DROP FUNCTION IF EXISTS get_session_state(UUID);
CREATE OR REPLACE FUNCTION get_session_state(p_session_id UUID)
RETURNS TABLE (
  name TEXT,
  bab TEXT,
  sub_bab TEXT,
  mode TEXT,
  question_count INT,
  current_index INT,
  user_answers JSONB,
  lives INT,
  is_finished BOOLEAN,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT name, bab, sub_bab, mode, question_count, current_index, user_answers, lives, is_finished, expires_at
  FROM exam_logs
  WHERE session_id = p_session_id;
$$;

-- get_session_question
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
  v_answered_count INT;
BEGIN
  SELECT mode, bab, sub_bab INTO v_mode, v_bab, v_sub_bab FROM exam_logs WHERE session_id = p_session_id;

  IF v_mode = 'survival' THEN
    -- Survival: Check if we already picked a question for this index (e.g. on refresh)
    SELECT question_ids[p_index + 1] INTO v_q_id FROM exam_logs WHERE session_id = p_session_id;
    
    IF v_q_id IS NULL THEN
      -- Pick next random question that matches bab/sub_bab
      IF v_sub_bab = 'Semua Sub-bab' THEN
        SELECT q.id INTO v_q_id FROM questions q WHERE v_bab = ANY(q.babs) ORDER BY random() LIMIT 1;
      ELSE
        SELECT q.id INTO v_q_id FROM questions q WHERE v_bab = ANY(q.babs) AND v_sub_bab = ANY(q.sub_babs) ORDER BY random() LIMIT 1;
      END IF;

      -- Persist it so save_session_answer can find it
      UPDATE exam_logs SET question_ids = question_ids || v_q_id WHERE session_id = p_session_id;
    END IF;
  ELSE
    -- Normal: pick from pre-loaded question_ids
    SELECT question_ids[p_index + 1] INTO v_q_id FROM exam_logs WHERE session_id = p_session_id;
  END IF;

  RETURN QUERY
  SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.babs, q.sub_babs
  FROM questions q
  WHERE q.id = v_q_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_session_question(UUID, INT) TO anon, authenticated;

-- submit_session_exam
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

-- get_live_quiz_question (Robust Version)
DROP FUNCTION IF EXISTS get_live_quiz_question(UUID, INT);
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

  -- 2. Get question_id at index from kuis_logs
  SELECT question_ids[p_index + 1] INTO v_q_id FROM kuis_logs WHERE id = v_kuis_id;
  
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

-- join_live_quiz
DROP FUNCTION IF EXISTS join_live_quiz(TEXT, TEXT);
CREATE OR REPLACE FUNCTION join_live_quiz(p_quiz_code TEXT, p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kuis_id UUID;
  v_player_id UUID;
  v_status TEXT;
BEGIN
  SELECT id, status INTO v_kuis_id, v_status FROM kuis_logs WHERE quiz_code = p_quiz_code;
  
  IF v_kuis_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kuis tidak ditemukan');
  END IF;
  
  IF v_status = 'finished' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kuis sudah berakhir');
  END IF;

  INSERT INTO player (kuis_id, name)
  VALUES (v_kuis_id, p_name)
  ON CONFLICT (kuis_id, name) DO UPDATE SET joined_at = NOW()
  RETURNING id INTO v_player_id;

  RETURN jsonb_build_object('success', true, 'player_id', v_player_id);
END;
$$;

GRANT EXECUTE ON FUNCTION join_live_quiz(TEXT, TEXT) TO anon, authenticated;

-- save_session_answer
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
    SELECT correct_answer INTO v_correct_label FROM questions WHERE id = v_question_id;
    
    IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = v_question_id;
    ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = v_question_id;
    ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = v_question_id;
    ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = v_question_id;
    ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = v_question_id;
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

-- submit_live_quiz_answer_v2
DROP FUNCTION IF EXISTS submit_live_quiz_answer_v2(UUID, INT, TEXT, INT);
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
  v_is_correct BOOLEAN := false;
  v_kuis_id UUID;
BEGIN
  -- 1. Get correct answer
  SELECT correct_answer INTO v_correct_answer FROM questions WHERE id = p_question_id;
  
  IF v_correct_answer = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = p_question_id;
  ELSIF v_correct_answer = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = p_question_id;
  ELSIF v_correct_answer = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = p_question_id;
  ELSIF v_correct_answer = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = p_question_id;
  ELSIF v_correct_answer = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = p_question_id;
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
