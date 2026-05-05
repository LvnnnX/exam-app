-- 1. Create a secure view for categories
CREATE OR REPLACE VIEW public_categories AS
SELECT id, mapels, babs, sub_babs FROM questions WHERE is_hidden = false;

GRANT SELECT ON public_categories TO anon, authenticated;

-- 2. Create a secure view for kuis_logs
CREATE OR REPLACE VIEW public_kuis_logs AS
SELECT id, quiz_code, mapel, bab, sub_bab, question_count, duration_minutes, status, created_at, started_at, finished_at, expires_at, paused_at, scheduled_at
FROM kuis_logs;

GRANT SELECT ON public_kuis_logs TO anon, authenticated;

-- 3. Create RPC for finish_player_quiz
CREATE OR REPLACE FUNCTION finish_player_quiz_rpc(p_player_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE player SET finished_at = NOW() WHERE id = p_player_id;
END;
$$;
GRANT EXECUTE ON FUNCTION finish_player_quiz_rpc TO anon, authenticated;

-- 4. Create secure view for leaderboard and player checking
CREATE OR REPLACE VIEW public_players AS
SELECT id, kuis_id, name, score, total_time, joined_at, finished_at
FROM player;

GRANT SELECT ON public_players TO anon, authenticated;

-- 5. Revoke direct access and tighten RLS
-- First, drop the overly permissive policies
DROP POLICY IF EXISTS "questions_public_read" ON questions;
DROP POLICY IF EXISTS "exam_results_insert" ON exam_results;
DROP POLICY IF EXISTS "exam_results_read" ON exam_results;
DROP POLICY IF EXISTS "exam_logs_read" ON exam_logs;
DROP POLICY IF EXISTS "kuis_logs_public" ON kuis_logs;
DROP POLICY IF EXISTS "player_public" ON player;
DROP POLICY IF EXISTS "kuis_results_public" ON kuis_results;

-- Restrict to admin only for everything except app_settings_read
-- Admin policies already exist or can be recreated
CREATE POLICY "questions_admin_all" ON questions FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');
CREATE POLICY "exam_results_admin_all" ON exam_results FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');
CREATE POLICY "exam_logs_admin_all" ON exam_logs FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');
CREATE POLICY "kuis_logs_admin_all" ON kuis_logs FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');
CREATE POLICY "player_admin_all" ON player FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');
CREATE POLICY "kuis_results_admin_all" ON kuis_results FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');

-- 6. Secure submit_live_quiz_answer_v2 RPC (Flow Validation)
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
  v_kuis_id UUID;
  v_quiz_status TEXT;
  v_allowed_question_ids INT[];
BEGIN
  -- 1. Validate Player and Fetch Quiz ID
  SELECT kuis_id INTO v_kuis_id FROM player WHERE id = p_player_id::UUID;
  IF v_kuis_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- 2. Validate Quiz State and Fetch Allowed Questions
  SELECT status, question_ids INTO v_quiz_status, v_allowed_question_ids FROM kuis_logs WHERE id = v_kuis_id;
  IF v_quiz_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quiz is not active');
  END IF;

  -- 3. Strict Flow Validation: Ensure Question is Assigned to Quiz
  IF NOT p_question_id = ANY(v_allowed_question_ids) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized question access');
  END IF;

  -- 4. Proceed with grading
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

-- 7. Secure get_live_quiz_question RPC (Flow Validation)
CREATE OR REPLACE FUNCTION get_live_quiz_question(p_player_id TEXT, p_index INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kuis_id UUID;
  v_quiz_status TEXT;
  v_question_ids INT[];
  v_question_id INT;
  v_question_data RECORD;
BEGIN
  -- Validate Player
  SELECT kuis_id INTO v_kuis_id FROM player WHERE id = p_player_id::UUID;
  IF v_kuis_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Validate Quiz State
  SELECT status, question_ids INTO v_quiz_status, v_question_ids FROM kuis_logs WHERE id = v_kuis_id;
  IF v_quiz_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quiz is not active');
  END IF;

  -- Validate Index
  IF p_index < 0 OR p_index >= array_length(v_question_ids, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid question index');
  END IF;

  -- Get secure question
  v_question_id := v_question_ids[p_index + 1];
  
  SELECT id, question_text, option_a, option_b, option_c, option_d, option_e,
         (CASE WHEN short_answer IS NOT NULL AND trim(short_answer) != '' THEN 'short_answer' ELSE 'multiple_choice' END)::TEXT AS question_type
  INTO v_question_data
  FROM questions WHERE id = v_question_id AND is_hidden = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Question not found or hidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'id', v_question_data.id,
      'question_text', v_question_data.question_text,
      'option_a', v_question_data.option_a,
      'option_b', v_question_data.option_b,
      'option_c', v_question_data.option_c,
      'option_d', v_question_data.option_d,
      'option_e', v_question_data.option_e,
      'question_type', v_question_data.question_type
    )
  );
END;
$$;
-- In order to set the custom setting securely, the Database Admin must execute this once:
-- ALTER DATABASE postgres SET "app.settings.exam_secret" TO 'YOUR_SECRET_HERE';

-- Secure RPCs that check the header directly without relying on RLS policies
-- since RLS policies with custom headers require postgREST configuration or database level custom settings
-- which are harder to deploy automatically without admin access.

-- For our RPC functions, we can validate the secret directly inside the function
-- First, let's update the existing RPCs to enforce the header check
CREATE OR REPLACE FUNCTION validate_exam_secret()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate the secret from the header against the database setting
  -- Fallback to 'default-secret-key-123' if the setting is not configured
  RETURN current_setting('request.headers', true)::json->>'x-exam-secret' = COALESCE(current_setting('app.settings.exam_secret', true), 'default-secret-key-123');
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

-- Modify submit_live_quiz_answer_v2 to include header validation
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
  v_kuis_id UUID;
  v_quiz_status TEXT;
  v_allowed_question_ids INT[];
BEGIN
  -- Authenticate request via custom secret header
  IF NOT validate_exam_secret() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized access. Invalid or missing secret key.');
  END IF;

  -- Validate Player and Fetch Quiz ID
  SELECT kuis_id INTO v_kuis_id FROM player WHERE id = p_player_id::UUID;
  IF v_kuis_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Validate Quiz State and Fetch Allowed Questions
  SELECT status, question_ids INTO v_quiz_status, v_allowed_question_ids FROM kuis_logs WHERE id = v_kuis_id;
  IF v_quiz_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quiz is not active');
  END IF;

  -- Strict Flow Validation: Ensure Question is Assigned to Quiz
  IF NOT p_question_id = ANY(v_allowed_question_ids) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized question access');
  END IF;

  -- Proceed with secure grading
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
  
  -- Sanitize and compare
  v_is_correct := (lower(trim(strip_html(p_user_answer))) = lower(trim(strip_html(v_correct_text))));

  INSERT INTO kuis_results (player_id, question_id, user_answer, is_correct, time_taken) VALUES (p_player_id::UUID, p_question_id, p_user_answer, v_is_correct, p_time_taken) ON CONFLICT (player_id, question_id) DO NOTHING;
  UPDATE player SET score = score + CASE WHEN v_is_correct THEN 1 ELSE 0 END, total_time = total_time + p_time_taken WHERE id = p_player_id::UUID;
  
  RETURN jsonb_build_object('success', true, 'is_correct', v_is_correct);
END;
$$;

-- Modify get_live_quiz_question to include header validation
CREATE OR REPLACE FUNCTION get_live_quiz_question(p_player_id TEXT, p_index INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kuis_id UUID;
  v_quiz_status TEXT;
  v_question_ids INT[];
  v_question_id INT;
  v_question_data RECORD;
BEGIN
  -- Authenticate request via custom secret header
  IF NOT validate_exam_secret() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized access. Invalid or missing secret key.');
  END IF;

  -- Validate Player
  SELECT kuis_id INTO v_kuis_id FROM player WHERE id = p_player_id::UUID;
  IF v_kuis_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Validate Quiz State
  SELECT status, question_ids INTO v_quiz_status, v_question_ids FROM kuis_logs WHERE id = v_kuis_id;
  IF v_quiz_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quiz is not active');
  END IF;

  -- Validate Index against Server State
  IF p_index < 0 OR p_index >= array_length(v_question_ids, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid question index');
  END IF;

  -- Get secure question
  v_question_id := v_question_ids[p_index + 1];
  
  SELECT id, question_text, option_a, option_b, option_c, option_d, option_e,
         (CASE WHEN short_answer IS NOT NULL AND trim(short_answer) != '' THEN 'short_answer' ELSE 'multiple_choice' END)::TEXT AS question_type
  INTO v_question_data
  FROM questions WHERE id = v_question_id AND is_hidden = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Question not found or hidden');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'id', v_question_data.id,
      'question_text', v_question_data.question_text,
      'option_a', v_question_data.option_a,
      'option_b', v_question_data.option_b,
      'option_c', v_question_data.option_c,
      'option_d', v_question_data.option_d,
      'option_e', v_question_data.option_e,
      'question_type', v_question_data.question_type
    )
  );
END;
$$;
