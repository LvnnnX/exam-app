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
  categories TEXT[] NOT NULL DEFAULT '{general_informatics}',
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
    -- Remove HTML tags, replace common entities, and collapse whitespace
    RETURN trim(regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(html_text, ''), '<[^>]*>', '', 'g'),
        '&nbsp;|&#160;', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    ));
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
  IF p_mode = 'survival' THEN
    -- Survival: do NOT pre-load all question IDs.
    -- Store empty array; questions are lazily fetched one-by-one via get_session_question.
    -- question_count stores the total available in the pool (upper bound).
    IF p_category = 'All Categories' THEN
      SELECT COUNT(*) INTO v_actual_count FROM questions;
    ELSE
      SELECT COUNT(*) INTO v_actual_count FROM questions WHERE p_category = ANY(categories);
    END IF;
    v_question_ids := ARRAY[]::INT[];
  ELSE
    -- Normal exam: pre-load and shuffle all requested question IDs upfront.
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
  END IF;

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
  v_log        exam_logs%ROWTYPE;
  v_question_id INT;
  v_question_data JSONB;
BEGIN
  SELECT * INTO v_log FROM exam_logs WHERE session_id = p_session_id;

  IF v_log.session_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if this slot is already assigned
  v_question_id := v_log.question_ids[p_index + 1];

  IF v_question_id IS NULL AND v_log.mode = 'survival' THEN
    -- Survival lazy fetch: pick one random question not yet in the session
    IF v_log.category = 'All Categories' THEN
      SELECT id INTO v_question_id
      FROM questions
      WHERE id <> ALL(COALESCE(v_log.question_ids, ARRAY[]::INT[]))
      ORDER BY random()
      LIMIT 1;
    ELSE
      SELECT id INTO v_question_id
      FROM questions
      WHERE v_log.category = ANY(categories)
        AND id <> ALL(COALESCE(v_log.question_ids, ARRAY[]::INT[]))
      ORDER BY random()
      LIMIT 1;
    END IF;

    IF v_question_id IS NULL THEN
      -- Pool exhausted
      RETURN NULL;
    END IF;

    -- Append the new question ID to the session
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
    'categories', categories
  ) INTO v_question_data
  FROM questions
  WHERE id = v_question_id;

  RETURN v_question_data;
END;
$$;

-- 4. Save Session Answer
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

  -- SECURITY FIX: Device binding
  IF v_log.user_agent IS NOT NULL AND v_log.user_agent <> p_user_agent THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized_device');
  END IF;

  -- SECURITY FIX: Prevent backward jumping
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
      
      -- Comparison: case-insensitive + trim + stripped HTML
      v_is_correct := (lower(trim(strip_html(p_answer_text))) = lower(trim(strip_html(v_correct_text))));
      
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

  FOR v_q_index IN 0..(
    CASE WHEN v_log.mode = 'survival'
      -- Survival: only iterate over questions actually served (lazy array)
      THEN COALESCE(array_length(v_log.question_ids, 1), 0) - 1
      -- Normal exam: full question_count
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

    -- User answered this question
    IF v_user_ans_text IS NOT NULL AND v_user_ans_text != 'skipped' THEN
      v_attempted := v_attempted + 1;
      v_is_correct := (lower(trim(strip_html(v_user_ans_text))) = lower(trim(strip_html(v_correct_text))));
    ELSE
      -- Not answered or skipped — count as incorrect, record null
      v_is_correct := false;
      v_user_ans_text := NULL;
    END IF;

    IF v_is_correct THEN
      v_score := v_score + 1;
    END IF;

    -- In Survival Mode, only log questions that were actually attempted
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

-- ============================================================
-- App Settings Table (admin-controlled)
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  hidden_categories TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Constraint: only one settings row allowed
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_single_row;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_single_row CHECK (id = 1);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Public can READ settings (needed by fetchCategories on the user frontend)
CREATE POLICY "app_settings_public_read"
ON app_settings FOR SELECT
USING (true);

-- Only admin can WRITE settings
CREATE POLICY "app_settings_admin_write"
ON app_settings FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'admin@exam.local')
WITH CHECK (auth.jwt() ->> 'email' = 'admin@exam.local');

-- Seed a default row so upsert always finds id=1
INSERT INTO app_settings (id, hidden_categories)
VALUES (1, '{}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Migration helpers (run manually in Supabase SQL editor if upgrading)
-- ============================================================
-- If questions table has old TEXT category column:
--   ALTER TABLE questions ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{general_informatics}';
--   UPDATE questions SET categories = ARRAY[category] WHERE categories = '{general_informatics}';
--   ALTER TABLE questions DROP COLUMN IF EXISTS category;
-- ============================================================
-- Quiz Live Game Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS kuis_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_code TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, active, finished
  question_ids INT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS player (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kuis_id UUID NOT NULL REFERENCES kuis_logs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_time INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  UNIQUE(kuis_id, name)
);

CREATE TABLE IF NOT EXISTS kuis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  time_taken INTEGER NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, question_id)
);

-- Enable RLS
ALTER TABLE kuis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE player ENABLE ROW LEVEL SECURITY;
ALTER TABLE kuis_results ENABLE ROW LEVEL SECURITY;

-- Policies for kuis_logs
CREATE POLICY "Public read access for kuis_logs" ON kuis_logs FOR SELECT USING (true);
CREATE POLICY "Admin write access for kuis_logs" ON kuis_logs FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local') WITH CHECK (auth.jwt() ->> 'email' = 'admin@exam.local');

-- Policies for player
CREATE POLICY "Public read access for player" ON player FOR SELECT USING (true);
CREATE POLICY "Public insert access for player" ON player FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for player" ON player FOR UPDATE USING (true);
CREATE POLICY "Admin delete access for player" ON player FOR DELETE TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');

-- Policies for kuis_results
CREATE POLICY "Public read access for kuis_results" ON kuis_results FOR SELECT USING (true);
CREATE POLICY "Public insert access for kuis_results" ON kuis_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for kuis_results" ON kuis_results FOR UPDATE USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE kuis_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE player;
