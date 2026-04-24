-- Supabase Schema for Exam Web Application

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  option_e TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL,
  category TEXT NOT NULL DEFAULT 'general_informatics',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exam results table with user answers storage
CREATE TABLE IF NOT EXISTS exam_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'general_informatics',
  question_count INTEGER NOT NULL DEFAULT 20,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_answers JSONB DEFAULT '[]'::jsonb,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  mode TEXT NOT NULL DEFAULT 'exam'
);

-- Enable RLS
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "questions_select" ON questions FOR SELECT USING (true); -- Public can read
CREATE POLICY "questions_insert" ON questions FOR INSERT TO authenticated WITH CHECK (auth.jwt() ->> 'email' = 'admin@exam.local');
CREATE POLICY "questions_update" ON questions FOR UPDATE TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');
CREATE POLICY "questions_delete" ON questions FOR DELETE TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');
CREATE POLICY "exam_results_insert" ON exam_results FOR INSERT WITH CHECK (true);
CREATE POLICY "exam_results_select" ON exam_results FOR SELECT USING (true);

-- Enforce valid answer labels for robust admin CRUD updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_correct_answer_check'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_correct_answer_check
      CHECK (correct_answer IN ('A', 'B', 'C', 'D', 'E'));
  END IF;
END
$$;

-- Basic server-side safety gate for rich HTML payloads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_html_safety_check'
  ) THEN
    ALTER TABLE questions
      ADD CONSTRAINT questions_html_safety_check
      CHECK (
        question_text !~* '<\s*script' AND
        question_text !~* 'on[a-z]+\s*=' AND
        option_a !~* '<\s*script' AND
        option_a !~* 'on[a-z]+\s*=' AND
        option_b !~* '<\s*script' AND
        option_b !~* 'on[a-z]+\s*=' AND
        option_c !~* '<\s*script' AND
        option_c !~* 'on[a-z]+\s*=' AND
        option_d !~* '<\s*script' AND
        option_d !~* 'on[a-z]+\s*=' AND
        option_e !~* '<\s*script' AND
        option_e !~* 'on[a-z]+\s*='
      );
  END IF;
END
$$;

-- Migration: Add category column if table already exists
-- ALTER TABLE questions ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general_informatics';
-- ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general_informatics';
-- ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS question_count INTEGER NOT NULL DEFAULT 20;

-- ============================================================
-- Storage Configuration
-- ============================================================

-- Ensure the exam-images bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-images', 'exam-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- 1. Allow public to read images
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'exam-images');

-- 2. Allow authenticated users to upload images
CREATE POLICY "Authenticated Upload Access" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exam-images');

-- 3. Allow authenticated users to update/delete their own uploads (basic simple policy for dev)
CREATE POLICY "Authenticated Manage Access" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'exam-images');
CREATE POLICY "Authenticated Delete Access" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'exam-images');

-- ============================================================
-- Security Enhancements: Server-Side Grading
-- ============================================================

CREATE OR REPLACE FUNCTION strip_html(html_text TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN trim(regexp_replace(coalesce(html_text, ''), '<[^>]*>', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Create a secure view for public fetching (without correct_answer)
CREATE OR REPLACE VIEW public_questions AS
SELECT id, question_text, option_a, option_b, option_c, option_d, option_e, category
FROM questions;

GRANT SELECT ON public_questions TO anon, authenticated;

-- 2. Restrict direct access to questions table (revoke public access)
DROP POLICY IF EXISTS "questions_select" ON questions;
CREATE POLICY "questions_select" ON questions FOR SELECT TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');

-- 3. Create RPC to check a single answer (for Survival mode)
CREATE OR REPLACE FUNCTION check_answer(p_question_id INT, p_answer_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correct_label CHAR(1);
  v_correct_text TEXT;
BEGIN
  SELECT correct_answer INTO v_correct_label FROM questions WHERE id = p_question_id;
  
  IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = p_question_id;
  ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = p_question_id;
  ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = p_question_id;
  ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = p_question_id;
  ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = p_question_id;
  END IF;

  RETURN strip_html(p_answer_text) = strip_html(v_correct_text);
END;
$$;

-- 4. Create RPC to submit an entire exam and calculate score
CREATE OR REPLACE FUNCTION submit_exam(p_name TEXT, p_category TEXT, p_mode TEXT, p_question_count INT, p_answers JSONB, p_start_time TIMESTAMPTZ, p_end_time TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score INTEGER := 0;
  v_total INTEGER;
  v_elem JSONB;
  v_q_id INT;
  v_user_ans_text TEXT;
  v_correct_label CHAR(1);
  v_correct_text TEXT;
  v_is_correct BOOLEAN;
  v_processed_answers JSONB := '[]'::jsonb;
BEGIN
  v_total := jsonb_array_length(p_answers);
  
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_q_id := (v_elem->>'question_id')::INT;
    v_user_ans_text := v_elem->>'user_answer';
    
    SELECT correct_answer INTO v_correct_label FROM questions WHERE id = v_q_id;
    
    IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = v_q_id;
    ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = v_q_id;
    ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = v_q_id;
    ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = v_q_id;
    ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = v_q_id;
    END IF;
    
    v_is_correct := (strip_html(v_user_ans_text) = strip_html(v_correct_text) AND v_user_ans_text IS NOT NULL AND v_user_ans_text != 'skipped');
    
    IF v_is_correct THEN
      v_score := v_score + 1;
    END IF;
    
    v_processed_answers := v_processed_answers || jsonb_build_object(
      'question_id', v_q_id,
      'user_answer', v_user_ans_text,
      'is_correct', v_is_correct
    );
  END LOOP;
  
  INSERT INTO exam_results (name, score, total_questions, category, question_count, taken_at, user_answers)
  VALUES (p_name, v_score, v_total, p_category, p_question_count, p_end_time, v_processed_answers);
  
  RETURN v_score;
END;
$$;

-- ============================================================
-- Security Enhancements v2: Session Logs (Masked IDs)
-- ============================================================

DROP TABLE IF EXISTS exam_logs CASCADE;

CREATE TABLE exam_logs (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  mode TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  question_ids INT[] NOT NULL,
  current_index INTEGER NOT NULL DEFAULT 0,
  user_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  lives INTEGER NOT NULL DEFAULT 3,
  is_finished BOOLEAN NOT NULL DEFAULT false,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 days')
);

ALTER TABLE exam_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read exam logs"
ON exam_logs FOR SELECT
TO authenticated
USING (true);

-- 1. Start Exam Session
CREATE OR REPLACE FUNCTION start_exam_session(p_name TEXT, p_category TEXT, p_mode TEXT, p_count INT, p_time_limit_minutes INT DEFAULT NULL)
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
  IF p_category = 'All Categories' THEN
    SELECT array_agg(id) INTO v_question_ids FROM (
      SELECT id FROM questions ORDER BY random() LIMIT p_count
    ) sq;
  ELSE
    SELECT array_agg(id) INTO v_question_ids FROM (
      SELECT id FROM questions WHERE p_category = ANY(categories) ORDER BY random() LIMIT p_count
    ) sq;
  END IF;
  
  IF v_question_ids IS NULL THEN
    v_question_ids := ARRAY[]::INT[];
  END IF;

  v_actual_count := COALESCE(array_length(v_question_ids, 1), 0);

  IF p_time_limit_minutes IS NOT NULL AND p_time_limit_minutes > 0 THEN
    v_expires_at := NOW() + (p_time_limit_minutes || ' minutes')::INTERVAL;
  ELSE
    v_expires_at := NOW() + INTERVAL '2 days'; -- Default long expiry for "No Time"
  END IF;

  INSERT INTO exam_logs (name, category, mode, question_count, question_ids, expires_at)
  VALUES (p_name, p_category, p_mode, v_actual_count, v_question_ids, v_expires_at)
  RETURNING session_id INTO v_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'question_count', v_actual_count,
    'expires_at', v_expires_at
  );
END;
$$;

-- 2. Get Session State
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
    'category', v_log.category,
    'name', v_log.name,
    'expires_at', v_log.expires_at
  );
END;
$$;

-- 3. Get Session Question
CREATE OR REPLACE FUNCTION get_session_question(p_session_id UUID, p_index INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_question_id INT;
  v_question_data JSONB;
BEGIN
  SELECT question_ids[p_index + 1] INTO v_question_id
  FROM exam_logs
  WHERE session_id = p_session_id;

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
    'categories', categories
  ) INTO v_question_data
  FROM questions
  WHERE id = v_question_id;

  RETURN v_question_data;
END;
$$;

-- 4. Save Session Answer
CREATE OR REPLACE FUNCTION save_session_answer(p_session_id UUID, p_index INT, p_answer_text TEXT)
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

  IF v_log.expires_at < NOW() THEN
    UPDATE exam_logs SET is_finished = true WHERE session_id = p_session_id;
    RETURN jsonb_build_object('success', false, 'error', 'time_expired');
  END IF;
  
  UPDATE exam_logs
  SET user_answers = jsonb_set(user_answers, ARRAY[p_index::text], to_jsonb(p_answer_text)),
      current_index = p_index
  WHERE session_id = p_session_id;
  
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

-- 5. Submit Session Exam
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

  FOR v_q_index IN 0..(v_log.question_count - 1)
  LOOP
    v_user_ans_text := v_log.user_answers->>(v_q_index::text);
    v_q_id := v_log.question_ids[v_q_index + 1];
    
    -- In Survival Mode, we strictly only care about questions encountered/attempted.
    -- In Normal Mode, we follow traditional scoring (total count is the denominator).
    IF v_q_id IS NOT NULL AND v_user_ans_text IS NOT NULL THEN
        -- It's an attempt if it's not skipped
        IF v_user_ans_text != 'skipped' THEN
          v_attempted := v_attempted + 1;
        END IF;

        SELECT question_text, correct_answer INTO v_question_text, v_correct_label FROM questions WHERE id = v_q_id;
        
        IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = v_q_id;
        ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = v_q_id;
        END IF;
        
        v_is_correct := (strip_html(v_user_ans_text) = strip_html(v_correct_text) AND v_user_ans_text != 'skipped');
        
        IF v_is_correct THEN
          v_score := v_score + 1;
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
    END IF;
  END LOOP;
  
  -- Use v_attempted for Survival Mode, v_log.question_count for Normal Mode
  IF v_log.mode = 'survival' THEN
    INSERT INTO exam_results (name, score, total_questions, category, question_count, taken_at, user_answers, start_time, end_time, mode, duration_seconds)
    VALUES (v_log.name, v_score, v_attempted, v_log.category, v_attempted, p_end_time, v_processed_answers, v_log.start_time, p_end_time, v_log.mode, v_duration_seconds);
  ELSE
    INSERT INTO exam_results (name, score, total_questions, category, question_count, taken_at, user_answers, start_time, end_time, mode, duration_seconds)
    VALUES (v_log.name, v_score, v_log.question_count, v_log.category, v_log.question_count, p_end_time, v_processed_answers, v_log.start_time, p_end_time, v_log.mode, v_duration_seconds);
  END IF;
  
  DELETE FROM exam_logs WHERE session_id = p_session_id;
  
  RETURN jsonb_build_object('score', v_score, 'recap', v_recap, 'total_attempted', v_attempted);
END;
$$;

-- 6. Cleanup Expired Sessions
-- This function can be scheduled via pg_cron or called periodically
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM exam_logs
  WHERE expires_at < NOW()
    AND is_finished = false;
END;
$$;