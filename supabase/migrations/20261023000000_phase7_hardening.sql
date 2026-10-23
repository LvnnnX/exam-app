-- Fase 7: hardening bucket exam-images (BS-07). Idempotent, aman untuk prod.
-- Prod (backup 2026-10-22): bucket public = true, tanpa limit/MIME; 4 policy storage
-- ("Public Read Access", exam_images_staff_insert/update/delete). Diganti di sini dengan versi
-- yang terikat ke bucket exam-images dan ke admin aktif (public.check_is_active_admin dari phase1).
-- RLS storage.objects sudah aktif bawaan Supabase dan tabelnya milik supabase_storage_admin,
-- jadi migrasi ini sengaja tidak ALTER TABLE.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exam-images', 'exam-images', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS exam_images_staff_insert ON storage.objects;
DROP POLICY IF EXISTS exam_images_staff_update ON storage.objects;
DROP POLICY IF EXISTS exam_images_staff_delete ON storage.objects;
DROP POLICY IF EXISTS exam_images_public_read ON storage.objects;
DROP POLICY IF EXISTS exam_images_admin_insert ON storage.objects;
DROP POLICY IF EXISTS exam_images_admin_update ON storage.objects;
DROP POLICY IF EXISTS exam_images_admin_delete ON storage.objects;

CREATE POLICY exam_images_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'exam-images');

CREATE POLICY exam_images_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exam-images' AND public.check_is_active_admin());

CREATE POLICY exam_images_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'exam-images' AND public.check_is_active_admin())
  WITH CHECK (bucket_id = 'exam-images' AND public.check_is_active_admin());

CREATE POLICY exam_images_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'exam-images' AND public.check_is_active_admin());

-- Revoke public access from legacy unhardened functions
REVOKE EXECUTE ON FUNCTION public.finish_player_quiz_rpc(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_live_quiz_question(text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_server_time() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_session_question(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_session_state(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.join_live_quiz(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_player_horse_skin(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_live_quiz_answer_v2(text, integer, text, integer, integer, text) FROM PUBLIC, anon, authenticated;

