-- Migration: resolve start_exam_session overload ambiguity
-- Problem: the public start_exam_session caller (app/actions/exam.ts) invokes the
--   function with 9 named args (p_name, p_mapels, p_babs, p_sub_babs, p_mode,
--   p_count, p_time_limit_minutes, p_user_agent, p_secret). After
--   20260615_scheduled_exam_nav_mode_percentages added an 11-arg overload whose
--   last two params (p_sub_bab_percentages, p_nav_mode) default to NULL, BOTH
--   the 9-arg overload (exact match) and the 11-arg overload (9 supplied + 2
--   defaulted) match that call. PostgREST/Postgres then raise
--   "function start_exam_session(...) is not unique", which surfaced to exam
--   takers as "Failed to start exam session".
-- Fix: drop the now-redundant 9-arg overload. The 11-arg overload is a strict
--   superset; the 9 named args resolve unambiguously to it, and the two extra
--   params default to NULL (nav_mode NULL, percentages NULL) -> identical
--   behaviour to the old 9-arg path.

DROP FUNCTION IF EXISTS public.start_exam_session(
  text, text[], text[], text[], text, integer, integer, text, text
);
