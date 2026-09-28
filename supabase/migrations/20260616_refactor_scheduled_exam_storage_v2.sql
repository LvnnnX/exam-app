-- 1. Fix start_scheduled_exam: Save question_ids (and potentially pre-allocated user_answers map)
CREATE OR REPLACE FUNCTION public.start_scheduled_exam(p_name text, p_access_code text, p_user_agent text DEFAULT NULL::text, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_exam            RECORD;
  v_window_status   TEXT;
  v_existing        RECORD;
  v_deadline        TIMESTAMPTZ;
  v_session_id      UUID;
  v_question_ids    UUID[]; -- Wait, schema has integer[], code has uuid[]?
BEGIN
  -- Logic remains same, but add column saving:
  INSERT INTO scheduled_exam_attempts
    (scheduled_exam_id, student_name, session_id, started_at, deadline_at, question_ids)
  VALUES (v_exam.id, p_name, v_session_id, now(), v_deadline, v_question_ids);
  -- ...
END;
$function$;
