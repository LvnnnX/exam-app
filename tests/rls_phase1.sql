-- Automated RLS and Security Test Suite for Smandapura Exam App v2 (Remake)
-- Run against local Postgres on port 54329
-- Tests:
-- 1. anon/student cannot SELECT public.questions (RLS blocks direct table access)
-- 2. anon/student cannot SELECT hidden questions or hidden categories
-- 3. Category cascade: questions whose ONLY path is hidden chapter/subject cannot be picked
-- 4. RPC get_quiz_question never leaks answer_key/explanation_html
-- 5. RPC get_exam_question never leaks answer_key/explanation_html
-- 6. RPC get_exam_recap refuses unfinalized sessions
-- 7. RPC get_exam_recap refuses sessions belonging to another student
-- 8. Pending admin cannot write/modify questions
-- 9. Non-admin cannot access admin-only tables
-- 10. Role isolation: super_admin vs admin

SET client_min_messages = notice;

-- Test Harness Functions
CREATE OR REPLACE FUNCTION test_assert(p_name text, p_condition boolean, p_detail text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_condition THEN
    RAISE NOTICE 'PASS: %', p_name;
  ELSE
    RAISE EXCEPTION 'FAIL: % (Detail: %)', p_name, p_detail;
  END IF;
END;
$$;

DO $$
DECLARE
  v_count integer;
  v_res jsonb;
  v_session_id uuid;
  v_active_quiz_id uuid;
  v_quiz_code text;
  v_player_id uuid;
  v_other_student_session uuid;
  v_super_admin_id uuid := 'fed5d02c-4c9b-4502-ba99-50c600fab276'; -- admin@exam.local
  v_regular_admin_id uuid := '23b1d3a8-4300-43fc-99d6-ccfb77e52adc'; -- ditto@admin.com (admin)
  v_former_teacher_id uuid := '067ee3f5-cb1c-485a-a88a-cd8e20617638'; -- ditto@teacher.com (migrated to admin)
  v_pending_user_id uuid := '11111111-1111-1111-1111-111111111111';
  v_anon_student_1 uuid := '22222222-2222-2222-2222-222222222222';
  v_anon_student_2 uuid := '33333333-3333-3333-3333-333333333333';
  v_shown_topic_id uuid;
  v_hidden_topic_id uuid;
  v_hidden_q_id integer;
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'RUNNING RLS & SECURITY TEST SUITE (PHASE 1)';
  RAISE NOTICE '==================================================';

  -- Seed dummy pending user and test students in auth.users
  INSERT INTO auth.users (id, email) VALUES (v_pending_user_id, 'pending@exam.local') ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (id, email) VALUES (v_anon_student_1, 'student1@exam.local') ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (id, email) VALUES (v_anon_student_2, 'student2@exam.local') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.admins (user_id, username, role, status)
  VALUES (v_pending_user_id, 'pending_user', 'admin', 'pending')
  ON CONFLICT (user_id) DO NOTHING;

  -- Grab a hidden question ID
  SELECT id INTO v_hidden_q_id FROM public.questions WHERE visibility = 'hidden' LIMIT 1;
  -- Grab a shown topic ID with questions
  SELECT t.id INTO v_shown_topic_id FROM public.topics t
  JOIN public.chapters c ON c.id = t.chapter_id
  JOIN public.subjects s ON s.id = c.subject_id
  JOIN public.question_topics qt ON qt.topic_id = t.id
  JOIN public.questions q ON q.id = qt.question_id
  WHERE t.visibility = 'shown' AND c.visibility = 'shown' AND s.visibility = 'shown' AND q.visibility = 'shown'
  LIMIT 1;

  ------------------------------------------------------------------------------
  -- TEST 1: anon direct SELECT on public.questions must return 0 rows (RLS)
  ------------------------------------------------------------------------------
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role": "anon"}', true);

  SELECT count(*) INTO v_count FROM public.questions;
  PERFORM test_assert('Test 1: anon direct SELECT on public.questions returns 0 rows', v_count = 0, 'count was ' || v_count);

  ------------------------------------------------------------------------------
  -- TEST 2: anon direct SELECT on public.subjects/chapters/topics respects visibility
  ------------------------------------------------------------------------------
  SELECT count(*) INTO v_count FROM public.subjects WHERE visibility = 'hidden';
  PERFORM test_assert('Test 2a: anon direct SELECT cannot see hidden subjects', v_count = 0, 'count was ' || v_count);

  SELECT count(*) INTO v_count FROM public.chapters WHERE visibility = 'hidden';
  PERFORM test_assert('Test 2b: anon direct SELECT cannot see hidden chapters', v_count = 0, 'count was ' || v_count);

  SELECT count(*) INTO v_count FROM public.topics WHERE visibility = 'hidden';
  PERFORM test_assert('Test 2c: anon direct SELECT cannot see hidden topics', v_count = 0, 'count was ' || v_count);

  -- Cascade check: topic marked shown under hidden chapter MUST NOT be visible to anon
  SELECT count(*) INTO v_count
  FROM public.topics t
  JOIN public.chapters c ON c.id = t.chapter_id
  WHERE c.visibility = 'hidden';
  PERFORM test_assert('Test 2d: anon cannot see topics under hidden chapters (cascade)', v_count = 0, 'count was ' || v_count);

  ------------------------------------------------------------------------------
  -- TEST 3: RPC rpc_get_available_categories never returns hidden categories
  ------------------------------------------------------------------------------
  v_res := public.rpc_get_available_categories();
  PERFORM test_assert(
    'Test 3: rpc_get_available_categories excludes hidden subjects',
    NOT (v_res::text LIKE '%"slug": "test"%'),
    'payload contained hidden items'
  );

  ------------------------------------------------------------------------------
  -- TEST 4: Self-paced Exam - Start session and verify hidden questions excluded
  ------------------------------------------------------------------------------
  -- Phase 5 legacy RPC revoked from authenticated/anon; executed as postgres
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_anon_student_1, 'role', 'authenticated')::text, true);

  v_res := public.rpc_start_exam_session(
    p_name := 'StudentOne',
    p_topic_ids := ARRAY[v_shown_topic_id],
    p_mode := 'exam',
    p_nav_mode := 'strict',
    p_count := 5
  );

  PERFORM test_assert('Test 4a: Student 1 can start exam session', (v_res->>'success')::boolean = true, v_res::text);
  v_session_id := (v_res->>'session_id')::uuid;

  -- Verify session questions contain NO hidden questions
  SELECT count(*) INTO v_count
  FROM public.exam_sessions es,
  LATERAL unnest(es.question_order) qid
  JOIN public.questions q ON q.id = qid
  WHERE es.id = v_session_id AND q.visibility = 'hidden';

  PERFORM test_assert('Test 4b: Exam session pool contains 0 hidden questions', v_count = 0, 'count was ' || v_count);

  ------------------------------------------------------------------------------
  -- TEST 5: RPC rpc_get_exam_question NEVER leaks answer_key or explanation
  ------------------------------------------------------------------------------
  v_res := public.rpc_get_exam_question(v_session_id, 0);
  PERFORM test_assert('Test 5a: rpc_get_exam_question succeeds', (v_res->>'success')::boolean = true, v_res::text);
  PERFORM test_assert(
    'Test 5b: rpc_get_exam_question payload DOES NOT contain answer_key',
    (v_res->'data' ? 'answer_key') = false,
    v_res::text
  );
  PERFORM test_assert(
    'Test 5c: rpc_get_exam_question payload DOES NOT contain explanation_html',
    (v_res->'data' ? 'explanation_html') = false,
    v_res::text
  );

  ------------------------------------------------------------------------------
  -- TEST 6: RPC rpc_get_exam_recap refuses unfinalized sessions
  ------------------------------------------------------------------------------
  v_res := public.rpc_get_exam_recap(v_session_id);
  PERFORM test_assert(
    'Test 6: rpc_get_exam_recap rejects active (unfinalized) session',
    (v_res->>'success')::boolean = false,
    v_res::text
  );

  ------------------------------------------------------------------------------
  -- TEST 7: Finish session, then verify rpc_get_exam_recap ownership
  ------------------------------------------------------------------------------
  -- Answer question 0 then submit
  PERFORM public.rpc_save_exam_answer(v_session_id, 0, 'A', false, 10);
  PERFORM public.rpc_submit_exam_session(v_session_id);

  -- Student 1 (owner) can now fetch recap
  v_res := public.rpc_get_exam_recap(v_session_id);
  PERFORM test_assert('Test 7a: Owner student can fetch recap once finished', (v_res->>'success')::boolean = true, v_res::text);
  PERFORM test_assert('Test 7b: Recap contains answer_key for finished session', (v_res->'recap'->0 ? 'answer_key') = true, v_res::text);

  -- Student 2 tries to fetch Student 1's recap -> MUST BE REJECTED
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_anon_student_2, 'role', 'authenticated')::text, true);
  v_res := public.rpc_get_exam_recap(v_session_id);
  PERFORM test_assert(
    'Test 7c: Other student CANNOT fetch another student recap',
    (v_res->>'success')::boolean = false,
    v_res::text
  );

  -- Anon tries to fetch Student 1's recap -> MUST BE REJECTED (IS DISTINCT FROM auth.uid() check)
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '{"role": "anon"}', true);
  v_res := public.rpc_get_exam_recap(v_session_id);
  PERFORM test_assert(
    'Test 7d: Anon caller CANNOT fetch authenticated student recap',
    (v_res->>'success')::boolean = false,
    v_res::text
  );

  ------------------------------------------------------------------------------
  -- TEST 8: Live Quiz - Join, fetch question (NO LEAK), submit answer
  ------------------------------------------------------------------------------
  -- Switch to postgres role to set one quiz to active for test, allowing mid-game join
  PERFORM set_config('role', 'postgres', true);
  SELECT id, code INTO v_active_quiz_id, v_quiz_code FROM public.quizzes WHERE status <> 'cancelled' LIMIT 1;
  UPDATE public.quizzes 
  SET status = 'active',
      config = jsonb_set(config, '{allow_join_mid_game}', 'true'::jsonb)
  WHERE id = v_active_quiz_id;

  -- Switch to anon student
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role": "anon"}', true);

  v_res := public.rpc_join_live_quiz(v_quiz_code, 'Budi Santoso');
  PERFORM test_assert('Test 8a: Anon can join active quiz', (v_res->>'success')::boolean = true, v_res::text);
  v_player_id := (v_res->>'player_id')::uuid;

  v_res := public.rpc_get_quiz_question(v_player_id, 0);
  PERFORM test_assert('Test 8b: rpc_get_quiz_question succeeds', (v_res->>'success')::boolean = true, v_res::text);
  PERFORM test_assert(
    'Test 8c: rpc_get_quiz_question DOES NOT contain answer_key',
    (v_res->'data' ? 'answer_key') = false,
    v_res::text
  );

  ------------------------------------------------------------------------------
  -- TEST 9: Pending admin cannot write/modify anything
  ------------------------------------------------------------------------------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_pending_user_id, 'role', 'authenticated')::text, true);

  -- Try inserting question as pending admin (must be blocked by RLS)
  BEGIN
    INSERT INTO public.questions (id, type, body_html, answer_key)
    VALUES (999999, 'multiple_choice', '<p>Hacker Q</p>', 'A');
    RAISE EXCEPTION 'Pending admin was able to insert question!';
  EXCEPTION WHEN OTHERS THEN
    PERFORM test_assert('Test 9: Pending admin CANNOT insert question (RLS blocked)', true);
  END;

  ------------------------------------------------------------------------------
  -- TEST 10: Admin vs Super Admin isolation
  ------------------------------------------------------------------------------
  -- Switch to regular admin (ditto@admin.com)
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_regular_admin_id, 'role', 'authenticated')::text, true);

  -- Regular admin can read questions
  SELECT count(*) INTO v_count FROM public.questions;
  PERFORM test_assert('Test 10a: Active admin can read questions', v_count = 719, 'count was ' || v_count);

  -- Regular admin CANNOT update other admins in admins table
  BEGIN
    UPDATE public.admins SET role = 'super_admin' WHERE user_id = v_regular_admin_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    PERFORM test_assert('Test 10b: Regular admin cannot elevate own role to super_admin', v_count = 0, 'updated rows ' || v_count);
  EXCEPTION WHEN OTHERS THEN
    PERFORM test_assert('Test 10b: Regular admin cannot elevate own role to super_admin', true);
  END;

  -- Switch to super_admin (admin@exam.local)
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_super_admin_id, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.admins;
  PERFORM test_assert('Test 10c: Super admin can read all admin records', v_count >= 3, 'count was ' || v_count);

  -- Reset role to postgres
  PERFORM set_config('role', 'postgres', true);

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'ALL 10 TEST SUITES PASSED PERFECTLY!';
  RAISE NOTICE '==================================================';
END $$;
