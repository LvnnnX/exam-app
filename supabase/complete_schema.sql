-- ============================================================
-- Supabase Schema for Exam Web Application (Consolidated)
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLES
-- Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  option_e TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  short_answer TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  mapels TEXT[] NOT NULL DEFAULT '{}',
  babs TEXT[] NOT NULL DEFAULT '{}',
  sub_babs TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exam logs (Active Sessions)
CREATE TABLE IF NOT EXISTS exam_logs (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mapel TEXT NOT NULL DEFAULT '',
  bab TEXT NOT NULL DEFAULT '',
  sub_bab TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  question_ids INT[] NOT NULL DEFAULT '{}',
  current_index INTEGER NOT NULL DEFAULT 0,
  user_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  lives INTEGER NOT NULL DEFAULT 3,
  is_finished BOOLEAN NOT NULL DEFAULT false,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 days'),
  user_agent TEXT
);

-- Exam results (Historical Data)
CREATE TABLE IF NOT EXISTS exam_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  mapel TEXT NOT NULL DEFAULT '',
  bab TEXT NOT NULL DEFAULT '',
  sub_bab TEXT NOT NULL DEFAULT '',
  question_count INTEGER NOT NULL DEFAULT 20,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_answers JSONB DEFAULT '[]'::jsonb,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  mode TEXT NOT NULL DEFAULT 'exam'
);

-- App Settings (Admin Controls)
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hidden_mapels TEXT[] NOT NULL DEFAULT '{}',
  admin_only_mapels TEXT[] NOT NULL DEFAULT '{}',
  hidden_babs TEXT[] NOT NULL DEFAULT '{}',
  admin_only_babs TEXT[] NOT NULL DEFAULT '{}',
  hidden_sub_babs TEXT[] NOT NULL DEFAULT '{}',
  admin_only_sub_babs TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quiz Logs (Live Quiz Sessions)
CREATE TABLE IF NOT EXISTS kuis_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_code TEXT UNIQUE NOT NULL,
  mapel TEXT NOT NULL DEFAULT '',
  bab TEXT NOT NULL DEFAULT '',
  sub_bab TEXT NOT NULL DEFAULT '',
  question_count INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, active, finished, paused
  question_ids INT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ
);

-- Quiz Players
CREATE TABLE IF NOT EXISTS player (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kuis_id UUID NOT NULL REFERENCES kuis_logs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_time INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  question_ids INT[],
  UNIQUE(kuis_id, name)
);

-- Quiz Results
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

-- 3. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION strip_html(html_text TEXT) RETURNS TEXT AS $$
BEGIN
    RETURN trim(regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(html_text, ''), '<[^>]*>', '', 'g'),
        '&nbsp;|&#160;', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. CONSTRAINTS & SEEDING
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_correct_answer_check;
ALTER TABLE questions ADD CONSTRAINT questions_correct_answer_check CHECK (correct_answer IN ('A', 'B', 'C', 'D', 'E'));

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 5. RPCs (Core Logic)

-- Start Exam Session
CREATE OR REPLACE FUNCTION start_exam_session(
  p_name TEXT, 
  p_mapels TEXT[], 
  p_babs TEXT[], 
  p_sub_babs TEXT[], 
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
    SELECT COUNT(*) INTO v_actual_count FROM questions 
    WHERE (array_length(p_mapels, 1) IS NULL OR mapels && p_mapels)
      AND (array_length(p_babs, 1) IS NULL OR babs && p_babs)
      AND (array_length(p_sub_babs, 1) IS NULL OR sub_babs && p_sub_babs)
      AND is_hidden = false;
    v_question_ids := ARRAY[]::INT[];
  ELSE
    SELECT array_agg(id) INTO v_question_ids FROM (
      SELECT id FROM questions 
      WHERE (array_length(p_mapels, 1) IS NULL OR mapels && p_mapels)
        AND (array_length(p_babs, 1) IS NULL OR babs && p_babs)
        AND (array_length(p_sub_babs, 1) IS NULL OR sub_babs && p_sub_babs)
        AND is_hidden = false 
      ORDER BY random() LIMIT p_count
    ) sq;
    v_question_ids := COALESCE(v_question_ids, ARRAY[]::INT[]);
    v_actual_count := array_length(v_question_ids, 1);
  END IF;

  v_expires_at := CASE WHEN p_time_limit_minutes > 0 THEN NOW() + (p_time_limit_minutes || ' minutes')::INTERVAL ELSE NOW() + INTERVAL '2 days' END;

  INSERT INTO exam_logs (name, mapel, bab, sub_bab, mode, question_count, question_ids, expires_at, user_agent)
  VALUES (p_name, array_to_string(p_mapels, ', '), array_to_string(p_babs, ', '), array_to_string(p_sub_babs, ', '), p_mode, v_actual_count, v_question_ids, v_expires_at, p_user_agent)
  RETURNING session_id INTO v_session_id;

  RETURN jsonb_build_object('session_id', v_session_id, 'question_count', v_actual_count, 'expires_at', v_expires_at);
END;
$$;

-- Get Session State
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
    'current_index', v_log.current_index, 'user_answers', v_log.user_answers, 'lives', v_log.lives,
    'is_finished', v_log.is_finished, 'question_count', v_log.question_count, 'mode', v_log.mode,
    'mapel', v_log.mapel, 'bab', v_log.bab, 'sub_bab', v_log.sub_bab, 'name', v_log.name, 'expires_at', v_log.expires_at
  );
END;
$$;

-- Get Session Question
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
  mapels TEXT[],
  babs TEXT[],
  sub_babs TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_q_id INT;
  v_mode TEXT;
  v_mapels_str TEXT;
  v_babs_str TEXT;
  v_sub_babs_str TEXT;
  v_mapels TEXT[];
  v_babs TEXT[];
  v_sub_babs TEXT[];
  v_existing_ids INT[];
BEGIN
  SELECT mode, mapel, bab, sub_bab, question_ids 
  INTO v_mode, v_mapels_str, v_babs_str, v_sub_babs_str, v_existing_ids
  FROM exam_logs WHERE session_id = p_session_id;

  IF v_mode = 'survival' THEN
    SELECT question_ids[p_index + 1] INTO v_q_id FROM exam_logs WHERE session_id = p_session_id;
    IF v_q_id IS NULL THEN
      v_mapels := string_to_array(v_mapels_str, ', ');
      v_babs := string_to_array(v_babs_str, ', ');
      v_sub_babs := string_to_array(v_sub_babs_str, ', ');

      SELECT q.id INTO v_q_id FROM questions q 
      WHERE (v_mapels_str = '' OR q.mapels && v_mapels)
        AND (v_babs_str = '' OR q.babs && v_babs)
        AND (v_sub_babs_str = '' OR q.sub_babs && v_sub_babs)
        AND q.is_hidden = false 
        AND (v_existing_ids IS NULL OR NOT (q.id = ANY(v_existing_ids)))
      ORDER BY random() LIMIT 1;

      IF v_q_id IS NOT NULL THEN
        UPDATE exam_logs SET question_ids = question_ids || v_q_id WHERE session_id = p_session_id;
      END IF;
    END IF;
  ELSE
    SELECT question_ids[p_index + 1] INTO v_q_id FROM exam_logs WHERE session_id = p_session_id;
  END IF;

  RETURN QUERY
  SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, 
         (CASE WHEN q.short_answer IS NOT NULL AND trim(q.short_answer) != '' THEN 'short_answer' ELSE 'multiple_choice' END)::TEXT,
         q.mapels, q.babs, q.sub_babs
  FROM questions q WHERE q.id = v_q_id;
END;
$$;

-- Save Session Answer
CREATE OR REPLACE FUNCTION save_session_answer(p_session_id UUID, p_index INT, p_answer_text TEXT, p_user_agent TEXT DEFAULT NULL)
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
  IF v_log.session_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'session_not_found'); END IF;
  IF v_log.is_finished THEN RETURN jsonb_build_object('success', false, 'error', 'session_finished'); END IF;
  IF v_log.user_agent IS NOT NULL AND v_log.user_agent <> p_user_agent THEN RETURN jsonb_build_object('success', false, 'error', 'unauthorized_device'); END IF;
  IF p_index < v_log.current_index THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_index_sequence'); END IF;
  IF v_log.expires_at < NOW() THEN UPDATE exam_logs SET is_finished = true WHERE session_id = p_session_id; RETURN jsonb_build_object('success', false, 'error', 'time_expired'); END IF;
  
  UPDATE exam_logs SET user_answers = jsonb_set(user_answers, ARRAY[p_index::text], to_jsonb(p_answer_text)), current_index = p_index WHERE session_id = p_session_id;
  
  v_question_id := v_log.question_ids[p_index + 1];
  IF v_question_id IS NOT NULL THEN
    SELECT correct_answer, short_answer INTO v_correct_label, v_short_answer FROM questions WHERE id = v_question_id;
    IF v_short_answer IS NOT NULL AND trim(v_short_answer) != '' THEN v_correct_text := v_short_answer;
    ELSE
      IF v_correct_label = 'A' THEN SELECT option_a INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'B' THEN SELECT option_b INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'C' THEN SELECT option_c INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'D' THEN SELECT option_d INTO v_correct_text FROM questions WHERE id = v_question_id;
      ELSIF v_correct_label = 'E' THEN SELECT option_e INTO v_correct_text FROM questions WHERE id = v_question_id;
      END IF;
    END IF;
    v_is_correct := (lower(trim(strip_html(p_answer_text))) = lower(trim(strip_html(v_correct_text))));
    IF v_log.mode = 'survival' AND NOT v_is_correct THEN UPDATE exam_logs SET lives = GREATEST(0, lives - 1) WHERE session_id = p_session_id; END IF;
  END IF;
  RETURN jsonb_build_object('success', true, 'is_correct', v_is_correct, 'lives', (SELECT lives FROM exam_logs WHERE session_id = p_session_id));
END;
$$;

-- Submit Session Exam
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
  IF v_log.session_id IS NULL THEN RAISE EXCEPTION 'Session not found'; END IF;
  v_duration_seconds := EXTRACT(EPOCH FROM (p_end_time - v_log.start_time))::INTEGER;
  UPDATE exam_logs SET is_finished = true WHERE session_id = p_session_id;

  FOR v_q_index IN 0..(CASE WHEN v_log.mode = 'survival' THEN COALESCE(array_length(v_log.question_ids, 1), 0) - 1 ELSE v_log.question_count - 1 END) LOOP
    v_user_ans_text := v_log.user_answers->>(v_q_index::text);
    v_q_id := v_log.question_ids[v_q_index + 1];
    IF v_q_id IS NULL THEN CONTINUE; END IF;

    SELECT question_text, correct_answer, short_answer INTO v_question_text, v_correct_label, v_short_answer FROM questions WHERE id = v_q_id;
    IF v_short_answer IS NOT NULL AND trim(v_short_answer) != '' THEN v_correct_text := v_short_answer;
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
      v_is_correct := false; v_user_ans_text := NULL;
    END IF;
    IF v_is_correct THEN v_score := v_score + 1; END IF;
    IF v_log.mode = 'survival' AND v_user_ans_text IS NULL THEN CONTINUE; END IF;

    v_processed_answers := v_processed_answers || jsonb_build_object('question_id', v_q_id, 'user_answer', v_user_ans_text, 'is_correct', v_is_correct);
    v_recap := v_recap || jsonb_build_object('question_text', v_question_text, 'user_answer', v_user_ans_text, 'correct_text', v_correct_text, 'is_correct', v_is_correct);
  END LOOP;

  INSERT INTO exam_results (name, score, total_questions, mapel, bab, sub_bab, question_count, taken_at, user_answers, start_time, end_time, mode, duration_seconds)
  VALUES (v_log.name, v_score, CASE WHEN v_log.mode = 'survival' THEN v_attempted ELSE v_log.question_count END, v_log.mapel, v_log.bab, v_log.sub_bab, CASE WHEN v_log.mode = 'survival' THEN v_attempted ELSE v_log.question_count END, p_end_time, v_processed_answers, v_log.start_time, p_end_time, v_log.mode, v_duration_seconds);
  
  DELETE FROM exam_logs WHERE session_id = p_session_id;
  RETURN jsonb_build_object('score', v_score, 'recap', v_recap, 'total_attempted', v_attempted);
END;
$$;

-- Join Live Quiz
CREATE OR REPLACE FUNCTION join_live_quiz(p_quiz_code TEXT, p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kuis_id UUID;
  v_player_id UUID;
  v_status TEXT;
  v_base_question_ids INT[];
  v_shuffled_ids INT[];
BEGIN
  SELECT id, status, question_ids INTO v_kuis_id, v_status, v_base_question_ids FROM kuis_logs WHERE quiz_code = p_quiz_code;
  IF v_kuis_id IS NULL THEN RETURN jsonb_build_object('success', false, 'message', 'Kuis tidak ditemukan'); END IF;
  IF v_status = 'finished' THEN RETURN jsonb_build_object('success', false, 'message', 'Kuis sudah berakhir'); END IF;

  SELECT array_agg(v ORDER BY random()) INTO v_shuffled_ids FROM unnest(v_base_question_ids) g(v);

  INSERT INTO player (kuis_id, name, question_ids)
  VALUES (v_kuis_id, p_name, v_shuffled_ids)
  ON CONFLICT (kuis_id, name) DO UPDATE SET joined_at = NOW(), question_ids = COALESCE(player.question_ids, EXCLUDED.question_ids)
  RETURNING id INTO v_player_id;

  RETURN jsonb_build_object('success', true, 'player_id', v_player_id);
END;
$$;

-- Get Live Quiz Question
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
  SELECT kuis_id INTO v_kuis_id FROM player WHERE id = p_player_id::UUID;
  IF v_kuis_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Player not found'); END IF;
  SELECT question_ids[p_index + 1] INTO v_q_id FROM player WHERE id = p_player_id::UUID;
  IF v_q_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Question index out of bounds'); END IF;

  SELECT jsonb_build_object(
    'id', q.id, 'question_text', q.question_text, 'option_a', q.option_a, 'option_b', q.option_b, 'option_c', q.option_c, 'option_d', q.option_d, 'option_e', q.option_e,
    'question_type', CASE WHEN q.short_answer IS NOT NULL AND trim(q.short_answer) != '' THEN 'short_answer' ELSE 'multiple_choice' END,
    'mapels', q.mapels, 'babs', q.babs, 'sub_babs', q.sub_babs
  ) INTO v_result FROM questions q WHERE q.id = v_q_id;

  IF v_result IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Question data missing'); END IF;
  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;

-- Submit Live Quiz Answer
CREATE OR REPLACE FUNCTION submit_live_quiz_answer_v2(p_player_id TEXT, p_question_id INT, p_user_answer TEXT, p_time_taken INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correct_answer CHAR(1);
  v_correct_text TEXT;
  v_short_answer TEXT;
  v_is_correct BOOLEAN := false;
BEGIN
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
  v_is_correct := (lower(trim(strip_html(p_user_answer))) = lower(trim(strip_html(v_correct_text))));

  INSERT INTO kuis_results (player_id, question_id, user_answer, is_correct, time_taken) VALUES (p_player_id::UUID, p_question_id, p_user_answer, v_is_correct, p_time_taken) ON CONFLICT (player_id, question_id) DO NOTHING;
  UPDATE player SET score = score + CASE WHEN v_is_correct THEN 1 ELSE 0 END, total_time = total_time + p_time_taken WHERE id = p_player_id::UUID;
  RETURN jsonb_build_object('success', true, 'is_correct', v_is_correct);
END;
$$;

-- Cleanup Expired Sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN DELETE FROM exam_logs WHERE expires_at < NOW() AND is_finished = false; END; $$;

-- 6. VIEWS
CREATE OR REPLACE VIEW public_questions AS
SELECT id, question_text, option_a, option_b, option_c, option_d, option_e, 
       (CASE WHEN short_answer IS NOT NULL AND trim(short_answer) != '' THEN 'short_answer' ELSE 'multiple_choice' END)::TEXT AS question_type, 
       mapels, babs, sub_babs
FROM questions WHERE is_hidden = false;

-- 7. RLS POLICIES
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE kuis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE player ENABLE ROW LEVEL SECURITY;
ALTER TABLE kuis_results ENABLE ROW LEVEL SECURITY;

-- Questions: Admin only manage, View for authenticated
CREATE POLICY "questions_admin_manage" ON questions FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');
CREATE POLICY "questions_public_read" ON questions FOR SELECT USING (true);

-- Results: Public insert, Admin/Owner read
CREATE POLICY "exam_results_insert" ON exam_results FOR INSERT WITH CHECK (true);
CREATE POLICY "exam_results_read" ON exam_results FOR SELECT USING (true);

-- Logs: Authenticated read
CREATE POLICY "exam_logs_read" ON exam_logs FOR SELECT TO authenticated USING (true);

-- App Settings: Public read, Admin write
CREATE POLICY "app_settings_read" ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_write" ON app_settings FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');

-- Quiz: Public access
CREATE POLICY "kuis_logs_public" ON kuis_logs FOR SELECT USING (true);
CREATE POLICY "kuis_logs_admin" ON kuis_logs FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');
CREATE POLICY "player_public" ON player FOR ALL USING (true);
CREATE POLICY "kuis_results_public" ON kuis_results FOR ALL USING (true);

-- 8. STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('exam-images', 'exam-images', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'exam-images');
CREATE POLICY "Authenticated Manage Access" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'exam-images');

-- 9. REALTIME & GRANTS
ALTER PUBLICATION supabase_realtime ADD TABLE kuis_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE player;

GRANT SELECT ON public_questions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION start_exam_session, get_session_state, get_session_question, save_session_answer, submit_session_exam, join_live_quiz, get_live_quiz_question, submit_live_quiz_answer_v2 TO anon, authenticated;
