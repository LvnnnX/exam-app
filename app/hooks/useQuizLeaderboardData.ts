"use client";

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { type KuisLog, type Player } from '@/lib/quiz';

type UseQuizLeaderboardDataArgs = {
  session: KuisLog | null;
  setLeaderboard: (players: Player[]) => void;
};

export default function useQuizLeaderboardData({ session, setLeaderboard }: UseQuizLeaderboardDataArgs) {
  const fetchLeaderboard = useCallback(async (kuisId: string) => {
    const { data, error } = await supabase
      .from('public_players')
      .select('id, name, kuis_id, score, total_time, finished_at, joined_at, horse_skin')
      .eq('kuis_id', kuisId);
    if (error) {
      console.error('fetchLeaderboard failed:', error.message);
      return;
    }
    if (data) {
      const isStandardMode = session?.quiz_mode === 'standard';
      const qCount = session?.question_count || 1;

      const playersList = data as Player[];

      const mapped = playersList.map((p) => {
        const finished = isStandardMode ? !!p.finished_at : (!!p.finished_at || p.score >= qCount);
        return {
          ...p,
          score: (isStandardMode && !finished) ? 0 : p.score,
        };
      });

      mapped.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.total_time !== b.total_time) return a.total_time - b.total_time;
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
      });

      setLeaderboard(mapped);
    }
  }, [session?.quiz_mode, session?.question_count, setLeaderboard]);

  return {
    fetchLeaderboard,
  };
}
