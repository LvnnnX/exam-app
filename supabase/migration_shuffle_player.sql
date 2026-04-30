-- 1. Tambahkan kolom question_ids bertipe array of integers ke tabel player
ALTER TABLE player ADD COLUMN IF NOT EXISTS question_ids INT[];

-- 2. Update RPC get_live_quiz_question untuk mengambil soal dari urutan player, bukan urutan kuis
CREATE OR REPLACE FUNCTION get_live_quiz_question(p_player_id TEXT, p_index INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kuis_id UUID;
  v_q_id INT;
  v_result JSONB;
BEGIN
  -- 1. Get kuis_id from player
  SELECT kuis_id INTO v_kuis_id FROM player WHERE id = p_player_id::UUID;
  
  IF v_kuis_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found: ' || p_player_id);
  END IF;

  -- 2. Get question_id at index from player (randomized per user)
  SELECT question_ids[p_index + 1] INTO v_q_id FROM player WHERE id = p_player_id::UUID;
  
  IF v_q_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Question index out of bounds');
  END IF;

  -- 3. Get question data
  SELECT jsonb_build_object(
    'id', q.id,
    'question_text', q.question_text,
    'option_a', q.option_a,
    'option_b', q.option_b,
    'option_c', q.option_c,
    'option_d', q.option_d,
    'option_e', q.option_e,
    'babs', q.babs,
    'sub_babs', q.sub_babs
  ) INTO v_result
  FROM questions q
  WHERE q.id = v_q_id;

  IF v_result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Question data missing for ID ' || v_q_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'data', v_result);
END;
$$;

-- 3. Update RPC join_live_quiz untuk mengacak soal dan menyimpannya di tabel player
CREATE OR REPLACE FUNCTION join_live_quiz(p_quiz_code TEXT, p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kuis_id UUID;
  v_player_id UUID;
  v_status TEXT;
  v_base_question_ids INT[];
  v_shuffled_ids INT[];
BEGIN
  SELECT id, status, question_ids INTO v_kuis_id, v_status, v_base_question_ids FROM kuis_logs WHERE quiz_code = p_quiz_code;
  
  IF v_kuis_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kuis tidak ditemukan');
  END IF;
  
  IF v_status = 'finished' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kuis sudah berakhir');
  END IF;

  -- Shuffle questions per user
  SELECT array_agg(v ORDER BY random()) INTO v_shuffled_ids FROM unnest(v_base_question_ids) g(v);

  INSERT INTO player (kuis_id, name, question_ids)
  VALUES (v_kuis_id, p_name, v_shuffled_ids)
  ON CONFLICT (kuis_id, name) DO UPDATE SET 
    joined_at = NOW(),
    question_ids = COALESCE(player.question_ids, EXCLUDED.question_ids)
  RETURNING id INTO v_player_id;

  RETURN jsonb_build_object('success', true, 'player_id', v_player_id);
END;
$$;
