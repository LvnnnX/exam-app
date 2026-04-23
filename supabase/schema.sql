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
  user_answers JSONB DEFAULT '[]'::jsonb
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

-- ============================================================
-- Seed questions by category
-- ============================================================

-- Category: combinatorics
INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, category) VALUES
('How many ways can 5 people be seated in a row?', '25', '120', '60', '24', '720', 'B', 'combinatorics'),
('What is 7 choose 3 (C(7,3))?', '21', '35', '42', '30', '28', 'B', 'combinatorics'),
('How many subsets does a set with 4 elements have?', '8', '12', '16', '4', '24', 'C', 'combinatorics'),
('What is the value of 0! (zero factorial)?', '0', '1', 'Undefined', 'Infinity', '-1', 'B', 'combinatorics'),
('How many diagonals does a hexagon have?', '6', '9', '12', '15', '3', 'B', 'combinatorics'),
('In how many ways can 3 letters be chosen from ABCDE?', '5', '10', '15', '20', '60', 'B', 'combinatorics'),
('What is the number of permutations of the word BOOK?', '24', '12', '6', '4', '8', 'B', 'combinatorics'),
('How many ways to distribute 4 identical balls into 3 distinct boxes?', '12', '15', '7', '81', '64', 'B', 'combinatorics'),
('The Pigeonhole Principle states that if n+1 objects are placed into n boxes then?', 'All boxes are empty', 'At least one box has more than one object', 'Each box has exactly one object', 'No conclusion can be drawn', 'All boxes have two objects', 'B', 'combinatorics'),
('What is C(n,0) + C(n,1) + ... + C(n,n) equal to?', 'n!', 'n^2', '2^n', '2n', 'n', 'C', 'combinatorics'),
('How many bit strings of length 8 are there?', '64', '128', '256', '512', '1024', 'C', 'combinatorics'),
('How many ways can a committee of 2 men and 3 women be formed from 5 men and 6 women?', '100', '200', '300', '150', '250', 'B', 'combinatorics'),
('What is the number of derangements of 3 elements?', '1', '2', '3', '4', '6', 'B', 'combinatorics'),
('Stars and bars: ways to put 5 identical items into 3 distinct bins?', '15', '21', '10', '35', '6', 'B', 'combinatorics'),
('How many edges does the complete graph K5 have?', '5', '10', '15', '20', '25', 'B', 'combinatorics'),
('If a password is 4 digits (0-9), how many possible passwords exist?', '1000', '10000', '40', '9999', '100000', 'B', 'combinatorics'),
('How many ways to arrange the letters in MISSISSIPPI?', '34650', '39916800', '11!', '4!4!2!', '5040', 'A', 'combinatorics'),
('What is P(8,3) (permutation of 8 taken 3)?', '56', '120', '336', '512', '40320', 'C', 'combinatorics'),
('The Catalan number C3 equals?', '2', '5', '14', '42', '1', 'B', 'combinatorics'),
('How many surjections from a 4-element set to a 3-element set?', '36', '81', '12', '24', '64', 'A', 'combinatorics');

-- Category: coding
INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, category) VALUES
('What is the time complexity of binary search?', 'O(n)', 'O(log n)', 'O(n log n)', 'O(1)', 'O(n²)', 'B', 'coding'),
('Which data structure uses LIFO?', 'Queue', 'Stack', 'Array', 'Linked List', 'Tree', 'B', 'coding'),
('Which HTTP methods are idempotent?', 'POST', 'GET', 'PATCH', 'PUT', 'GET and PUT', 'E', 'coding'),
('In balanced BST, insertion takes?', 'O(1)', 'O(n)', 'O(log n)', 'O(n log n)', 'O(n²)', 'C', 'coding'),
('Which sort has O(n log n) worst-case?', 'Bubble sort', 'Insertion sort', 'Selection sort', 'Merge sort', 'Quick sort', 'D', 'coding'),
('CSS property for text color?', 'background-color', 'color', 'font-size', 'text-color', 'font-weight', 'B', 'coding'),
('Which is safer for unknown types in TypeScript?', 'any', 'unknown', 'never', 'unknown | any', 'string', 'B', 'coding'),
('HTTP 201 indicates?', 'OK', 'Created', 'No Content', 'Bad Request', 'Not Found', 'B', 'coding'),
('BFS time complexity is?', 'O(V)', 'O(E)', 'O(V+E)', 'O(V*E)', 'O(log V)', 'C', 'coding'),
('Which NOT a JavaScript primitive?', 'string', 'number', 'boolean', 'object', 'symbol', 'D', 'coding'),
('What does the "===" operator check in JavaScript?', 'Value only', 'Type only', 'Value and type', 'Reference only', 'Nothing', 'C', 'coding'),
('Which keyword declares a constant in JavaScript?', 'var', 'let', 'const', 'static', 'final', 'C', 'coding'),
('What is the output of typeof null in JavaScript?', 'null', 'undefined', 'object', 'boolean', 'NaN', 'C', 'coding'),
('Which method adds an element to the end of an array?', 'shift()', 'unshift()', 'pop()', 'push()', 'splice()', 'D', 'coding'),
('What does REST stand for?', 'Real-time Event Streaming Technology', 'Representational State Transfer', 'Remote Execution Service Tool', 'Reliable Endpoint Security Token', 'Resource Entity State Transformer', 'B', 'coding'),
('In Python, which keyword starts a function?', 'function', 'func', 'def', 'fn', 'lambda', 'C', 'coding'),
('What is a closure in programming?', 'A syntax error', 'A function with access to its outer scope', 'A terminated process', 'A class destructor', 'A type of loop', 'B', 'coding'),
('Which Git command creates a new branch?', 'git new', 'git branch', 'git create', 'git fork', 'git init', 'B', 'coding'),
('What is the purpose of an API?', 'Store data permanently', 'Enable communication between software', 'Compile source code', 'Debug applications', 'Manage memory allocation', 'B', 'coding'),
('Which data structure uses FIFO ordering?', 'Stack', 'Queue', 'Tree', 'Hash Map', 'Graph', 'B', 'coding');

-- Category: general_informatics
INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, category) VALUES
('ACID in databases stands for?', 'Atomicity, Consistency, Isolation, Durability', 'Atomic, Consistency, Instant, Durability', 'Asynchronous, Consistent, Isolated, Durable', 'Atomicity, Concurrency, Isolation, Durability', 'Atomic, Consistency, Isolation, Durability', 'A', 'general_informatics'),
('Which SQL join returns left table all records?', 'INNER JOIN', 'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'B', 'general_informatics'),
('Which property does a primary key enforce?', 'Nullable', 'Duplicates Allowed', 'Not Null Only', 'Not Null and Unique', 'Indexed Only', 'D', 'general_informatics'),
('A hash collision occurs when?', 'Two distinct keys map to same hash', 'Two identical keys map to same value', 'Hash functions are perfect', 'Collision implies overflow', 'No such thing as collision', 'A', 'general_informatics'),
('Normalization aims to?', 'Increase redundancy', 'Reduce redundancy', 'Speed up queries', 'Cannot be achieved', 'Denormalize data', 'B', 'general_informatics'),
('Which SQL clause filters rows?', 'GROUP BY', 'ORDER BY', 'WHERE', 'HAVING', 'LIMIT', 'C', 'general_informatics'),
('In memory, stack stores?', 'Dynamic memory', 'Function call frames and local variables', 'Always larger than heap', 'Same as heap', 'Global objects', 'B', 'general_informatics'),
('Which SQL function counts rows?', 'SUM', 'AVG', 'MAX', 'COUNT', 'TOTAL', 'D', 'general_informatics'),
('In graph theory, a cycle is?', 'Path with unique vertices', 'Path starts and ends at same vertex', 'A tree', 'A connected component', 'A loop', 'B', 'general_informatics'),
('Database index improves?', 'Write performance', 'Memory usage', 'Query performance', 'Disk I/O', 'Both a and c', 'C', 'general_informatics'),
('What does CPU stand for?', 'Central Processing Unit', 'Computer Personal Utility', 'Central Program Utility', 'Core Processing Unit', 'Central Processor Uniform', 'A', 'general_informatics'),
('What is the binary representation of decimal 10?', '1000', '1010', '1100', '1001', '1110', 'B', 'general_informatics'),
('Which layer of the OSI model handles routing?', 'Data Link', 'Network', 'Transport', 'Session', 'Physical', 'B', 'general_informatics'),
('What is the primary function of an operating system?', 'Run web browsers', 'Manage hardware resources', 'Create documents', 'Send emails', 'Edit photos', 'B', 'general_informatics'),
('Which number system uses base 16?', 'Binary', 'Octal', 'Decimal', 'Hexadecimal', 'Ternary', 'D', 'general_informatics'),
('What does RAM stand for?', 'Read Access Memory', 'Random Access Memory', 'Readily Available Memory', 'Rapid Action Memory', 'Run All Memory', 'B', 'general_informatics'),
('What is the smallest unit of data in a computer?', 'Byte', 'Bit', 'Nibble', 'Word', 'Kilobyte', 'B', 'general_informatics'),
('Which protocol is used for secure web browsing?', 'HTTP', 'FTP', 'HTTPS', 'SMTP', 'TCP', 'C', 'general_informatics'),
('What type of software is Linux?', 'Application software', 'Operating system', 'Firmware', 'Middleware', 'Utility', 'B', 'general_informatics'),
('How many bits are in a byte?', '2', '4', '6', '8', '16', 'D', 'general_informatics');

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
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE exam_logs ENABLE ROW LEVEL SECURITY;

-- 1. Start Exam Session
CREATE OR REPLACE FUNCTION start_exam_session(p_name TEXT, p_category TEXT, p_mode TEXT, p_count INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_question_ids INT[];
  v_actual_count INT;
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

  INSERT INTO exam_logs (name, category, mode, question_count, question_ids)
  VALUES (p_name, p_category, p_mode, v_actual_count, v_question_ids)
  RETURNING session_id INTO v_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'question_count', v_actual_count
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
    'name', v_log.name
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
RETURNS BOOLEAN
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
  IF v_log.session_id IS NULL OR v_log.is_finished THEN RETURN FALSE; END IF;
  
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
      
      RETURN v_is_correct;
    END IF;
  END IF;
  
  RETURN true;
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
BEGIN
  SELECT * INTO v_log FROM exam_logs WHERE session_id = p_session_id;
  
  IF v_log.session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  UPDATE exam_logs SET is_finished = true WHERE session_id = p_session_id;

  FOR v_q_index IN 0..(v_log.question_count - 1)
  LOOP
    v_user_ans_text := v_log.user_answers->>(v_q_index::text);
    v_q_id := v_log.question_ids[v_q_index + 1];
    
    IF v_q_id IS NOT NULL THEN
        SELECT question_text, correct_answer INTO v_question_text, v_correct_label FROM questions WHERE id = v_q_id;
        
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

        v_recap := v_recap || jsonb_build_object(
          'question_text', v_question_text,
          'user_answer', v_user_ans_text,
          'correct_text', v_correct_text,
          'is_correct', v_is_correct
        );
    END IF;
  END LOOP;
  
  INSERT INTO exam_results (name, score, total_questions, category, question_count, taken_at, user_answers, start_time, end_time, mode)
  VALUES (v_log.name, v_score, v_log.question_count, v_log.category, v_log.question_count, p_end_time, v_processed_answers, v_log.start_time, p_end_time, v_log.mode);
  
  DELETE FROM exam_logs WHERE session_id = p_session_id;
  
  RETURN jsonb_build_object('score', v_score, 'recap', v_recap);
END;
$$;