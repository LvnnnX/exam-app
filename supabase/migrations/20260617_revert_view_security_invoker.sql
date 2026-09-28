-- Revert security_invoker on student-facing public_* views.
--
-- Earlier same-day fix (BUG-RLS2) toggled security_invoker=true on these views,
-- intending to enforce RLS as the calling role. But the actual exploit was
-- ALL/INSERT/UPDATE/DELETE grants on the views (granted to PUBLIC by default).
-- REVOKE ALL + GRANT SELECT alone is sufficient because PostgREST checks
-- privileges on the VIEW — not on the underlying table.
--
-- Setting security_invoker=true was over-engineering: it forced anon to need
-- BASE-TABLE grants on `questions` and `kuis_logs`, which they don't have,
-- breaking legitimate student SELECT through the views.
--
-- Verified after revert:
--   - anon SELECT public_kuis_logs → HTTP 200 ✅
--   - anon UPDATE public_kuis_logs → HTTP 400 (blocked) ✅
--   - anon SELECT public_categories → HTTP 200 ✅
--   - tests/rls.spec.ts all 7 tests pass ✅

ALTER VIEW public.public_categories       SET (security_invoker = false);
ALTER VIEW public.public_kuis_logs        SET (security_invoker = false);
ALTER VIEW public.public_players          SET (security_invoker = false);
ALTER VIEW public.public_questions        SET (security_invoker = false);
ALTER VIEW public.public_scheduled_exams  SET (security_invoker = false);
