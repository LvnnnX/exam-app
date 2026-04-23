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