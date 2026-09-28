-- 1. Fix data types: question_ids must be integer[] to match exam_logs
ALTER TABLE scheduled_exam_attempts 
ADD COLUMN question_ids integer[] DEFAULT '{}',
ADD COLUMN user_answers jsonb DEFAULT '{}';

-- 2. Populate data
UPDATE scheduled_exam_attempts sea
SET 
  question_ids = el.question_ids,
  user_answers = el.user_answers
FROM exam_logs el
WHERE el.session_id = sea.session_id 
   OR (el.name = sea.student_name AND el.start_time = sea.started_at);
