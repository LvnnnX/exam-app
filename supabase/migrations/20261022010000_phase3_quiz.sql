-- Phase 3: Live Quiz RPCs and helpers

-- 1. Helper function: Generate unique 6-digit numeric quiz code
CREATE OR REPLACE FUNCTION public.fn_generate_quiz_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    -- Generate random 6-digit number between 100000 and 999999
    v_code := lpad(floor(random() * 900000 + 100000)::text, 6, '0');
    
    SELECT EXISTS (
      SELECT 1 FROM public.quizzes
      WHERE code = v_code AND status IN ('waiting', 'active', 'paused')
    ) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- 2. RPC: rpc_create_quiz
CREATE OR REPLACE FUNCTION public.rpc_create_quiz(
  p_topic_ids uuid[],
  p_question_count integer,
  p_duration_minutes integer,
  p_quiz_mode text DEFAULT 'strict',
  p_allow_mid_game boolean DEFAULT false,
  p_weights jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_code text;
  v_quiz_id uuid;
  v_available_q_ids integer[];
  v_selected_q_ids integer[];
  v_available_count integer;
  v_q_id integer;
  v_idx integer := 0;
  v_tid uuid;
  v_pct numeric;
  v_target_count integer;
  v_curr_count integer;
  v_topic_q_ids integer[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL AND NOT public.check_is_active_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hanya admin aktif yang dapat membuat sesi kuis');
  END IF;

  IF p_question_count <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Jumlah soal harus lebih dari 0');
  END IF;

  IF p_duration_minutes <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Durasi kuis harus lebih dari 0 menit');
  END IF;

  IF p_quiz_mode NOT IN ('strict', 'standard') THEN
    p_quiz_mode := 'strict';
  END IF;

  -- 1. Gather pool of shown questions under shown categories (respecting cascade!)
  IF p_topic_ids IS NULL OR coalesce(array_length(p_topic_ids, 1), 0) = 0 THEN
    -- All available shown questions
    SELECT array_agg(DISTINCT q.id) INTO v_available_q_ids
    FROM public.questions q
    JOIN public.question_topics qt ON qt.question_id = q.id
    JOIN public.topics t ON t.id = qt.topic_id
    JOIN public.chapters c ON c.id = t.chapter_id
    JOIN public.subjects s ON s.id = c.subject_id
    WHERE q.visibility = 'shown'
      AND q.archived_at IS NULL
      AND t.visibility = 'shown'
      AND c.visibility = 'shown'
      AND s.visibility = 'shown';
  ELSE
    SELECT array_agg(DISTINCT q.id) INTO v_available_q_ids
    FROM public.questions q
    JOIN public.question_topics qt ON qt.question_id = q.id
    JOIN public.topics t ON t.id = qt.topic_id
    JOIN public.chapters c ON c.id = t.chapter_id
    JOIN public.subjects s ON s.id = c.subject_id
    WHERE q.visibility = 'shown'
      AND q.archived_at IS NULL
      AND t.visibility = 'shown'
      AND c.visibility = 'shown'
      AND s.visibility = 'shown'
      AND t.id = ANY(p_topic_ids);
  END IF;

  v_available_count := coalesce(array_length(v_available_q_ids, 1), 0);

  -- KL-02: Guard Pool Soal
  IF v_available_count < p_question_count THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Hanya tersedia ' || v_available_count || ' soal dari ' || p_question_count || ' yang diminta.'
    );
  END IF;

  -- 2. Selection based on weights if provided, or random sample
  IF p_weights IS NOT NULL AND p_weights <> '{}'::jsonb AND jsonb_typeof(p_weights) = 'object' THEN
    v_selected_q_ids := '{}'::integer[];
    FOR v_tid, v_pct IN
      SELECT (key)::uuid, (value)::numeric
      FROM jsonb_each_text(p_weights)
    LOOP
      v_target_count := round((v_pct / 100.0) * p_question_count)::integer;
      IF v_target_count > 0 THEN
        SELECT array_agg(q.id) INTO v_topic_q_ids
        FROM (
          SELECT DISTINCT q.id
          FROM public.questions q
          JOIN public.question_topics qt ON qt.question_id = q.id
          WHERE q.id = ANY(v_available_q_ids)
            AND qt.topic_id = v_tid
            AND NOT (q.id = ANY(v_selected_q_ids))
          ORDER BY random()
          LIMIT v_target_count
        ) q;

        IF v_topic_q_ids IS NOT NULL THEN
          v_selected_q_ids := v_selected_q_ids || v_topic_q_ids;
        END IF;
      END IF;
    END LOOP;

    -- Fill remaining if rounding left a gap
    v_curr_count := coalesce(array_length(v_selected_q_ids, 1), 0);
    IF v_curr_count < p_question_count THEN
      SELECT array_agg(q.id) INTO v_topic_q_ids
      FROM (
        SELECT unnest_id AS id
        FROM unnest(v_available_q_ids) AS unnest_id
        WHERE NOT (unnest_id = ANY(v_selected_q_ids))
        ORDER BY random()
        LIMIT (p_question_count - v_curr_count)
      ) q;

      IF v_topic_q_ids IS NOT NULL THEN
        v_selected_q_ids := v_selected_q_ids || v_topic_q_ids;
      END IF;
    END IF;
  ELSE
    -- Pure random sample
    SELECT array_agg(q.id) INTO v_selected_q_ids
    FROM (
      SELECT unnest_id AS id
      FROM unnest(v_available_q_ids) AS unnest_id
      ORDER BY random()
      LIMIT p_question_count
    ) q;
  END IF;

  -- 3. Generate unique code (KL-03)
  v_code := public.fn_generate_quiz_code();

  -- 4. Insert Quiz record
  INSERT INTO public.quizzes (
    code,
    config,
    status,
    created_by
  )
  VALUES (
    v_code,
    jsonb_build_object(
      'duration_minutes', p_duration_minutes,
      'quiz_mode', p_quiz_mode,
      'allow_join_mid_game', p_allow_mid_game,
      'question_count', p_question_count,
      'topic_ids', p_topic_ids,
      'sub_topic_weights', p_weights
    ),
    'waiting',
    v_user_id
  )
  RETURNING id INTO v_quiz_id;

  -- 5. Snapshot questions to quiz_questions
  v_idx := 0;
  FOREACH v_q_id IN ARRAY v_selected_q_ids
  LOOP
    INSERT INTO public.quiz_questions (quiz_id, question_id, order_index)
    VALUES (v_quiz_id, v_q_id, v_idx);
    v_idx := v_idx + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'quiz_id', v_quiz_id,
    'code', v_code,
    'question_count', array_length(v_selected_q_ids, 1),
    'duration_minutes', p_duration_minutes,
    'mode', p_quiz_mode
  );
END;
$$;

-- 3. RPC: rpc_admin_update_quiz_status (KL-04)
CREATE OR REPLACE FUNCTION public.rpc_admin_update_quiz_status(
  p_quiz_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_quiz record;
  v_duration_mins integer;
  v_pause_duration interval;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.check_is_active_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hanya admin aktif yang dapat mengelola status kuis');
  END IF;

  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id FOR UPDATE;
  IF v_quiz.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kuis tidak ditemukan');
  END IF;

  v_duration_mins := coalesce((v_quiz.config->>'duration_minutes')::integer, 15);

  IF p_action = 'start' THEN
    IF v_quiz.status <> 'waiting' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Hanya kuis berstatus waiting yang dapat dimulai');
    END IF;

    UPDATE public.quizzes
    SET status = 'active',
        started_at = now(),
        expires_at = now() + (v_duration_mins * interval '1 minute'),
        updated_at = now()
    WHERE id = p_quiz_id;

  ELSIF p_action = 'pause' THEN
    IF v_quiz.status <> 'active' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Hanya kuis aktif yang dapat dijeda');
    END IF;

    UPDATE public.quizzes
    SET status = 'paused',
        paused_at = now(),
        updated_at = now()
    WHERE id = p_quiz_id;

  ELSIF p_action = 'resume' THEN
    IF v_quiz.status <> 'paused' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Hanya kuis yang dijeda yang dapat dilanjutkan');
    END IF;

    -- Shift expires_at by the paused duration
    v_pause_duration := now() - coalesce(v_quiz.paused_at, now());

    UPDATE public.quizzes
    SET status = 'active',
        paused_at = NULL,
        expires_at = coalesce(expires_at, now() + (v_duration_mins * interval '1 minute')) + v_pause_duration,
        updated_at = now()
    WHERE id = p_quiz_id;

  ELSIF p_action = 'finish' THEN
    UPDATE public.quizzes
    SET status = 'finished',
        finished_at = now(),
        updated_at = now()
    WHERE id = p_quiz_id;

  ELSIF p_action = 'cancel' THEN
    UPDATE public.quizzes
    SET status = 'cancelled',
        finished_at = now(),
        updated_at = now()
    WHERE id = p_quiz_id;

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Aksi tidak dikenal: ' || p_action);
  END IF;

  SELECT status, started_at, paused_at, expires_at, finished_at INTO v_quiz
  FROM public.quizzes WHERE id = p_quiz_id;

  RETURN jsonb_build_object(
    'success', true,
    'quiz_id', p_quiz_id,
    'status', v_quiz.status,
    'started_at', v_quiz.started_at,
    'paused_at', v_quiz.paused_at,
    'expires_at', v_quiz.expires_at,
    'finished_at', v_quiz.finished_at
  );
END;
$$;

-- 4. Update rpc_join_live_quiz to auto-assign 12 animal mounts (RV-04, KL-11)
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
  v_mount text;
  v_skin text;
  v_clean_name text;
  v_mounts text[] := ARRAY['horse','citah','dino','kalkun','kebo','llama','macan','mamot','sapi','udang','ulat','angsa'];
  v_presets text[] := ARRAY['ember', 'storm', 'dune', 'forest', 'aurora', 'midnight', 'rose', 'glacier'];
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

  -- Shuffle questions per player (KL-12)
  SELECT array_agg(v ORDER BY random()) INTO v_shuffled_ids
  FROM unnest(v_base_q_ids) g(v);

  -- Pick unused mount if possible (RV-04)
  SELECT m INTO v_mount
  FROM unnest(v_mounts) m
  WHERE NOT EXISTS (
    SELECT 1 FROM public.players p WHERE p.quiz_id = v_quiz.id AND (p.skin LIKE '%:' || m OR p.skin = m)
  )
  ORDER BY random() LIMIT 1;

  IF v_mount IS NULL THEN
    v_mount := v_mounts[1 + floor(random() * array_length(v_mounts, 1))::int];
  END IF;

  -- Pick preset color
  v_skin := v_presets[1 + floor(random() * array_length(v_presets, 1))::int] || ':' || v_mount;

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
