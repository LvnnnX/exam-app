-- 1. Add recap JSONB column to scheduled_exam_attempts
ALTER TABLE public.scheduled_exam_attempts
  ADD COLUMN IF NOT EXISTS recap jsonb;

-- 2. finalize_scheduled_exam_attempt: stamp submitted_at + score + recap
-- Called client-side after submit_session_exam succeeds for a scheduled exam.
CREATE OR REPLACE FUNCTION public.finalize_scheduled_exam_attempt(
  p_session_id uuid,
  p_score integer,
  p_recap jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  UPDATE scheduled_exam_attempts
  SET submitted_at = now(),
      score = p_score,
      recap = p_recap
  WHERE session_id = p_session_id
    AND submitted_at IS NULL;
END;
$fn$;

-- 3. get_scheduled_exam_recap: fetch recap + score for a finished attempt
-- Used on page refresh when exam_logs row was deleted but attempt has recap.
CREATE OR REPLACE FUNCTION public.get_scheduled_exam_recap(
  p_session_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  v_recap  jsonb;
  v_score  integer;
  v_total  integer;
  v_name   text;
  v_started timestamptz;
  v_submitted timestamptz;
BEGIN
  SELECT sea.recap, sea.score, se.question_count,
         sea.student_name, sea.started_at, sea.submitted_at
  INTO v_recap, v_score, v_total, v_name, v_started, v_submitted
  FROM scheduled_exam_attempts sea
  JOIN scheduled_exams se ON se.id = sea.scheduled_exam_id
  WHERE sea.session_id = p_session_id
    AND sea.submitted_at IS NOT NULL;

  IF v_recap IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'recap', v_recap,
    'score', COALESCE(v_score, 0),
    'total', COALESCE(v_total, 0),
    'name', v_name,
    'started_at', v_started,
    'submitted_at', v_submitted
  );
END;
$fn$;
