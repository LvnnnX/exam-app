-- Migration: 20261022041000_ujian_results_null_topics.sql
-- Fix: rpc_admin_ujian_results / rpc_admin_ujian_detail crashed with
-- "cannot extract elements from a scalar" when a session has {"topic_ids": null};
-- one such row broke the whole /admin/hasil list. Only expand topic_ids when it is a JSON array
-- (same guard as fn_ujian_topic_labels). Bodies otherwise identical to 20261022030000.

BEGIN;

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
        WHEN jsonb_typeof(es.selected_categories->'topic_ids') = 'array' THEN (
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

  IF jsonb_typeof(v_session.selected_categories->'topic_ids') = 'array' THEN
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

COMMIT;
