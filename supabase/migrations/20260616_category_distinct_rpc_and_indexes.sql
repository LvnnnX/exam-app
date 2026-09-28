-- Migration: distinct-category RPCs + supporting indexes
-- Purpose: replace full-table scans (SELECT mapels,babs / babs,sub_babs then
--          dedupe in JS) with server-side DISTINCT unnest, and add GIN/btree
--          indexes so overlaps()/contains() filters and created_at sort are
--          index-backed. Targets admin question/quiz/scheduled forms at ~600+
--          questions where the JS-side dedupe scan is the bottleneck.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- GIN indexes back the PostgREST .overlaps() / .contains() array filters used
-- by fetchQuestionsPaginatedAction and the distinct RPCs below.
CREATE INDEX IF NOT EXISTS idx_questions_mapels_gin   ON public.questions USING gin (mapels);
CREATE INDEX IF NOT EXISTS idx_questions_babs_gin      ON public.questions USING gin (babs);
CREATE INDEX IF NOT EXISTS idx_questions_sub_babs_gin  ON public.questions USING gin (sub_babs);

-- btree index backs the created_at sort used by paginated fetch.
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions (created_at DESC);

-- ---------------------------------------------------------------------------
-- get_distinct_babs(p_mapels)
--   Returns distinct, sorted bab values across questions whose mapels overlap
--   p_mapels. NULL / empty p_mapels => all babs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_distinct_babs(p_mapels text[] DEFAULT NULL)
RETURNS TABLE (value text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT DISTINCT bab AS value
  FROM public.questions q,
       LATERAL unnest(q.babs) AS bab
  WHERE bab IS NOT NULL AND bab <> ''
    AND (
      p_mapels IS NULL
      OR array_length(p_mapels, 1) IS NULL
      OR q.mapels && p_mapels
    )
  ORDER BY value;
$fn$;

-- ---------------------------------------------------------------------------
-- get_distinct_sub_babs(p_babs)
--   Returns distinct, sorted sub_bab values across questions whose babs overlap
--   p_babs. NULL / empty p_babs => all sub_babs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_distinct_sub_babs(p_babs text[] DEFAULT NULL)
RETURNS TABLE (value text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT DISTINCT sub_bab AS value
  FROM public.questions q,
       LATERAL unnest(q.sub_babs) AS sub_bab
  WHERE sub_bab IS NOT NULL AND sub_bab <> ''
    AND (
      p_babs IS NULL
      OR array_length(p_babs, 1) IS NULL
      OR q.babs && p_babs
    )
  ORDER BY value;
$fn$;

-- ---------------------------------------------------------------------------
-- get_distinct_mapels()
--   Returns distinct, sorted mapel values across all questions.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_distinct_mapels()
RETURNS TABLE (value text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT DISTINCT mapel AS value
  FROM public.questions q,
       LATERAL unnest(q.mapels) AS mapel
  WHERE mapel IS NOT NULL AND mapel <> ''
  ORDER BY value;
$fn$;

-- Allow the same roles that can currently SELECT questions to call the RPCs.
GRANT EXECUTE ON FUNCTION public.get_distinct_babs(text[])      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_sub_babs(text[])  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_mapels()          TO anon, authenticated;
