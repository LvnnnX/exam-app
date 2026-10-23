'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { Quiz, LivePlayerProgress, QuizStreamState } from '../types';

interface UseQuizLiveOptions {
  code: string;
  initialQuiz?: Quiz | null;
  initialPlayers?: LivePlayerProgress[];
}

export function useQuizLive({ code, initialQuiz = null, initialPlayers = [] }: UseQuizLiveOptions) {
  const [quiz, setQuiz] = useState<Quiz | null>(initialQuiz);
  const [players, setPlayers] = useState<LivePlayerProgress[]>(initialPlayers);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchState = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/quiz/${encodeURIComponent(code)}/state`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.state) {
        setQuiz(data.state.quiz);
        setPlayers(data.state.players);
        setError(null);
      }
    } catch (_err: unknown) {
      // Quiet fail on temporary network hiccups
    }
  }, [code]);

  useEffect(() => {
    if (!code) return;

    let eventSource: EventSource | null = null;
    let fallbackToPolling = false;

    const startPolling = () => {
      if (pollingRef.current) return;
      fallbackToPolling = true;
      setIsConnected(true);
      fetchState();
      pollingRef.current = setInterval(fetchState, 2000);
    };

    try {
      eventSource = new EventSource(`/api/quiz/${encodeURIComponent(code)}/stream`);

      eventSource.addEventListener('state', (e) => {
        try {
          const payload: QuizStreamState = JSON.parse(e.data);
          setQuiz(payload.quiz);
          setPlayers(payload.players);
          setIsConnected(true);
          setError(null);
        } catch {
          // ignore parse errors
        }
      });

      eventSource.addEventListener('error', () => {
        setIsConnected(false);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Fallback to polling if SSE drops or fails
        if (!fallbackToPolling) {
          startPolling();
        }
      });

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };
    } catch {
      startPolling();
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [code, fetchState]);

  return {
    quiz,
    players,
    isConnected,
    error,
    refresh: fetchState,
  };
}
