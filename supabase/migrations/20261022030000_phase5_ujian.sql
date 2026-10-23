-- Migration: 20261022030000_phase5_ujian.sql
-- Fase 5: Ujian Mandiri (Exam & Survival), secret verification, deterministic shuffle, and admin reporting.

BEGIN;

-- 1. Alter exam_sessions table with phase 5 columns
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS time_limit_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS question_count integer,
  ADD COLUMN IF NOT EXISTS end_reason text,
  ADD COLUMN IF NOT EXISTS violation_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.exam_sessions
  DROP CONSTRAINT IF EXISTS exam_sessions_end_reason_check;

ALTER TABLE public.exam_sessions
  ADD CONSTRAINT exam_sessions_end_reason_check
  CHECK (end_reason IS NULL OR end_reason IN ('submit', 'surrender', 'time_up', 'violation', 'lives_out', 'questions_out'));

-- 2. Helper function: rpc_ujian_count
CREATE OR REPLACE FUNCTION public.rpc_ujian_count(p_topic_ids uuid[])
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_topic_ids IS NULL OR array_length(p_topic_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  SELECT count(DISTINCT q.id) INTO v_count
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

  RETURN coalesce(v_count, 0);
END;
$$;

-- 3. RPC: rpc_ujian_start
CREATE OR REPLACE FUNCTION public.rpc_ujian_start(
  p_name text,
  p_topic_ids uuid[],
  p_mode text,
  p_nav_mode text,
  p_count integer,
  p_time_limit_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clean_name text;
  v_valid_topics uuid[];
  v_available_count integer;
  v_effective_nav text;
  v_target_count integer;
  v_question_ids integer[];
  v_raw_secret text;
  v_secret_hash text;
  v_session_id uuid;
  v_expires_at timestamptz;
  v_allowed_presets integer[] := ARRAY[5, 10, 20, 25, 30, 40, 50, 100];
  v_allowed_times integer[] := ARRAY[0, 30, 60, 90, 120, 150, 180];
BEGIN
  v_clean_name := trim(p_name);
  IF length(v_clean_name) = 0 OR length(v_clean_name) > 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nama maksimal 16 karakter.');
  END IF;

  IF p_mode NOT IN ('exam', 'survival') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mode tidak valid.');
  END IF;

  IF p_nav_mode NOT IN ('strict', 'standard') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Navigasi tidak valid.');
  END IF;

  IF NOT (p_time_limit_minutes = ANY(v_allowed_times)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Batas waktu tidak valid.');
  END IF;

  IF p_topic_ids IS NULL OR array_length(p_topic_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pilih minimal satu sub-bab.');
  END IF;

  -- Validate topics exist and shown (with cascade)
  SELECT array_agg(DISTINCT t.id) INTO v_valid_topics
  FROM public.topics t
  JOIN public.chapters c ON c.id = t.chapter_id
  JOIN public.subjects s ON s.id = c.subject_id
  WHERE t.visibility = 'shown'
    AND c.visibility = 'shown'
    AND s.visibility = 'shown'
    AND t.id = ANY(p_topic_ids);

  IF v_valid_topics IS NULL OR array_length(v_valid_topics, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pilih minimal satu sub-bab.');
  END IF;

  -- Available question count
  v_available_count := public.rpc_ujian_count(v_valid_topics);
  IF v_available_count < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Soal di kategori ini kurang dari 5');
  END IF;

  IF p_mode = 'survival' THEN
    v_effective_nav := 'strict';
    v_target_count := LEAST(v_available_count, 500);

    SELECT array_agg(sq.id) INTO v_question_ids
    FROM (
      SELECT q.id
      FROM (
        SELECT DISTINCT q.id
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
          AND t.id = ANY(v_valid_topics)
      ) q
      ORDER BY random()
      LIMIT v_target_count
    ) sq;
  ELSE
    v_effective_nav := p_nav_mode;
    IF p_count IS NULL OR NOT (p_count = ANY(v_allowed_presets)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Jumlah soal tidak valid.');
    END IF;
    IF p_count > v_available_count THEN
      RETURN jsonb_build_object('success', false, 'error', 'Soal tersedia cuma ' || v_available_count || '.');
    END IF;
    v_target_count := p_count;

    SELECT array_agg(sq.id) INTO v_question_ids
    FROM (
      SELECT q.id
      FROM (
        SELECT DISTINCT q.id
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
          AND t.id = ANY(v_valid_topics)
      ) q
      ORDER BY random()
      LIMIT v_target_count
    ) sq;
  END IF;

  -- Generate 32-byte secret (64 hex characters)
  v_raw_secret := encode(public.gen_random_bytes(32), 'hex');
  v_secret_hash := encode(public.digest(v_raw_secret, 'sha256'), 'hex');

  IF p_time_limit_minutes > 0 THEN
    v_expires_at := now() + (p_time_limit_minutes || ' minutes')::interval;
  ELSE
    v_expires_at := now() + interval '1 day';
  END IF;

  INSERT INTO public.exam_sessions (
    user_id,
    name,
    mode,
    nav_mode,
    selected_categories,
    question_order,
    question_count,
    time_limit_minutes,
    lives,
    score,
    current_index,
    status,
    secret_hash,
    start_time,
    expires_at,
    violation_count
  ) VALUES (
    auth.uid(),
    v_clean_name,
    p_mode,
    v_effective_nav,
    jsonb_build_object('topic_ids', v_valid_topics),
    coalesce(v_question_ids, '{}'::integer[]),
    array_length(v_question_ids, 1),
    p_time_limit_minutes,
    (CASE WHEN p_mode = 'survival' THEN 3 ELSE 0 END),
    0,
    0,
    'active',
    v_secret_hash,
    now(),
    v_expires_at,
    0
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'secret', v_raw_secret
  );
END;
$$;

-- 4. Helper function: verify session secret
CREATE OR REPLACE FUNCTION public.fn_verify_exam_session(
  p_session_id uuid,
  p_secret text
)
RETURNS public.exam_sessions
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session public.exam_sessions;
  v_hash text;
BEGIN
  IF p_session_id IS NULL OR p_secret IS NULL OR length(p_secret) <> 64 THEN
    RAISE EXCEPTION 'Sesi tidak ditemukan';
  END IF;

  v_hash := encode(public.digest(p_secret, 'sha256'), 'hex');

  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL OR v_session.secret_hash IS NULL OR v_session.secret_hash <> v_hash THEN
    RAISE EXCEPTION 'Sesi tidak ditemukan';
  END IF;

  RETURN v_session;
END;
$$;

-- 5. Helper function: finalize expired session
CREATE OR REPLACE FUNCTION public.fn_finalize_exam_if_expired(p_session public.exam_sessions)
RETURNS public.exam_sessions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_res public.exam_sessions := p_session;
  v_score integer;
  v_duration integer;
BEGIN
  IF v_res.status = 'active'
     AND v_res.time_limit_minutes > 0
     AND v_res.expires_at IS NOT NULL
     AND now() > v_res.expires_at THEN

    IF v_res.mode = 'exam' THEN
      SELECT count(*) INTO v_score
      FROM public.exam_answers
      WHERE session_id = v_res.id AND is_correct = true;
    ELSE
      v_score := v_res.score;
    END IF;

    v_duration := EXTRACT(EPOCH FROM (now() - v_res.start_time))::integer;

    UPDATE public.exam_sessions
    SET status = 'finished',
        end_reason = 'time_up',
        end_time = coalesce(end_time, now()),
        duration_seconds = coalesce(duration_seconds, v_duration),
        score = coalesce(v_score, 0)
    WHERE id = v_res.id
    RETURNING * INTO v_res;
  END IF;

  RETURN v_res;
END;
$$;

-- 6. Helper function: format topic labels
CREATE OR REPLACE FUNCTION public.fn_exam_topic_labels(p_selected jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_topic_ids uuid[];
  v_mapel text[];
  v_bab text[];
  v_sub text[];
BEGIN
  IF p_selected ? 'topic_ids' AND jsonb_typeof(p_selected->'topic_ids') = 'array' THEN
    SELECT array_agg(elem::text::uuid) INTO v_topic_ids
    FROM jsonb_array_elements_text(p_selected->'topic_ids') elem;

    IF v_topic_ids IS NOT NULL AND array_length(v_topic_ids, 1) > 0 THEN
      SELECT array_agg(DISTINCT s.name ORDER BY s.name) INTO v_mapel
      FROM public.topics t
      JOIN public.chapters c ON c.id = t.chapter_id
      JOIN public.subjects s ON s.id = c.subject_id
      WHERE t.id = ANY(v_topic_ids);

      SELECT array_agg(DISTINCT c.name ORDER BY c.name) INTO v_bab
      FROM public.topics t
      JOIN public.chapters c ON c.id = t.chapter_id
      WHERE t.id = ANY(v_topic_ids);

      SELECT array_agg(DISTINCT t.name ORDER BY t.name) INTO v_sub
      FROM public.topics t
      WHERE t.id = ANY(v_topic_ids);

      RETURN jsonb_build_object(
        'mapel', coalesce(v_mapel, '{}'::text[]),
        'bab', coalesce(v_bab, '{}'::text[]),
        'sub_bab', coalesce(v_sub, '{}'::text[])
      );
    END IF;
  END IF;

  -- Legacy fallback {mapel, bab, sub_bab}
  RETURN jsonb_build_object(
    'mapel', CASE WHEN p_selected ? 'mapel' THEN string_to_array(p_selected->>'mapel', ', ') ELSE '{}'::text[] END,
    'bab', CASE WHEN p_selected ? 'bab' THEN string_to_array(p_selected->>'bab', ', ') ELSE '{}'::text[] END,
    'sub_bab', CASE WHEN p_selected ? 'sub_bab' THEN string_to_array(p_selected->>'sub_bab', ', ') ELSE '{}'::text[] END
  );
END;
$$;

-- 7. RPC: rpc_ujian_state
CREATE OR REPLACE FUNCTION public.rpc_ujian_state(
  p_session_id uuid,
  p_secret text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session public.exam_sessions;
  v_total integer;
  v_score integer;
  v_answers jsonb;
  v_topics jsonb;
  v_expires_str text := null;
BEGIN
  v_session := public.fn_verify_exam_session(p_session_id, p_secret);
  v_session := public.fn_finalize_exam_if_expired(v_session);

  v_total := coalesce(v_session.question_count, array_length(v_session.question_order, 1), 0);
  v_topics := public.fn_exam_topic_labels(v_session.selected_categories);

  IF v_session.mode = 'exam' THEN
    IF v_session.status = 'active' THEN
      v_score := NULL;
    ELSE
      v_score := v_session.score;
    END IF;
  ELSE
    v_score := v_session.score;
  END IF;

  IF v_session.time_limit_minutes > 0 THEN
    v_expires_str := v_session.expires_at::text;
  ELSE
    v_expires_str := NULL;
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'index', idx,
      'answered', (ea.user_answer IS NOT NULL AND trim(ea.user_answer) <> ''),
      'doubtful', coalesce(ea.is_marked_doubtful, false)
    ) ORDER BY idx
  ), '[]'::jsonb) INTO v_answers
  FROM generate_series(0, GREATEST(0, v_total - 1)) idx
  LEFT JOIN public.exam_answers ea ON ea.session_id = v_session.id AND ea.order_index = idx;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'name', v_session.name,
    'mode', v_session.mode,
    'nav_mode', v_session.nav_mode,
    'status', v_session.status,
    'end_reason', v_session.end_reason,
    'total', v_total,
    'current_index', v_session.current_index,
    'lives', v_session.lives,
    'score', v_score,
    'time_limit_minutes', v_session.time_limit_minutes,
    'started_at', v_session.start_time,
    'expires_at', v_expires_str,
    'server_now', now(),
    'topics', v_topics,
    'answers', v_answers,
    'violation_count', v_session.violation_count
  );
END;
$$;

-- 8. RPC: rpc_ujian_question
CREATE OR REPLACE FUNCTION public.rpc_ujian_question(
  p_session_id uuid,
  p_secret text,
  p_index integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session public.exam_sessions;
  v_total integer;
  v_q_id integer;
  v_q record;
  v_shuffled_options jsonb;
  v_saved record;
BEGIN
  v_session := public.fn_verify_exam_session(p_session_id, p_secret);
  v_session := public.fn_finalize_exam_if_expired(v_session);

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'Sesi sudah selesai';
  END IF;

  v_total := coalesce(v_session.question_count, array_length(v_session.question_order, 1), 0);
  IF p_index < 0 OR p_index >= v_total THEN
    RAISE EXCEPTION 'Indeks soal tidak valid';
  END IF;

  IF v_session.nav_mode = 'strict' OR v_session.mode = 'survival' THEN
    IF p_index <> v_session.current_index THEN
      RAISE EXCEPTION 'Mode %: indeks soal harus %', v_session.nav_mode, v_session.current_index;
    END IF;
  ELSE
    -- standard mode: restore / track last viewed question
    UPDATE public.exam_sessions
    SET current_index = p_index
    WHERE id = v_session.id;
  END IF;

  v_q_id := v_session.question_order[p_index + 1];
  IF v_q_id IS NULL THEN
    RAISE EXCEPTION 'Soal tidak ditemukan';
  END IF;

  SELECT id, type, body_html, options INTO v_q
  FROM public.questions
  WHERE id = v_q_id;

  IF v_q.id IS NULL THEN
    RAISE EXCEPTION 'Soal tidak ditemukan';
  END IF;

  -- Deterministic shuffle: md5(session_id || ':' || index || ':' || label)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'label', opt->>'label',
      'text', opt->>'text'
    ) ORDER BY md5(v_session.id::text || ':' || p_index::text || ':' || (opt->>'label'))
  ), '[]'::jsonb) INTO v_shuffled_options
  FROM jsonb_array_elements(v_q.options) opt;

  SELECT user_answer, is_marked_doubtful INTO v_saved
  FROM public.exam_answers
  WHERE session_id = v_session.id AND order_index = p_index;

  RETURN jsonb_build_object(
    'index', p_index,
    'total', v_total,
    'id', v_q.id,
    'type', v_q.type,
    'body_html', v_q.body_html,
    'options', v_shuffled_options,
    'saved_answer', v_saved.user_answer,
    'doubtful', coalesce(v_saved.is_marked_doubtful, false)
  );
END;
$$;

-- 9. RPC: rpc_ujian_save
CREATE OR REPLACE FUNCTION public.rpc_ujian_save(
  p_session_id uuid,
  p_secret text,
  p_index integer,
  p_answer text,
  p_doubtful boolean,
  p_time_taken integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session public.exam_sessions;
  v_total integer;
  v_q_id integer;
  v_q_type text;
  v_correct_answer text;
  v_is_correct boolean := false;
  v_clean_user text;
  v_clean_key text;
  v_existing record;
  v_clamped_time integer;
  v_trimmed_answer text;
  v_new_lives integer;
  v_new_score integer;
  v_next_index integer;
  v_is_finished boolean := false;
  v_end_reason text := null;
BEGIN
  v_session := public.fn_verify_exam_session(p_session_id, p_secret);

  -- 10-second grace period for in-flight requests
  IF v_session.status = 'active'
     AND v_session.time_limit_minutes > 0
     AND v_session.expires_at IS NOT NULL
     AND now() > (v_session.expires_at + interval '10 seconds') THEN
    v_session := public.fn_finalize_exam_if_expired(v_session);
  END IF;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'Sesi sudah selesai';
  END IF;

  v_total := coalesce(v_session.question_count, array_length(v_session.question_order, 1), 0);
  IF p_index < 0 OR p_index >= v_total THEN
    RAISE EXCEPTION 'Indeks soal tidak valid';
  END IF;

  v_clamped_time := GREATEST(0, LEAST(3600, coalesce(p_time_taken, 0)));
  IF p_answer IS NOT NULL THEN
    v_trimmed_answer := left(trim(p_answer), 500);
    IF v_trimmed_answer = '' THEN
      v_trimmed_answer := NULL;
    END IF;
  ELSE
    v_trimmed_answer := NULL;
  END IF;

  -- Idempotency check for retry in strict/survival (UM-12)
  IF (v_session.nav_mode = 'strict' OR v_session.mode = 'survival') AND p_index = (v_session.current_index - 1) THEN
    SELECT * INTO v_existing
    FROM public.exam_answers
    WHERE session_id = v_session.id AND order_index = p_index;

    IF v_existing.id IS NOT NULL AND coalesce(v_existing.user_answer, '') = coalesce(v_trimmed_answer, '') THEN
      IF v_session.mode = 'survival' THEN
        RETURN jsonb_build_object(
          'saved_at', v_existing.answered_at,
          'next_index', v_session.current_index,
          'finished', (v_session.status = 'finished'),
          'is_correct', v_existing.is_correct,
          'lives', v_session.lives,
          'score', v_session.score
        );
      ELSE
        RETURN jsonb_build_object(
          'saved_at', v_existing.answered_at,
          'next_index', v_session.current_index,
          'finished', false
        );
      END IF;
    END IF;
  END IF;

  -- Enforce sequential order for strict / survival
  IF (v_session.nav_mode = 'strict' OR v_session.mode = 'survival') AND p_index <> v_session.current_index THEN
    RAISE EXCEPTION 'Mode strict: soal harus dijawab berurutan (harus indeks %)', v_session.current_index;
  END IF;

  v_q_id := v_session.question_order[p_index + 1];
  SELECT type, answer_key INTO v_q_type, v_correct_answer
  FROM public.questions WHERE id = v_q_id;

  IF v_trimmed_answer IS NOT NULL THEN
    IF v_q_type = 'short_answer' THEN
      v_clean_user := regexp_replace(lower(public.strip_html(v_trimmed_answer)), '\s+', '', 'g');
      v_clean_key := regexp_replace(lower(public.strip_html(coalesce(v_correct_answer, ''))), '\s+', '', 'g');
      v_is_correct := (v_clean_user <> '' AND v_clean_user = v_clean_key);
    ELSE
      v_is_correct := (upper(trim(v_trimmed_answer)) = upper(trim(coalesce(v_correct_answer, ''))));
    END IF;
  ELSE
    v_is_correct := false;
  END IF;

  -- Upsert answer
  INSERT INTO public.exam_answers (
    session_id, order_index, question_id, user_answer, is_marked_doubtful, is_correct, time_taken, answered_at
  ) VALUES (
    v_session.id, p_index, v_q_id, v_trimmed_answer, coalesce(p_doubtful, false), v_is_correct, v_clamped_time, now()
  )
  ON CONFLICT (session_id, order_index) DO UPDATE SET
    user_answer = excluded.user_answer,
    is_marked_doubtful = excluded.is_marked_doubtful,
    is_correct = excluded.is_correct,
    time_taken = excluded.time_taken,
    answered_at = now();

  IF v_session.mode = 'survival' THEN
    v_new_lives := v_session.lives;
    v_new_score := v_session.score;

    IF v_is_correct THEN
      v_new_score := v_new_score + 1;
    ELSE
      v_new_lives := GREATEST(0, v_new_lives - 1);
    END IF;

    v_next_index := p_index + 1;

    IF v_new_lives <= 0 THEN
      v_is_finished := true;
      v_end_reason := 'lives_out';
    ELSIF v_next_index >= v_total THEN
      v_is_finished := true;
      v_end_reason := 'questions_out';
    END IF;

    UPDATE public.exam_sessions
    SET lives = v_new_lives,
        score = v_new_score,
        current_index = v_next_index,
        status = CASE WHEN v_is_finished THEN 'finished' ELSE status END,
        end_reason = CASE WHEN v_is_finished THEN v_end_reason ELSE end_reason END,
        end_time = CASE WHEN v_is_finished THEN now() ELSE end_time END,
        duration_seconds = CASE WHEN v_is_finished THEN EXTRACT(EPOCH FROM (now() - start_time))::integer ELSE duration_seconds END
    WHERE id = v_session.id;

    RETURN jsonb_build_object(
      'saved_at', now(),
      'next_index', v_next_index,
      'finished', v_is_finished,
      'is_correct', v_is_correct,
      'lives', v_new_lives,
      'score', v_new_score
    );
  END IF;

  -- Mode exam: strict vs standard
  IF v_session.nav_mode = 'strict' THEN
    v_next_index := p_index + 1;
    UPDATE public.exam_sessions
    SET current_index = v_next_index
    WHERE id = v_session.id;

    RETURN jsonb_build_object(
      'saved_at', now(),
      'next_index', v_next_index,
      'finished', false
    );
  ELSE
    -- standard mode: does not advance automatically
    RETURN jsonb_build_object(
      'saved_at', now(),
      'next_index', p_index,
      'finished', false
    );
  END IF;
END;
$$;

-- 10. RPC: rpc_ujian_violation
CREATE OR REPLACE FUNCTION public.rpc_ujian_violation(
  p_session_id uuid,
  p_secret text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session public.exam_sessions;
  v_new_violation integer;
  v_is_finished boolean := false;
  v_score integer;
  v_duration integer;
BEGIN
  v_session := public.fn_verify_exam_session(p_session_id, p_secret);

  IF v_session.status <> 'active' THEN
    RETURN jsonb_build_object(
      'violation_count', v_session.violation_count,
      'finished', true
    );
  END IF;

  v_new_violation := v_session.violation_count + 1;

  IF v_new_violation >= 3 THEN
    v_is_finished := true;

    IF v_session.mode = 'exam' THEN
      SELECT count(*) INTO v_score
      FROM public.exam_answers
      WHERE session_id = v_session.id AND is_correct = true;
    ELSE
      v_score := v_session.score;
    END IF;

    v_duration := EXTRACT(EPOCH FROM (now() - v_session.start_time))::integer;

    UPDATE public.exam_sessions
    SET violation_count = v_new_violation,
        status = 'finished',
        end_reason = 'violation',
        end_time = now(),
        duration_seconds = v_duration,
        score = coalesce(v_score, 0)
    WHERE id = v_session.id;
  ELSE
    UPDATE public.exam_sessions
    SET violation_count = v_new_violation
    WHERE id = v_session.id;
  END IF;

  RETURN jsonb_build_object(
    'violation_count', v_new_violation,
    'finished', v_is_finished
  );
END;
$$;

-- 11. RPC: rpc_ujian_finish
CREATE OR REPLACE FUNCTION public.rpc_ujian_finish(
  p_session_id uuid,
  p_secret text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session public.exam_sessions;
  v_total integer;
  v_score integer;
  v_answered integer;
  v_percent integer;
  v_duration integer;
BEGIN
  v_session := public.fn_verify_exam_session(p_session_id, p_secret);

  IF p_reason NOT IN ('submit', 'surrender', 'time_up') THEN
    RAISE EXCEPTION 'Alasan selesai tidak valid';
  END IF;

  v_total := coalesce(v_session.question_count, array_length(v_session.question_order, 1), 0);

  -- Count answered questions
  SELECT count(*) INTO v_answered
  FROM public.exam_answers
  WHERE session_id = v_session.id
    AND user_answer IS NOT NULL
    AND trim(user_answer) <> '';

  -- Idempotency: if already finished
  IF v_session.status = 'finished' OR v_session.status = 'expired' THEN
    IF v_session.mode = 'exam' THEN
      v_percent := CASE WHEN v_total > 0 THEN round((v_session.score::numeric / v_total::numeric) * 100) ELSE 0 END;
    ELSE
      v_percent := NULL;
    END IF;

    RETURN jsonb_build_object(
      'status', v_session.status,
      'end_reason', v_session.end_reason,
      'score', v_session.score,
      'total', v_total,
      'answered', coalesce(v_answered, 0),
      'percent', v_percent
    );
  END IF;

  IF v_session.mode = 'exam' THEN
    SELECT count(*) INTO v_score
    FROM public.exam_answers
    WHERE session_id = v_session.id AND is_correct = true;

    v_score := coalesce(v_score, 0);
    v_percent := CASE WHEN v_total > 0 THEN round((v_score::numeric / v_total::numeric) * 100) ELSE 0 END;
  ELSE
    v_score := v_session.score;
    v_percent := NULL;
  END IF;

  v_duration := EXTRACT(EPOCH FROM (now() - v_session.start_time))::integer;

  UPDATE public.exam_sessions
  SET status = 'finished',
      end_reason = p_reason,
      score = v_score,
      end_time = now(),
      duration_seconds = v_duration
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'status', v_session.status,
    'end_reason', v_session.end_reason,
    'score', v_score,
    'total', v_total,
    'answered', coalesce(v_answered, 0),
    'percent', v_percent
  );
END;
$$;

-- 12. RPC: rpc_ujian_recap (UM-31 & BS-04: only finished/expired, NO explanation_html!)
CREATE OR REPLACE FUNCTION public.rpc_ujian_recap(
  p_session_id uuid,
  p_secret text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session public.exam_sessions;
  v_total integer;
  v_answered integer;
  v_percent integer;
  v_topics jsonb;
  v_items jsonb;
BEGIN
  v_session := public.fn_verify_exam_session(p_session_id, p_secret);

  IF v_session.status NOT IN ('finished', 'expired') THEN
    RAISE EXCEPTION 'Rekap hanya dapat dilihat setelah ujian selesai';
  END IF;

  v_total := coalesce(v_session.question_count, array_length(v_session.question_order, 1), 0);
  v_topics := public.fn_exam_topic_labels(v_session.selected_categories);

  SELECT count(*) INTO v_answered
  FROM public.exam_answers
  WHERE session_id = v_session.id
    AND user_answer IS NOT NULL
    AND trim(user_answer) <> '';

  IF v_session.mode = 'exam' THEN
    v_percent := CASE WHEN v_total > 0 THEN round((v_session.score::numeric / v_total::numeric) * 100) ELSE 0 END;

    -- All questions in question_order
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'index', idx,
        'question_id', q.id,
        'type', q.type,
        'body_html', q.body_html,
        'options', (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'label', opt->>'label',
              'text', opt->>'text'
            ) ORDER BY md5(v_session.id::text || ':' || idx::text || ':' || (opt->>'label'))
          ), '[]'::jsonb)
          FROM jsonb_array_elements(q.options) opt
        ),
        'user_answer', ea.user_answer,
        'answer_key', q.answer_key,
        'is_correct', coalesce(ea.is_correct, false),
        'doubtful', coalesce(ea.is_marked_doubtful, false)
      ) ORDER BY idx
    ), '[]'::jsonb) INTO v_items
    FROM generate_series(0, GREATEST(0, v_total - 1)) idx
    JOIN public.questions q ON q.id = v_session.question_order[idx + 1]
    LEFT JOIN public.exam_answers ea ON ea.session_id = v_session.id AND ea.order_index = idx;
  ELSE
    v_percent := NULL;

    -- Survival mode: only answered questions
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'index', ea.order_index,
        'question_id', q.id,
        'type', q.type,
        'body_html', q.body_html,
        'options', (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'label', opt->>'label',
              'text', opt->>'text'
            ) ORDER BY md5(v_session.id::text || ':' || ea.order_index::text || ':' || (opt->>'label'))
          ), '[]'::jsonb)
          FROM jsonb_array_elements(q.options) opt
        ),
        'user_answer', ea.user_answer,
        'answer_key', q.answer_key,
        'is_correct', ea.is_correct,
        'doubtful', coalesce(ea.is_marked_doubtful, false)
      ) ORDER BY ea.order_index
    ), '[]'::jsonb) INTO v_items
    FROM public.exam_answers ea
    JOIN public.questions q ON q.id = ea.question_id
    WHERE ea.session_id = v_session.id;
  END IF;

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'status', v_session.status,
      'end_reason', v_session.end_reason,
      'score', v_session.score,
      'total', v_total,
      'answered', coalesce(v_answered, 0),
      'percent', v_percent,
      'name', v_session.name,
      'mode', v_session.mode,
      'nav_mode', v_session.nav_mode,
      'topics', v_topics,
      'duration_seconds', v_session.duration_seconds
    ),
    'items', v_items
  );
END;
$$;

-- 13. Admin RPC: rpc_admin_ujian_results
CREATE OR REPLACE FUNCTION public.rpc_admin_ujian_results(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_escaped_search text;
  v_rows jsonb;
BEGIN
  IF p_search IS NOT NULL AND trim(p_search) <> '' THEN
    v_escaped_search := '%' || replace(replace(trim(p_search), '\', '\\'), '%', '\%');
    v_escaped_search := replace(v_escaped_search, '_', '\_') || '%';
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'mode', s.mode,
      'nav_mode', s.nav_mode,
      'topics_label', s.topics_label,
      'score', s.score,
      'total', s.effective_total,
      'percent', s.calc_percent,
      'passed', s.calc_passed,
      'status', s.status,
      'end_reason', s.end_reason,
      'started_at', s.start_time,
      'finished_at', s.end_time,
      'duration_seconds', s.duration_seconds,
      'has_answers', s.has_answers
    ) ORDER BY s.start_time DESC
  ), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      es.id,
      es.name,
      es.mode,
      es.nav_mode,
      es.status,
      es.end_reason,
      es.score,
      es.start_time,
      es.end_time,
      es.duration_seconds,
      coalesce(es.question_count, nullif(array_length(es.question_order, 1), 0), es.current_index, 0) AS effective_total,
      CASE
        WHEN es.mode = 'exam' AND coalesce(es.question_count, nullif(array_length(es.question_order, 1), 0), es.current_index, 0) > 0
          THEN round((es.score::numeric / (coalesce(es.question_count, nullif(array_length(es.question_order, 1), 0), es.current_index, 0))::numeric) * 100)
        ELSE NULL
      END AS calc_percent,
      CASE
        WHEN es.mode = 'exam' AND coalesce(es.question_count, nullif(array_length(es.question_order, 1), 0), es.current_index, 0) > 0
          THEN (round((es.score::numeric / (coalesce(es.question_count, nullif(array_length(es.question_order, 1), 0), es.current_index, 0))::numeric) * 100) >= 70)
        ELSE NULL
      END AS calc_passed,
      CASE
        WHEN es.selected_categories ? 'topic_ids' THEN (
          SELECT coalesce(string_agg(t.name, ', '), '')
          FROM public.topics t
          WHERE t.id = ANY(ARRAY(
            SELECT jsonb_array_elements_text(es.selected_categories->'topic_ids')::uuid
          ))
        )
        ELSE concat_ws(' > ',
          nullif(es.selected_categories->>'mapel', ''),
          nullif(es.selected_categories->>'bab', ''),
          nullif(es.selected_categories->>'sub_bab', '')
        )
      END AS topics_label,
      EXISTS(SELECT 1 FROM public.exam_answers ea WHERE ea.session_id = es.id) AS has_answers
    FROM public.exam_sessions es
    WHERE es.status IN ('finished', 'expired')
      AND (p_from IS NULL OR (es.start_time AT TIME ZONE 'Asia/Makassar')::date >= p_from)
      AND (p_to IS NULL OR (es.start_time AT TIME ZONE 'Asia/Makassar')::date <= p_to)
      AND (v_escaped_search IS NULL OR es.name ILIKE v_escaped_search ESCAPE '\')
    ORDER BY es.start_time DESC
    LIMIT LEAST(coalesce(p_limit, 200), 500)
  ) s;

  RETURN v_rows;
END;
$$;

-- 14. Admin RPC: rpc_admin_ujian_detail (includes explanation_html)
CREATE OR REPLACE FUNCTION public.rpc_admin_ujian_detail(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session public.exam_sessions;
  v_total integer;
  v_percent integer;
  v_passed boolean;
  v_topics_label text;
  v_row jsonb;
  v_items jsonb;
BEGIN
  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Sesi tidak ditemukan';
  END IF;

  v_total := coalesce(v_session.question_count, nullif(array_length(v_session.question_order, 1), 0), v_session.current_index, 0);

  IF v_session.mode = 'exam' AND v_total > 0 THEN
    v_percent := round((v_session.score::numeric / v_total::numeric) * 100);
    v_passed := (v_percent >= 70);
  ELSE
    v_percent := NULL;
    v_passed := NULL;
  END IF;

  IF v_session.selected_categories ? 'topic_ids' THEN
    SELECT coalesce(string_agg(t.name, ', '), '') INTO v_topics_label
    FROM public.topics t
    WHERE t.id = ANY(ARRAY(
      SELECT jsonb_array_elements_text(v_session.selected_categories->'topic_ids')::uuid
    ));
  ELSE
    v_topics_label := concat_ws(' > ',
      nullif(v_session.selected_categories->>'mapel', ''),
      nullif(v_session.selected_categories->>'bab', ''),
      nullif(v_session.selected_categories->>'sub_bab', '')
    );
  END IF;

  v_row := jsonb_build_object(
    'id', v_session.id,
    'name', v_session.name,
    'mode', v_session.mode,
    'nav_mode', v_session.nav_mode,
    'topics_label', coalesce(v_topics_label, ''),
    'score', v_session.score,
    'total', v_total,
    'percent', v_percent,
    'passed', v_passed,
    'status', v_session.status,
    'end_reason', v_session.end_reason,
    'started_at', v_session.start_time,
    'finished_at', v_session.end_time,
    'duration_seconds', v_session.duration_seconds,
    'has_answers', EXISTS(SELECT 1 FROM public.exam_answers WHERE session_id = v_session.id)
  );

  IF v_session.mode = 'exam' AND array_length(v_session.question_order, 1) > 0 THEN
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'index', idx,
        'question_id', q.id,
        'type', q.type,
        'body_html', q.body_html,
        'options', (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'label', opt->>'label',
              'text', opt->>'text'
            ) ORDER BY md5(v_session.id::text || ':' || idx::text || ':' || (opt->>'label'))
          ), '[]'::jsonb)
          FROM jsonb_array_elements(q.options) opt
        ),
        'user_answer', ea.user_answer,
        'answer_key', q.answer_key,
        'explanation_html', q.explanation_html,
        'is_correct', coalesce(ea.is_correct, false),
        'doubtful', coalesce(ea.is_marked_doubtful, false)
      ) ORDER BY idx
    ), '[]'::jsonb) INTO v_items
    FROM generate_series(0, GREATEST(0, array_length(v_session.question_order, 1) - 1)) idx
    JOIN public.questions q ON q.id = v_session.question_order[idx + 1]
    LEFT JOIN public.exam_answers ea ON ea.session_id = v_session.id AND ea.order_index = idx;
  ELSE
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'index', ea.order_index,
        'question_id', q.id,
        'type', q.type,
        'body_html', q.body_html,
        'options', (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'label', opt->>'label',
              'text', opt->>'text'
            ) ORDER BY md5(v_session.id::text || ':' || ea.order_index::text || ':' || (opt->>'label'))
          ), '[]'::jsonb)
          FROM jsonb_array_elements(q.options) opt
        ),
        'user_answer', ea.user_answer,
        'answer_key', q.answer_key,
        'explanation_html', q.explanation_html,
        'is_correct', ea.is_correct,
        'doubtful', coalesce(ea.is_marked_doubtful, false)
      ) ORDER BY ea.order_index
    ), '[]'::jsonb) INTO v_items
    FROM public.exam_answers ea
    JOIN public.questions q ON q.id = ea.question_id
    WHERE ea.session_id = v_session.id;
  END IF;

  RETURN jsonb_build_object(
    'row', v_row,
    'items', v_items
  );
END;
$$;

-- 15. Security & Grant Management
DO $$
DECLARE
  f regprocedure;
BEGIN
  -- Revoke phase 1 legacy exam RPCs from PUBLIC/anon/authenticated
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'rpc_start_exam_session',
        'rpc_get_exam_question',
        'rpc_save_exam_answer',
        'rpc_submit_exam_session',
        'rpc_get_exam_recap'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;

  -- Secure phase 5 RPCs: strictly service_role only
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'rpc_ujian_count',
        'rpc_ujian_start',
        'rpc_ujian_state',
        'rpc_ujian_question',
        'rpc_ujian_save',
        'rpc_ujian_violation',
        'rpc_ujian_finish',
        'rpc_ujian_recap',
        'rpc_admin_ujian_results',
        'rpc_admin_ujian_detail',
        'fn_verify_exam_session',
        'fn_finalize_exam_if_expired',
        'fn_exam_topic_labels'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
