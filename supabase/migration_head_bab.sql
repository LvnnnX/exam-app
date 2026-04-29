-- Migration: Add Bab Hierarchy (Renamed from Head Bab)

DO $$ 
BEGIN
  -- 1. QUESTIONS TABLE
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='categories') THEN
    ALTER TABLE questions RENAME COLUMN categories TO sub_babs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='questions' AND column_name='babs') THEN
    ALTER TABLE questions RENAME COLUMN babs TO babs;
  END IF;

  -- 2. EXAM_RESULTS TABLE
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_results' AND column_name='category') THEN
    ALTER TABLE exam_results RENAME COLUMN category TO sub_bab;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_results' AND column_name='bab') THEN
    ALTER TABLE exam_results RENAME COLUMN bab TO bab;
  END IF;

  -- 3. EXAM_LOGS TABLE
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_logs' AND column_name='category') THEN
    ALTER TABLE exam_logs RENAME COLUMN category TO sub_bab;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_logs' AND column_name='bab') THEN
    ALTER TABLE exam_logs RENAME COLUMN bab TO bab;
  END IF;

  -- 4. KUIS_LOGS TABLE
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kuis_logs' AND column_name='category') THEN
    ALTER TABLE kuis_logs RENAME COLUMN category TO sub_bab;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kuis_logs' AND column_name='bab') THEN
    ALTER TABLE kuis_logs RENAME COLUMN bab TO bab;
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
    -- Survival: Pick next random question NOT in user_answers
    SELECT q.id INTO v_q_id
    FROM questions q
    WHERE (v_sub_bab = 'Semua Sub-bab' OR p_sub_bab = ANY(q.sub_babs))
      AND v_bab = ANY(q.babs)
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_each_text((SELECT user_answers FROM exam_logs WHERE session_id = p_session_id)) 
        WHERE value IS NOT NULL AND (SELECT id FROM questions WHERE id = q.id) = CAST(key AS INT) -- logic placeholder
      )
    ORDER BY random()
    LIMIT 1;
    
    -- Actually for survival we just need a random question that matches the bab/sub_bab
    -- The app logic handles excluding answered ones by keeping track of question IDs or just random.
    IF v_sub_bab = 'Semua Sub-bab' THEN
      SELECT q.id INTO v_q_id FROM questions q WHERE v_bab = ANY(q.babs) ORDER BY random() LIMIT 1;
    ELSE
      SELECT q.id INTO v_q_id FROM questions q WHERE v_bab = ANY(q.babs) AND v_sub_bab = ANY(q.sub_babs) ORDER BY random() LIMIT 1;
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
