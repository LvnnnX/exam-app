-- Fase 4: Race view.
-- 1. rpc_set_player_skin: accept "preset:mount" (the format rpc_join_live_quiz assigns and
--    MountPickerModal sends). Phase 1 only accepted a bare preset, so every picker save failed.
-- 2. Drop public_select_players: anon/authenticated could SELECT players.score straight from
--    PostgREST, leaking hidden scores in standard mode (and question_order). All app reads go
--    through the server route (service role) which masks scores for non-admin viewers.

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

  IF (v_player.user_id IS NOT NULL AND v_player.user_id IS DISTINCT FROM auth.uid()) AND NOT public.check_is_active_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tidak berwenang');
  END IF;

  IF v_player.quiz_status <> 'waiting' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Skin hanya bisa diubah saat ruang tunggu');
  END IF;

  v_clean_skin := trim(coalesce(p_skin, ''));
  IF length(v_clean_skin) = 0 OR length(v_clean_skin) > 64 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Format skin tidak valid');
  END IF;
  v_parts := string_to_array(v_clean_skin, ':');

  IF v_parts[1] = 'custom' THEN
    IF array_length(v_parts, 1) NOT IN (4, 5) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Format custom skin tidak valid');
    END IF;
    IF v_parts[2] !~ '^#[0-9a-fA-F]{6}$'
       OR v_parts[3] !~ '^#[0-9a-fA-F]{6}$'
       OR v_parts[4] !~ '^#[0-9a-fA-F]{6}$' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Warna hex tidak valid');
    END IF;
    v_mount := coalesce(v_parts[5], 'horse');
    IF NOT (v_mount = ANY(v_valid_mounts)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Hewan tunggangan tidak dikenal');
    END IF;
    v_clean_skin := 'custom:' || lower(v_parts[2]) || ':' || lower(v_parts[3]) || ':' || lower(v_parts[4]) || ':' || v_mount;
  ELSE
    IF array_length(v_parts, 1) NOT IN (1, 2) OR NOT (v_parts[1] = ANY(v_presets)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Preset skin tidak valid');
    END IF;
    v_mount := coalesce(v_parts[2], 'horse');
    IF NOT (v_mount = ANY(v_valid_mounts)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Hewan tunggangan tidak dikenal');
    END IF;
    v_clean_skin := v_parts[1] || ':' || v_mount;
  END IF;

  UPDATE public.players SET skin = v_clean_skin WHERE id = p_player_id;
  RETURN jsonb_build_object('success', true, 'skin', v_clean_skin);
END;
$$;

DROP POLICY IF EXISTS public_select_players ON public.players;

-- 3. Admin quiz RPCs: the in-function guard "auth.uid() IS NOT NULL AND NOT admin" lets anon
--    (uid NULL) through, so anon could start/finish any quiz via PostgREST and reveal hidden
--    scores. Only the server (service_role, after requireActiveAdmin) may call them.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('rpc_create_quiz', 'rpc_admin_update_quiz_status')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;
