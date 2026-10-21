-- Migration 20261022000000_remake_v2_phase1.sql
-- Smandapura Exam App v2 Remake - Phase 1 Schema, Data Migration, RLS, and RPCs
-- Executed inside a single transaction

BEGIN;

--------------------------------------------------------------------------------
-- 1. Helper function: normalize_slug (kept in public for app & migration use)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_slug(val text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN trim(both '_' from regexp_replace(regexp_replace(lower(trim(coalesce(val, ''))), '\s+', '_', 'g'), '[^a-z0-9_]', '', 'g'));
END;
$$;

CREATE OR REPLACE FUNCTION public.strip_html(html_text text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN trim(regexp_replace(
    regexp_replace(
      regexp_replace(coalesce(html_text, ''), '<[^>]*>', '', 'g'),
      '&nbsp;|&#160;', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ));
END;
$$;

--------------------------------------------------------------------------------
-- 2. Move existing tables to schema 'legacy'
--------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS legacy;

-- Move tables
ALTER TABLE IF EXISTS public.questions SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.kuis_logs SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.kuis_results SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.player SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.exam_logs SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.exam_results SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.admin_profiles SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.admin_signup_requests SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.app_settings SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.admin_audit_log SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.admin_login_attempts SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.rate_limit_buckets SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.scheduled_exams SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.scheduled_exam_attempts SET SCHEMA legacy;
ALTER TABLE IF EXISTS public.daily_analytics SET SCHEMA legacy;

-- Drop legacy views in public to avoid name collisions
DROP VIEW IF EXISTS public.public_categories CASCADE;
DROP VIEW IF EXISTS public.public_kuis_logs CASCADE;
DROP VIEW IF EXISTS public.public_players CASCADE;
DROP VIEW IF EXISTS public.public_questions CASCADE;
DROP VIEW IF EXISTS public.public_scheduled_exams CASCADE;

--------------------------------------------------------------------------------
-- 3. Create v2 Schemas and Tables
--------------------------------------------------------------------------------

-- 3.1 Admins (role: super_admin, admin; status: pending, active, rejected)
CREATE TABLE public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admins_user_id_unique UNIQUE (user_id),
  CONSTRAINT admins_lower_username_unique UNIQUE (username)
);

CREATE INDEX idx_admins_role ON public.admins(role);
CREATE INDEX idx_admins_status ON public.admins(status);

-- 3.2 Subjects, Chapters, Topics (hierarchical categories)
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  visibility text NOT NULL DEFAULT 'shown' CHECK (visibility IN ('shown', 'hidden')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  visibility text NOT NULL DEFAULT 'shown' CHECK (visibility IN ('shown', 'hidden')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapters_subject_slug_unique UNIQUE (subject_id, slug)
);

CREATE INDEX idx_chapters_subject ON public.chapters(subject_id);

CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  visibility text NOT NULL DEFAULT 'shown' CHECK (visibility IN ('shown', 'hidden')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT topics_chapter_slug_unique UNIQUE (chapter_id, slug)
);

CREATE INDEX idx_topics_chapter ON public.topics(chapter_id);

-- 3.3 Questions
CREATE TABLE public.questions (
  id integer PRIMARY KEY, -- preserves legacy question ID
  type text NOT NULL CHECK (type IN ('multiple_choice', 'short_answer')),
  body_html text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{"label": "A", "text": "..."}]
  answer_key text NOT NULL, -- 'A'-'E' or short answer string
  explanation_html text,
  visibility text NOT NULL DEFAULT 'shown' CHECK (visibility IN ('shown', 'hidden')),
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_questions_visibility ON public.questions(visibility) WHERE archived_at IS NULL;
CREATE INDEX idx_questions_type ON public.questions(type);

-- 3.4 Question - Topics junction (many-to-many)
CREATE TABLE public.question_topics (
  question_id integer NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, topic_id)
);

CREATE INDEX idx_question_topics_topic ON public.question_topics(topic_id);

-- 3.5 Quizzes (Live Quiz)
CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'paused', 'finished', 'cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  paused_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quizzes_code ON public.quizzes(code);
CREATE INDEX idx_quizzes_status ON public.quizzes(status);

-- 3.6 Quiz Questions (Snapshot per quiz)
CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id integer NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  order_index integer NOT NULL,
  CONSTRAINT quiz_questions_quiz_order_unique UNIQUE (quiz_id, order_index)
);

CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions(quiz_id);

-- 3.7 Players (Live Quiz participants)
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  skin text,
  score integer NOT NULL DEFAULT 0,
  total_time integer NOT NULL DEFAULT 0,
  current_index integer NOT NULL DEFAULT 0,
  question_order integer[] NOT NULL DEFAULT '{}'::integer[],
  joined_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT players_quiz_name_unique UNIQUE (quiz_id, name)
);

CREATE INDEX idx_players_quiz ON public.players(quiz_id);
CREATE INDEX idx_players_score ON public.players(quiz_id, score DESC, total_time ASC);

-- 3.8 Answers (Live Quiz player answers)
CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  question_id integer NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  user_answer text,
  is_correct boolean NOT NULL DEFAULT false,
  time_taken integer NOT NULL DEFAULT 0,
  answered_at timestamptz NOT NULL DEFAULT now(),
  violation_count integer NOT NULL DEFAULT 0,
  CONSTRAINT answers_player_question_unique UNIQUE (player_id, question_id)
);

CREATE INDEX idx_answers_player ON public.answers(player_id);

-- 3.9 Exam Sessions (Self-paced Exam & Survival)
CREATE TABLE public.exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('exam', 'survival')),
  nav_mode text NOT NULL DEFAULT 'strict' CHECK (nav_mode IN ('strict', 'standard')),
  selected_categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  question_order integer[] NOT NULL DEFAULT '{}'::integer[],
  current_index integer NOT NULL DEFAULT 0,
  lives integer NOT NULL DEFAULT 3,
  score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished', 'expired', 'abandoned')),
  secret_hash text,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 days'),
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exam_sessions_status ON public.exam_sessions(status);
CREATE INDEX idx_exam_sessions_user ON public.exam_sessions(user_id);

-- 3.10 Exam Answers (Self-paced answers)
CREATE TABLE public.exam_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  question_id integer NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  user_answer text,
  is_marked_doubtful boolean NOT NULL DEFAULT false,
  is_correct boolean NOT NULL DEFAULT false,
  time_taken integer NOT NULL DEFAULT 0,
  answered_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_answers_session_index_unique UNIQUE (session_id, order_index)
);

CREATE INDEX idx_exam_answers_session ON public.exam_answers(session_id);

--------------------------------------------------------------------------------
-- 4. Data Migration
--------------------------------------------------------------------------------

-- 4.1 Admins migration (admin_profiles + approved admin_signup_requests)
-- app_settings visibility sets
WITH app_sett AS (
  SELECT * FROM legacy.app_settings LIMIT 1
)
INSERT INTO public.admins (user_id, username, role, status, created_at, updated_at)
SELECT 
  ap.user_id,
  ap.username,
  CASE WHEN ap.role = 'super_admin' THEN 'super_admin' ELSE 'admin' END AS role,
  'active' AS status,
  ap.created_at,
  ap.updated_at
FROM legacy.admin_profiles ap
ON CONFLICT (user_id) DO NOTHING;

-- Include signup requests that were pending or rejected (none in prod, but for completeness)
INSERT INTO public.admins (user_id, username, role, status, reviewed_by, reviewed_at, rejection_reason, created_at, updated_at)
SELECT
  sr.user_id,
  coalesce(sr.username, 'admin_' || substr(sr.user_id::text, 1, 8)),
  CASE WHEN sr.requested_role = 'super_admin' THEN 'super_admin' ELSE 'admin' END,
  CASE 
    WHEN sr.status = 'approved' THEN 'active'
    WHEN sr.status = 'rejected' THEN 'rejected'
    ELSE 'pending'
  END,
  sr.reviewed_by,
  sr.reviewed_at,
  sr.rejection_reason,
  sr.created_at,
  sr.updated_at
FROM legacy.admin_signup_requests sr
ON CONFLICT (user_id) DO NOTHING;

-- 4.2 Categories migration
-- Collect subjects from questions, with visibility from legacy.app_settings
INSERT INTO public.subjects (name, slug, visibility)
SELECT DISTINCT 
  trim(m.val) AS name,
  public.normalize_slug(m.val) AS slug,
  CASE 
    WHEN public.normalize_slug(m.val) = ANY(s.hidden_mapels || s.admin_only_mapels) THEN 'hidden'
    ELSE 'shown'
  END AS visibility
FROM legacy.questions q
CROSS JOIN LATERAL unnest(q.mapels) AS m(val)
CROSS JOIN (SELECT coalesce(hidden_mapels, '{}'::text[]) hidden_mapels, coalesce(admin_only_mapels, '{}'::text[]) admin_only_mapels FROM legacy.app_settings LIMIT 1) s
WHERE trim(m.val) <> ''
ON CONFLICT (slug) DO NOTHING;

-- Collect chapters from questions paired with subjects
INSERT INTO public.chapters (subject_id, name, slug, visibility)
SELECT DISTINCT
  sub.id AS subject_id,
  trim(b.val) AS name,
  public.normalize_slug(b.val) AS slug,
  CASE 
    WHEN public.normalize_slug(b.val) = ANY(s.hidden_babs || s.admin_only_babs) THEN 'hidden'
    ELSE 'shown'
  END AS visibility
FROM legacy.questions q
CROSS JOIN LATERAL unnest(q.mapels) AS m(val)
CROSS JOIN LATERAL unnest(q.babs) AS b(val)
JOIN public.subjects sub ON sub.slug = public.normalize_slug(m.val)
CROSS JOIN (SELECT coalesce(hidden_babs, '{}'::text[]) hidden_babs, coalesce(admin_only_babs, '{}'::text[]) admin_only_babs FROM legacy.app_settings LIMIT 1) s
WHERE trim(b.val) <> ''
ON CONFLICT (subject_id, slug) DO NOTHING;

-- Collect topics from questions paired with chapters
INSERT INTO public.topics (chapter_id, name, slug, visibility)
SELECT DISTINCT
  ch.id AS chapter_id,
  trim(sb.val) AS name,
  public.normalize_slug(sb.val) AS slug,
  CASE 
    WHEN public.normalize_slug(sb.val) = ANY(s.hidden_sub_babs || s.admin_only_sub_babs) THEN 'hidden'
    ELSE 'shown'
  END AS visibility
FROM legacy.questions q
CROSS JOIN LATERAL unnest(q.mapels) AS m(val)
CROSS JOIN LATERAL unnest(q.babs) AS b(val)
CROSS JOIN LATERAL unnest(q.sub_babs) AS sb(val)
JOIN public.subjects sub ON sub.slug = public.normalize_slug(m.val)
JOIN public.chapters ch ON ch.subject_id = sub.id AND ch.slug = public.normalize_slug(b.val)
CROSS JOIN (SELECT coalesce(hidden_sub_babs, '{}'::text[]) hidden_sub_babs, coalesce(admin_only_sub_babs, '{}'::text[]) admin_only_sub_babs FROM legacy.app_settings LIMIT 1) s
WHERE trim(sb.val) <> ''
ON CONFLICT (chapter_id, slug) DO NOTHING;

-- 4.3 Migrate Questions (719 rows, ID preserved, visibility mapped, options structured)
INSERT INTO public.questions (
  id, type, body_html, options, answer_key, explanation_html, visibility, archived_at, created_by, created_at, updated_at
)
SELECT
  q.id,
  q.question_type::text AS type,
  q.question_text AS body_html,
  CASE 
    WHEN q.question_type = 'short_answer' THEN '[]'::jsonb
    ELSE jsonb_build_array(
      jsonb_build_object('label', 'A', 'text', q.option_a),
      jsonb_build_object('label', 'B', 'text', q.option_b),
      jsonb_build_object('label', 'C', 'text', q.option_c),
      jsonb_build_object('label', 'D', 'text', q.option_d),
      jsonb_build_object('label', 'E', 'text', q.option_e)
    )
  END AS options,
  CASE 
    WHEN q.question_type = 'short_answer' THEN trim(coalesce(q.short_answer, ''))
    ELSE q.correct_answer::text
  END AS answer_key,
  NULL AS explanation_html,
  CASE WHEN q.is_hidden THEN 'hidden' ELSE 'shown' END AS visibility,
  NULL AS archived_at,
  q.created_by,
  coalesce(q.created_at, now()),
  coalesce(q.created_at, now())
FROM legacy.questions q;

-- Ensure questions_id_seq continues from legacy max
SELECT setval(
  pg_get_serial_sequence('legacy.questions', 'id'),
  (SELECT max(id) FROM public.questions)
);

-- 4.4 Migrate Question Topics junction
INSERT INTO public.question_topics (question_id, topic_id)
SELECT DISTINCT
  q.id AS question_id,
  top.id AS topic_id
FROM legacy.questions q
CROSS JOIN LATERAL unnest(q.mapels) AS m(val)
CROSS JOIN LATERAL unnest(q.babs) AS b(val)
CROSS JOIN LATERAL unnest(q.sub_babs) AS sb(val)
JOIN public.subjects sub ON sub.slug = public.normalize_slug(m.val)
JOIN public.chapters ch ON ch.subject_id = sub.id AND ch.slug = public.normalize_slug(b.val)
JOIN public.topics top ON top.chapter_id = ch.id AND top.slug = public.normalize_slug(sb.val)
ON CONFLICT (question_id, topic_id) DO NOTHING;

-- 4.5 Migrate Quizzes (kuis_logs, 23 rows; 3 waiting converted to 'cancelled')
INSERT INTO public.quizzes (
  id, code, config, status, scheduled_at, started_at, paused_at, finished_at, expires_at, created_by, created_at, updated_at
)
SELECT
  k.id,
  k.quiz_code AS code,
  jsonb_build_object(
    'mapel', k.mapel,
    'bab', k.bab,
    'sub_bab', k.sub_bab,
    'question_count', k.question_count,
    'duration_minutes', k.duration_minutes,
    'quiz_mode', coalesce(k.quiz_mode, 'strict'),
    'allow_join_mid_game', k.allow_join_mid_game,
    'question_ids', k.question_ids
  ) AS config,
  CASE 
    WHEN k.status = 'waiting' THEN 'cancelled'
    ELSE k.status
  END AS status,
  k.scheduled_at,
  k.started_at,
  k.paused_at,
  k.finished_at,
  k.expires_at,
  k.created_by,
  k.created_at,
  coalesce(k.finished_at, k.started_at, k.created_at)
FROM legacy.kuis_logs k;

-- 4.6 Migrate Quiz Questions (from kuis_logs.question_ids array)
INSERT INTO public.quiz_questions (quiz_id, question_id, order_index)
SELECT 
  k.id AS quiz_id,
  q_elem.q_id AS question_id,
  (q_elem.ord - 1) AS order_index
FROM legacy.kuis_logs k,
LATERAL unnest(k.question_ids) WITH ORDINALITY AS q_elem(q_id, ord)
WHERE EXISTS (SELECT 1 FROM public.questions q WHERE q.id = q_elem.q_id)
ON CONFLICT (quiz_id, order_index) DO NOTHING;

-- 4.7 Migrate Players (61 rows)
INSERT INTO public.players (
  id, quiz_id, user_id, name, skin, score, total_time, current_index, question_order, joined_at, finished_at
)
SELECT
  p.id,
  p.kuis_id,
  p.user_id,
  p.name,
  p.horse_skin,
  p.score,
  p.total_time,
  p.current_index,
  coalesce(p.question_ids, p.shuffled_question_ids, '{}'::integer[]),
  p.joined_at,
  p.finished_at
FROM legacy.player p;

-- 4.8 Migrate Answers (kuis_results, 1716 rows)
INSERT INTO public.answers (
  id, player_id, question_id, user_answer, is_correct, time_taken, answered_at, violation_count
)
SELECT
  kr.id,
  kr.player_id,
  kr.question_id,
  kr.user_answer,
  kr.is_correct,
  kr.time_taken,
  kr.answered_at,
  kr.violation_count
FROM legacy.kuis_results kr
WHERE EXISTS (SELECT 1 FROM public.players pl WHERE pl.id = kr.player_id)
  AND EXISTS (SELECT 1 FROM public.questions q WHERE q.id = kr.question_id);

-- 4.9 Migrate Exam Sessions (from legacy.exam_logs [39 rows] + legacy.exam_results [172 rows])
-- Sesi dari exam_logs
INSERT INTO public.exam_sessions (
  id, user_id, name, mode, nav_mode, selected_categories, question_order, current_index, lives, score, status, start_time, end_time, expires_at, created_at
)
SELECT
  el.session_id AS id,
  NULL AS user_id,
  el.name,
  CASE WHEN el.mode IN ('exam', 'survival') THEN el.mode ELSE 'exam' END AS mode,
  CASE WHEN el.nav_mode IN ('strict', 'standard') THEN el.nav_mode ELSE 'strict' END AS nav_mode,
  jsonb_build_object('mapel', el.mapel, 'bab', el.bab, 'sub_bab', el.sub_bab) AS selected_categories,
  el.question_ids,
  el.current_index,
  el.lives,
  0 AS score,
  CASE 
    WHEN el.is_finished THEN 'finished'
    WHEN el.expires_at < now() THEN 'expired'
    ELSE 'active'
  END AS status,
  el.start_time,
  CASE WHEN el.is_finished THEN coalesce(el.expires_at, now()) ELSE NULL END AS end_time,
  el.expires_at,
  el.created_at
FROM legacy.exam_logs el;

-- Sesi dari exam_results (riwayat hasil masa lalu yang exam_logs-nya sudah di-purge)
INSERT INTO public.exam_sessions (
  id, user_id, name, mode, nav_mode, selected_categories, question_order, current_index, lives, score, status, start_time, end_time, expires_at, duration_seconds, created_at
)
SELECT
  gen_random_uuid() AS id,
  NULL AS user_id,
  er.name,
  CASE WHEN er.mode IN ('exam', 'survival') THEN er.mode ELSE 'exam' END AS mode,
  'strict' AS nav_mode,
  jsonb_build_object('mapel', er.mapel, 'bab', er.bab, 'sub_bab', er.sub_bab) AS selected_categories,
  '{}'::integer[] AS question_order,
  er.total_questions AS current_index,
  0 AS lives,
  er.score,
  'finished' AS status,
  coalesce(er.start_time, er.taken_at),
  coalesce(er.end_time, er.taken_at),
  coalesce(er.end_time, er.taken_at),
  er.duration_seconds,
  er.taken_at
FROM legacy.exam_results er;

--------------------------------------------------------------------------------
-- 5. Row Level Security (RLS) Configuration
--------------------------------------------------------------------------------

-- Helper functions for auth checking
CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT role FROM public.admins WHERE user_id = auth.uid() AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.check_is_active_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid() AND status = 'active' AND role = 'super_admin'
  );
$$;

-- Enable RLS on all v2 tables
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;

-- 5.1 Admins RLS
-- Active super admin has full access
CREATE POLICY super_admin_all_admins ON public.admins
  FOR ALL TO authenticated
  USING (public.check_is_super_admin())
  WITH CHECK (public.check_is_super_admin());

-- Admin can read own record
CREATE POLICY admin_read_own ON public.admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- New user can request admin registration (status MUST be pending, role MUST be admin)
CREATE POLICY user_create_signup ON public.admins
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND role = 'admin'
  );

-- 5.2 Categories RLS (subjects, chapters, topics)
-- Admins can read all (including hidden)
CREATE POLICY admin_all_subjects ON public.subjects
  FOR ALL TO authenticated
  USING (public.check_is_active_admin())
  WITH CHECK (public.check_is_active_admin());

CREATE POLICY admin_all_chapters ON public.chapters
  FOR ALL TO authenticated
  USING (public.check_is_active_admin())
  WITH CHECK (public.check_is_active_admin());

CREATE POLICY admin_all_topics ON public.topics
  FOR ALL TO authenticated
  USING (public.check_is_active_admin())
  WITH CHECK (public.check_is_active_admin());

-- Public (students/anon) can only SELECT shown categories respecting cascade (HS-07)
CREATE POLICY public_select_subjects ON public.subjects
  FOR SELECT TO anon, authenticated
  USING (visibility = 'shown');

CREATE POLICY public_select_chapters ON public.chapters
  FOR SELECT TO anon, authenticated
  USING (
    visibility = 'shown'
    AND EXISTS (
      SELECT 1 FROM public.subjects s
      WHERE s.id = chapters.subject_id AND s.visibility = 'shown'
    )
  );

CREATE POLICY public_select_topics ON public.topics
  FOR SELECT TO anon, authenticated
  USING (
    visibility = 'shown'
    AND EXISTS (
      SELECT 1 FROM public.chapters c
      JOIN public.subjects s ON s.id = c.subject_id
      WHERE c.id = topics.chapter_id
        AND c.visibility = 'shown'
        AND s.visibility = 'shown'
    )
  );

-- 5.3 Questions & question_topics RLS
-- NO public/anon/authenticated-non-admin access at all! Students MUST access via RPC!
CREATE POLICY admin_all_questions ON public.questions
  FOR ALL TO authenticated
  USING (public.check_is_active_admin())
  WITH CHECK (public.check_is_active_admin());

CREATE POLICY admin_all_question_topics ON public.question_topics
  FOR ALL TO authenticated
  USING (public.check_is_active_admin())
  WITH CHECK (public.check_is_active_admin());

-- 5.4 Quizzes & Quiz Questions RLS
-- Admins can manage all quizzes (super_admin) or own quizzes (admin)
CREATE POLICY admin_all_quizzes ON public.quizzes
  FOR ALL TO authenticated
  USING (
    public.check_is_super_admin()
    OR (public.check_is_active_admin() AND (created_by = auth.uid() OR created_by IS NULL))
  )
  WITH CHECK (
    public.check_is_super_admin()
    OR (public.check_is_active_admin() AND (created_by = auth.uid() OR created_by IS NULL))
  );

CREATE POLICY admin_all_quiz_questions ON public.quiz_questions
  FOR ALL TO authenticated
  USING (public.check_is_active_admin())
  WITH CHECK (public.check_is_active_admin());

-- Public can read active/waiting/finished quiz metadata (without secrets)
CREATE POLICY public_read_quizzes ON public.quizzes
  FOR SELECT TO anon, authenticated
  USING (status IN ('waiting', 'active', 'paused', 'finished'));

-- 5.5 Players RLS
-- Admin can view/manage all players
CREATE POLICY admin_all_players ON public.players
  FOR ALL TO authenticated
  USING (public.check_is_active_admin())
  WITH CHECK (public.check_is_active_admin());

-- Public can view players in a quiz (for leaderboard & race view)
CREATE POLICY public_select_players ON public.players
  FOR SELECT TO anon, authenticated
  USING (true);

-- 5.6 Answers RLS
-- Admin can view all answers
CREATE POLICY admin_all_answers ON public.answers
  FOR SELECT TO authenticated
  USING (public.check_is_active_admin());

-- Player can view own answers
CREATE POLICY player_select_own_answers ON public.answers
  FOR SELECT TO anon, authenticated
  USING (
    player_id IN (
      SELECT id FROM public.players WHERE user_id = auth.uid()
    )
  );

-- 5.7 Exam Sessions & Exam Answers RLS
-- Admin can read all exam sessions & answers (for /admin/hasil)
CREATE POLICY admin_select_exam_sessions ON public.exam_sessions
  FOR SELECT TO authenticated
  USING (public.check_is_active_admin());

CREATE POLICY admin_select_exam_answers ON public.exam_answers
  FOR SELECT TO authenticated
  USING (public.check_is_active_admin());

-- User can read own exam sessions
CREATE POLICY user_select_own_exam_sessions ON public.exam_sessions
  FOR SELECT TO anon, authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

CREATE POLICY user_select_own_exam_answers ON public.exam_answers
  FOR SELECT TO anon, authenticated
  USING (
    session_id IN (
      SELECT id FROM public.exam_sessions WHERE user_id IS NOT NULL AND user_id = auth.uid()
    )
  );

--------------------------------------------------------------------------------
-- 6. RPCs for Students (SECURITY DEFINER, search_path locked to 'public')
--------------------------------------------------------------------------------

-- 6.1 RPC: get_available_categories (hierarchical shown topics for self-paced setup)
CREATE OR REPLACE FUNCTION public.rpc_get_available_categories()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'slug', s.slug,
      'chapters', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'slug', c.slug,
            'topics', (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', t.id,
                  'name', t.name,
                  'slug', t.slug,
                  'question_count', (
                    SELECT count(DISTINCT q.id)
                    FROM public.question_topics qt
                    JOIN public.questions q ON q.id = qt.question_id
                    WHERE qt.topic_id = t.id
                      AND q.visibility = 'shown'
                      AND q.archived_at IS NULL
                  )
                )
              )
              FROM public.topics t
              WHERE t.chapter_id = c.id
                AND t.visibility = 'shown'
            )
          )
        )
        FROM public.chapters c
        WHERE c.subject_id = s.id
          AND c.visibility = 'shown'
      )
    )
  ) INTO v_result
  FROM public.subjects s
  WHERE s.visibility = 'shown';

  RETURN coalesce(v_result, '[]'::jsonb);
END;
$$;

-- 6.2 RPC: join_live_quiz
CREATE OR REPLACE FUNCTION public.rpc_join_live_quiz(
  p_quiz_code text,
  p_name text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_quiz record;
  v_player_id uuid;
  v_base_q_ids integer[];
  v_shuffled_ids integer[];
  v_skin text;
  v_clean_name text;
  v_skins text[] := ARRAY['ember', 'storm', 'dune', 'forest', 'aurora', 'midnight', 'rose', 'glacier'];
BEGIN
  v_clean_name := trim(p_name);
  IF length(v_clean_name) = 0 OR length(v_clean_name) > 24 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama harus 1-24 karakter');
  END IF;

  SELECT id, status, config INTO v_quiz
  FROM public.quizzes
  WHERE code = trim(p_quiz_code);

  IF v_quiz.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kuis tidak ditemukan');
  END IF;

  IF v_quiz.status = 'finished' OR v_quiz.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kuis sudah berakhir');
  END IF;

  IF v_quiz.status = 'active' AND NOT coalesce((v_quiz.config->>'allow_join_mid_game')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kuis sedang berjalan dan tidak mengizinkan gabung di tengah permainan');
  END IF;

  -- Get question pool from quiz_questions snapshot
  SELECT array_agg(question_id ORDER BY order_index) INTO v_base_q_ids
  FROM public.quiz_questions
  WHERE quiz_id = v_quiz.id;

  IF v_base_q_ids IS NULL OR array_length(v_base_q_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kuis belum memiliki soal');
  END IF;

  -- Shuffle questions per player
  SELECT array_agg(v ORDER BY random()) INTO v_shuffled_ids
  FROM unnest(v_base_q_ids) g(v);

  -- Pick unused skin if possible
  SELECT s INTO v_skin
  FROM unnest(v_skins) s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.players p WHERE p.quiz_id = v_quiz.id AND p.skin = s
  )
  ORDER BY random() LIMIT 1;

  IF v_skin IS NULL THEN
    v_skin := v_skins[1 + floor(random() * array_length(v_skins, 1))::int];
  END IF;

  -- Upsert player
  INSERT INTO public.players (quiz_id, user_id, name, skin, question_order)
  VALUES (v_quiz.id, auth.uid(), v_clean_name, v_skin, v_shuffled_ids)
  ON CONFLICT (quiz_id, name) DO UPDATE SET
    joined_at = now(),
    user_id = coalesce(excluded.user_id, players.user_id),
    skin = coalesce(players.skin, excluded.skin),
    question_order = coalesce(players.question_order, excluded.question_order)
  RETURNING id, skin INTO v_player_id, v_skin;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_player_id,
    'quiz_id', v_quiz.id,
    'name', v_clean_name,
    'skin', v_skin,
    'question_count', array_length(v_shuffled_ids, 1)
  );
END;
$$;

-- 6.3 RPC: set_player_skin
CREATE OR REPLACE FUNCTION public.rpc_set_player_skin(
  p_player_id uuid,
  p_skin text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_player record;
  v_quiz_status text;
  v_parts text[];
  v_mount text;
  v_clean_skin text;
  v_valid_mounts text[] := ARRAY['horse','angsa','citah','dino','kalkun','kebo','llama','macan','mamot','sapi','udang','ulat'];
  v_presets text[] := ARRAY['ember', 'storm', 'dune', 'forest', 'aurora', 'midnight', 'rose', 'glacier'];
BEGIN
  SELECT p.*, q.status AS quiz_status INTO v_player
  FROM public.players p
  JOIN public.quizzes q ON q.id = p.quiz_id
  WHERE p.id = p_player_id;

  IF v_player.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pemain tidak ditemukan');
  END IF;

  -- Ownership: anon session matches user_id or admin
  IF (v_player.user_id IS NOT NULL AND v_player.user_id IS DISTINCT FROM auth.uid()) AND NOT public.check_is_active_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tidak berwenang');
  END IF;

  IF v_player.quiz_status <> 'waiting' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Skin hanya bisa diubah saat ruang tunggu');
  END IF;

  v_clean_skin := trim(p_skin);
  IF v_clean_skin LIKE 'custom:%' THEN
    v_parts := string_to_array(v_clean_skin, ':');
    IF array_length(v_parts, 1) NOT IN (4, 5) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Format custom skin tidak valid');
    END IF;
    IF v_parts[2] !~ '^#[0-9a-fA-F]{6}$'
       OR v_parts[3] !~ '^#[0-9a-fA-F]{6}$'
       OR v_parts[4] !~ '^#[0-9a-fA-F]{6}$' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Warna hex tidak valid');
    END IF;

    IF array_length(v_parts, 1) = 5 THEN
      v_mount := v_parts[5];
      IF NOT (v_mount = ANY(v_valid_mounts)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Hewan tunggangan tidak dikenal');
      END IF;
    ELSE
      v_mount := 'horse';
    END IF;
    v_clean_skin := 'custom:' || lower(v_parts[2]) || ':' || lower(v_parts[3]) || ':' || lower(v_parts[4]) || ':' || v_mount;
  ELSE
    IF NOT (v_clean_skin = ANY(v_presets)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Preset skin tidak valid');
    END IF;
  END IF;

  UPDATE public.players SET skin = v_clean_skin WHERE id = p_player_id;
  RETURN jsonb_build_object('success', true, 'skin', v_clean_skin);
END;
$$;

-- 6.4 RPC: get_quiz_question (payload WITHOUT answer_key!)
CREATE OR REPLACE FUNCTION public.rpc_get_quiz_question(
  p_player_id uuid,
  p_index integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_player record;
  v_quiz record;
  v_q_id integer;
  v_q record;
BEGIN
  SELECT * INTO v_player FROM public.players WHERE id = p_player_id;
  IF v_player.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pemain tidak ditemukan');
  END IF;

  SELECT * INTO v_quiz FROM public.quizzes WHERE id = v_player.quiz_id;
  IF v_quiz.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kuis tidak aktif');
  END IF;

  IF p_index < 0 OR p_index >= array_length(v_player.question_order, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indeks soal tidak valid');
  END IF;

  v_q_id := v_player.question_order[p_index + 1];

  SELECT id, type, body_html, options INTO v_q
  FROM public.questions
  WHERE id = v_q_id;

  IF v_q.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Soal tidak ditemukan');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'id', v_q.id,
      'type', v_q.type,
      'body_html', v_q.body_html,
      'options', v_q.options,
      'index', p_index,
      'total', array_length(v_player.question_order, 1)
    )
  );
END;
$$;

-- 6.5 RPC: submit_quiz_answer (server-side grading, strict/standard flow lock)
CREATE OR REPLACE FUNCTION public.rpc_submit_quiz_answer(
  p_player_id uuid,
  p_index integer,
  p_question_id integer,
  p_user_answer text,
  p_time_taken integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_player record;
  v_quiz record;
  v_mode text;
  v_expected_q_id integer;
  v_correct_answer text;
  v_q_type text;
  v_is_correct boolean := false;
  v_clean_user text;
  v_clean_key text;
  v_existing record;
BEGIN
  SELECT * INTO v_player FROM public.players WHERE id = p_player_id;
  IF v_player.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pemain tidak ditemukan');
  END IF;

  SELECT * INTO v_quiz FROM public.quizzes WHERE id = v_player.quiz_id;
  IF v_quiz.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kuis tidak aktif');
  END IF;

  v_mode := coalesce(v_quiz.config->>'quiz_mode', 'strict');

  IF p_index < 0 OR p_index >= array_length(v_player.question_order, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indeks soal tidak valid');
  END IF;

  v_expected_q_id := v_player.question_order[p_index + 1];
  IF v_expected_q_id <> p_question_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Soal tidak cocok dengan urutan pemain');
  END IF;

  IF v_mode = 'strict' AND p_index <> v_player.current_index THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mode strict: soal harus dijawab berurutan');
  END IF;

  -- Grade against questions table
  SELECT type, answer_key INTO v_q_type, v_correct_answer
  FROM public.questions WHERE id = p_question_id;

  IF v_q_type = 'short_answer' THEN
    v_clean_user := regexp_replace(lower(public.strip_html(coalesce(p_user_answer, ''))), '\s+', '', 'g');
    v_clean_key := regexp_replace(lower(public.strip_html(coalesce(v_correct_answer, ''))), '\s+', '', 'g');
    v_is_correct := (v_clean_user <> '' AND v_clean_user = v_clean_key);
  ELSE
    v_is_correct := (upper(trim(coalesce(p_user_answer, ''))) = upper(trim(coalesce(v_correct_answer, ''))));
  END IF;

  -- Check existing answer (for standard mode re-answering)
  SELECT * INTO v_existing FROM public.answers WHERE player_id = p_player_id AND question_id = p_question_id;

  IF v_existing.id IS NOT NULL THEN
    IF v_mode = 'strict' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Soal sudah dijawab');
    END IF;

    -- Update answer & adjust player score
    UPDATE public.answers
    SET user_answer = p_user_answer,
        is_correct = v_is_correct,
        time_taken = p_time_taken,
        answered_at = now()
    WHERE id = v_existing.id;

    UPDATE public.players
    SET score = score - (CASE WHEN v_existing.is_correct THEN 1 ELSE 0 END) + (CASE WHEN v_is_correct THEN 1 ELSE 0 END),
        total_time = total_time + p_time_taken
    WHERE id = p_player_id;
  ELSE
    INSERT INTO public.answers (player_id, question_id, user_answer, is_correct, time_taken)
    VALUES (p_player_id, p_question_id, p_user_answer, v_is_correct, p_time_taken);

    UPDATE public.players
    SET score = score + (CASE WHEN v_is_correct THEN 1 ELSE 0 END),
        total_time = total_time + p_time_taken,
        current_index = CASE WHEN v_mode = 'strict' THEN current_index + 1 ELSE GREATEST(current_index, p_index + 1) END
    WHERE id = p_player_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'is_correct', v_is_correct);
END;
$$;

-- 6.6 RPC: finish_quiz_player
CREATE OR REPLACE FUNCTION public.rpc_finish_quiz_player(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.players
  SET finished_at = now()
  WHERE id = p_player_id AND finished_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6.7 RPC: start_exam_session (self-paced: exam / survival)
CREATE OR REPLACE FUNCTION public.rpc_start_exam_session(
  p_name text,
  p_topic_ids uuid[],
  p_mode text DEFAULT 'exam',
  p_nav_mode text DEFAULT 'strict',
  p_count integer DEFAULT 20,
  p_time_limit_minutes integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clean_name text;
  v_session_id uuid;
  v_question_ids integer[];
  v_actual_count integer;
  v_expires_at timestamptz;
BEGIN
  v_clean_name := trim(p_name);
  IF length(v_clean_name) = 0 OR length(v_clean_name) > 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama harus 1-16 karakter');
  END IF;

  IF p_mode NOT IN ('exam', 'survival') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mode tidak valid');
  END IF;

  IF p_nav_mode NOT IN ('strict', 'standard') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nav mode tidak valid');
  END IF;

  -- Filter shown questions under shown topics only (respects cascade!)
  SELECT array_agg(sq.id) INTO v_question_ids
  FROM (
    SELECT q.id
    FROM public.questions q
    WHERE q.visibility = 'shown'
      AND q.archived_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.question_topics qt
        JOIN public.topics t ON t.id = qt.topic_id
        JOIN public.chapters c ON c.id = t.chapter_id
        JOIN public.subjects s ON s.id = c.subject_id
        WHERE qt.question_id = q.id
          AND t.visibility = 'shown'
          AND c.visibility = 'shown'
          AND s.visibility = 'shown'
          AND (p_topic_ids IS NULL OR array_length(p_topic_ids, 1) = 0 OR t.id = ANY(p_topic_ids))
      )
    ORDER BY random()
    LIMIT (CASE WHEN p_mode = 'survival' THEN 200 ELSE p_count END)
  ) sq;

  v_actual_count := coalesce(array_length(v_question_ids, 1), 0);
  IF v_actual_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tidak ada soal tersedia untuk topik terpilih');
  END IF;

  IF p_time_limit_minutes IS NOT NULL AND p_time_limit_minutes > 0 THEN
    v_expires_at := now() + (p_time_limit_minutes || ' minutes')::interval;
  ELSE
    v_expires_at := now() + interval '2 days';
  END IF;

  INSERT INTO public.exam_sessions (
    user_id, name, mode, nav_mode, selected_categories, question_order, lives, expires_at
  ) VALUES (
    auth.uid(),
    v_clean_name,
    p_mode,
    (CASE WHEN p_mode = 'survival' THEN 'strict' ELSE p_nav_mode END),
    jsonb_build_object('topic_ids', p_topic_ids),
    v_question_ids,
    (CASE WHEN p_mode = 'survival' THEN 3 ELSE 0 END),
    v_expires_at
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'question_count', (CASE WHEN p_mode = 'survival' THEN v_actual_count ELSE LEAST(v_actual_count, p_count) END),
    'mode', p_mode,
    'nav_mode', (CASE WHEN p_mode = 'survival' THEN 'strict' ELSE p_nav_mode END),
    'expires_at', v_expires_at
  );
END;
$$;

-- 6.8 RPC: get_exam_question (payload WITHOUT answer_key!)
CREATE OR REPLACE FUNCTION public.rpc_get_exam_question(
  p_session_id uuid,
  p_index integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session record;
  v_q_id integer;
  v_q record;
BEGIN
  SELECT * INTO v_session FROM public.exam_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesi ujian tidak ditemukan');
  END IF;

  IF v_session.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesi ujian sudah berakhir');
  END IF;

  IF v_session.expires_at < now() THEN
    UPDATE public.exam_sessions SET status = 'expired' WHERE id = p_session_id;
    RETURN jsonb_build_object('success', false, 'error', 'Waktu ujian telah habis');
  END IF;

  IF p_index < 0 OR p_index >= array_length(v_session.question_order, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indeks soal tidak valid');
  END IF;

  v_q_id := v_session.question_order[p_index + 1];

  SELECT id, type, body_html, options INTO v_q
  FROM public.questions WHERE id = v_q_id;

  IF v_q.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Soal tidak ditemukan');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'id', v_q.id,
      'type', v_q.type,
      'body_html', v_q.body_html,
      'options', v_q.options,
      'index', p_index,
      'total', array_length(v_session.question_order, 1),
      'lives', v_session.lives
    )
  );
END;
$$;

-- 6.9 RPC: save_exam_answer (stores answer, calculates score/lives)
CREATE OR REPLACE FUNCTION public.rpc_save_exam_answer(
  p_session_id uuid,
  p_index integer,
  p_user_answer text,
  p_is_doubtful boolean DEFAULT false,
  p_time_taken integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session record;
  v_q_id integer;
  v_q_type text;
  v_correct_answer text;
  v_is_correct boolean := false;
  v_clean_user text;
  v_clean_key text;
  v_existing record;
  v_new_lives integer;
BEGIN
  SELECT * INTO v_session FROM public.exam_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesi tidak ditemukan');
  END IF;

  IF v_session.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesi sudah selesai');
  END IF;

  IF v_session.expires_at < now() THEN
    UPDATE public.exam_sessions SET status = 'expired' WHERE id = p_session_id;
    RETURN jsonb_build_object('success', false, 'error', 'Waktu habis');
  END IF;

  IF p_index < 0 OR p_index >= array_length(v_session.question_order, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indeks tidak valid');
  END IF;

  v_q_id := v_session.question_order[p_index + 1];

  -- Grade answer
  SELECT type, answer_key INTO v_q_type, v_correct_answer
  FROM public.questions WHERE id = v_q_id;

  IF p_user_answer IS NOT NULL AND trim(p_user_answer) <> '' AND trim(p_user_answer) <> 'skipped' THEN
    IF v_q_type = 'short_answer' THEN
      v_clean_user := regexp_replace(lower(public.strip_html(p_user_answer)), '\s+', '', 'g');
      v_clean_key := regexp_replace(lower(public.strip_html(v_correct_answer)), '\s+', '', 'g');
      v_is_correct := (v_clean_user = v_clean_key);
    ELSE
      v_is_correct := (upper(trim(p_user_answer)) = upper(trim(v_correct_answer)));
    END IF;
  ELSE
    v_is_correct := false;
  END IF;

  SELECT * INTO v_existing FROM public.exam_answers WHERE session_id = p_session_id AND order_index = p_index;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.exam_answers
    SET user_answer = p_user_answer,
        is_marked_doubtful = p_is_doubtful,
        is_correct = v_is_correct,
        time_taken = time_taken + p_time_taken,
        answered_at = now()
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.exam_answers (
      session_id, order_index, question_id, user_answer, is_marked_doubtful, is_correct, time_taken
    ) VALUES (
      p_session_id, p_index, v_q_id, p_user_answer, p_is_doubtful, v_is_correct, p_time_taken
    );
  END IF;

  -- Survival mode handling
  v_new_lives := v_session.lives;
  IF v_session.mode = 'survival' THEN
    IF NOT v_is_correct THEN
      v_new_lives := GREATEST(0, v_session.lives - 1);
      UPDATE public.exam_sessions SET lives = v_new_lives WHERE id = p_session_id;
      IF v_new_lives = 0 THEN
        UPDATE public.exam_sessions SET status = 'finished', end_time = now() WHERE id = p_session_id;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'is_correct', v_is_correct,
      'lives', v_new_lives,
      'game_over', (v_new_lives = 0)
    );
  END IF;

  UPDATE public.exam_sessions
  SET current_index = GREATEST(current_index, p_index)
  WHERE id = p_session_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6.10 RPC: submit_exam_session (finalizes session and calculates total score)
CREATE OR REPLACE FUNCTION public.rpc_submit_exam_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session record;
  v_score integer;
  v_total integer;
  v_duration integer;
BEGIN
  SELECT * INTO v_session FROM public.exam_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesi tidak ditemukan');
  END IF;

  SELECT count(*) FILTER (WHERE is_correct = true) INTO v_score
  FROM public.exam_answers
  WHERE session_id = p_session_id;

  v_total := array_length(v_session.question_order, 1);
  v_duration := EXTRACT(EPOCH FROM (now() - v_session.start_time))::integer;

  UPDATE public.exam_sessions
  SET status = 'finished',
      score = coalesce(v_score, 0),
      end_time = now(),
      duration_seconds = v_duration
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'score', coalesce(v_score, 0),
    'total', v_total,
    'duration_seconds', v_duration
  );
END;
$$;

-- 6.11 RPC: get_exam_recap (RECAP WITH ANSWER KEYS: ONLY FOR FINISHED SESSIONS BELONGING TO USER OR ADMIN!)
CREATE OR REPLACE FUNCTION public.rpc_get_exam_recap(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session record;
  v_recap jsonb;
BEGIN
  SELECT * INTO v_session FROM public.exam_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesi tidak ditemukan');
  END IF;

  -- CRITICAL SECURITY GATE: Session must be FINISHED!
  IF v_session.status <> 'finished' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kunci jawaban hanya dapat dilihat setelah ujian selesai');
  END IF;

  -- CRITICAL SECURITY GATE: Must belong to caller or caller is active admin!
  IF v_session.user_id IS NOT NULL AND v_session.user_id IS DISTINCT FROM auth.uid() AND NOT public.check_is_active_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tidak berwenang melihat rekap sesi ini');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'order_index', ea.order_index,
      'question_id', q.id,
      'question_text', q.body_html,
      'options', q.options,
      'type', q.type,
      'user_answer', ea.user_answer,
      'answer_key', q.answer_key,
      'explanation_html', q.explanation_html,
      'is_correct', ea.is_correct,
      'is_marked_doubtful', ea.is_marked_doubtful,
      'time_taken', ea.time_taken
    ) ORDER BY ea.order_index
  ) INTO v_recap
  FROM public.exam_answers ea
  JOIN public.questions q ON q.id = ea.question_id
  WHERE ea.session_id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session.id,
    'name', v_session.name,
    'mode', v_session.mode,
    'score', v_session.score,
    'total_questions', array_length(v_session.question_order, 1),
    'duration_seconds', v_session.duration_seconds,
    'recap', coalesce(v_recap, '[]'::jsonb)
  );
END;
$$;

COMMIT;
