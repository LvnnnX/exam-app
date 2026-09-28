-- HOTFIX: scheduled_exam_attempts.recap column missing in production.
--
-- Root cause: migration 20260616_finalize_scheduled_exam.sql declared
-- "ALTER TABLE scheduled_exam_attempts ADD COLUMN IF NOT EXISTS recap jsonb"
-- but was never applied to the production database. submit_session_exam RPC
-- (and others) reference this column when atomically sealing scheduled-exam
-- attempts → all exam/survival/scheduled submissions failed since 2026-06-16
-- with: column "recap" of relation "scheduled_exam_attempts" does not exist
-- (SQLSTATE 42703).
--
-- Last successful exam_results insert: 2026-06-16 09:44:41 UTC.
-- Detected: 2026-06-17 10:27 UTC during user-reported "gagal menyimpan".
-- Applied to production: 2026-06-17 10:28 UTC.
-- Verified: anon RPC test returned HTTP 200 with valid recap payload.

ALTER TABLE public.scheduled_exam_attempts
  ADD COLUMN IF NOT EXISTS recap jsonb;
