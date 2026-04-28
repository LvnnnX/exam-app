
-- ============================================================
-- Quiz Live Game Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS kuis_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_code TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  question_count INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, active, finished
  question_ids INT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS player (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kuis_id UUID NOT NULL REFERENCES kuis_logs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_time INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  UNIQUE(kuis_id, name)
);

CREATE TABLE IF NOT EXISTS kuis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  time_taken INTEGER NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, question_id)
);

-- Enable RLS
ALTER TABLE kuis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE player ENABLE ROW LEVEL SECURITY;
ALTER TABLE kuis_results ENABLE ROW LEVEL SECURITY;

-- Policies for kuis_logs
CREATE POLICY "Public read access for kuis_logs" ON kuis_logs FOR SELECT USING (true);
CREATE POLICY "Admin write access for kuis_logs" ON kuis_logs FOR ALL TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local') WITH CHECK (auth.jwt() ->> 'email' = 'admin@exam.local');

-- Policies for player
CREATE POLICY "Public read access for player" ON player FOR SELECT USING (true);
CREATE POLICY "Public insert access for player" ON player FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for player" ON player FOR UPDATE USING (true);
CREATE POLICY "Admin delete access for player" ON player FOR DELETE TO authenticated USING (auth.jwt() ->> 'email' = 'admin@exam.local');

-- Policies for kuis_results
CREATE POLICY "Public read access for kuis_results" ON kuis_results FOR SELECT USING (true);
CREATE POLICY "Public insert access for kuis_results" ON kuis_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for kuis_results" ON kuis_results FOR UPDATE USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE kuis_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE player;
