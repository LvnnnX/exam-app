'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { finishUjianAction, getUjianQuestionAction, getUjianStateAction, saveUjianAnswerAction } from '../actions';
import { applySurvivalAnswer, secondsLeft } from '../logic';
import type { FinishReason, SaveAnswerResult, UjianQuestion, UjianState } from '../types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'retry_1' | 'retry_2' | 'error';

interface UseUjianSessionOptions {
  sessionId: string;
  secret: string;
  initialState?: UjianState | null;
  onFinished: () => void;
}

export function useUjianSession({ sessionId, secret, initialState, onFinished }: UseUjianSessionOptions) {
  const [state, setState] = useState<UjianState | null>(initialState ?? null);
  const [question, setQuestion] = useState<UjianQuestion | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [localAnswer, setLocalAnswer] = useState<string | null>(null);
  const [localDoubt, setLocalDoubt] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);

  const shownAtRef = useRef<number>(0);
  const timerSyncRef = useRef<{ expiresAt: string | null; serverNow: string; clientFetchAt: number } | null>(null);
  const savingPromiseRef = useRef<Promise<SaveAnswerResult | null> | null>(null);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  // Muat state awal kalau belum ada
  useEffect(() => {
    if (state) return;
    let alive = true;
    void (async () => {
      const res = await getUjianStateAction(sessionId, secret);
      if (!alive) return;
      if (res.success) {
        if (res.data.status !== 'active') {
          onFinishedRef.current();
          return;
        }
        timerSyncRef.current = {
          expiresAt: res.data.expires_at,
          serverNow: res.data.server_now,
          clientFetchAt: Date.now(),
        };
        setState(res.data);
      } else {
        setQuestionError(res.error);
        setLoadingQuestion(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId, secret, state]);

  // Muat soal JIT per index
  const loadQuestion = useCallback(
    async (idx: number) => {
      setLoadingQuestion(true);
      setQuestionError(null);
      const res = await getUjianQuestionAction(sessionId, secret, idx);
      if (res.success) {
        setQuestion(res.data);
        setLocalAnswer(res.data.saved_answer);
        setLocalDoubt(res.data.doubtful);
        shownAtRef.current = Date.now();
      } else {
        setQuestionError(res.error);
      }
      setLoadingQuestion(false);
    },
    [sessionId, secret]
  );

  useEffect(() => {
    if (!state) return;
    const target = state.current_index;
    let alive = true;
    void (async () => {
      if (alive) await loadQuestion(target);
    })();
    return () => {
      alive = false;
    };
  }, [state, loadQuestion]);

  // Timer countdown dengan offset jam server
  useEffect(() => {
    const sync = timerSyncRef.current;
    if (!sync || !sync.expiresAt) return;
    const tick = () => {
      const s = secondsLeft(sync.expiresAt, sync.serverNow, sync.clientFetchAt, Date.now());
      setSeconds(s);
      if (s !== null && s <= 0) {
        void finishUjianAction(sessionId, secret, 'time_up').then(() => onFinishedRef.current());
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [sessionId, secret, state?.expires_at]);

  // Simpan jawaban dengan retry backoff
  const saveAnswer = useCallback(
    async (overrideAnswer?: string | null, overrideDoubt?: boolean): Promise<SaveAnswerResult | null> => {
      if (!state || !question) return null;
      if (savingPromiseRef.current) return savingPromiseRef.current;

      const ans = overrideAnswer !== undefined ? overrideAnswer : localAnswer;
      const doubt = overrideDoubt !== undefined ? overrideDoubt : localDoubt;
      const timeTaken = Math.max(1, Math.round((Date.now() - shownAtRef.current) / 1000));
      const idx = question.index;

      const run = async (): Promise<SaveAnswerResult | null> => {
        setSaveStatus('saving');
        const attempts = [0, 400, 1000];
        let lastErr = 'Gagal menyimpan';
        for (let i = 0; i < attempts.length; i++) {
          if (i > 0) {
            setSaveStatus(i === 1 ? 'retry_1' : 'retry_2');
            await new Promise((r) => setTimeout(r, attempts[i]));
          }
          const res = await saveUjianAnswerAction(sessionId, secret, idx, ans, doubt, timeTaken);
          if (res.success) {
            setSaveStatus('saved');
            setState((prev) => {
              if (!prev) return null;
              const nextAnswers = prev.answers.map((a) => (a.index === idx ? { ...a, answered: ans !== null, doubtful: doubt } : a));
              const lives = res.data.lives ?? prev.lives;
              const score = res.data.score ?? prev.score;
              return { ...prev, answers: nextAnswers, lives, score, current_index: res.data.next_index };
            });
            if (res.data.finished) onFinishedRef.current();
            return res.data;
          }
          lastErr = res.error;
        }
        setSaveStatus('error');
        setQuestionError(lastErr);
        return null;
      };

      const p = run().finally(() => {
        savingPromiseRef.current = null;
      });
      savingPromiseRef.current = p;
      return p;
    },
    [sessionId, secret, state, question, localAnswer, localDoubt]
  );

  const goTo = useCallback(
    async (targetIdx: number) => {
      if (!state || !question || targetIdx === question.index) return;
      const changed = localAnswer !== question.saved_answer || localDoubt !== question.doubtful;
      if (changed) {
        const ok = await saveAnswer();
        if (!ok && state.nav_mode === 'strict') return;
      }
      setState((prev) => (prev ? { ...prev, current_index: targetIdx } : null));
    },
    [state, question, localAnswer, localDoubt, saveAnswer]
  );

  const finish = useCallback(
    async (reason: FinishReason) => {
      const res = await finishUjianAction(sessionId, secret, reason);
      if (res.success) onFinishedRef.current();
      return res;
    },
    [sessionId, secret]
  );

  return {
    state,
    question,
    loadingQuestion,
    questionError,
    saveStatus,
    localAnswer,
    localDoubt,
    seconds,
    setLocalAnswer,
    setLocalDoubt: (d: boolean) => {
      setLocalDoubt(d);
      void saveAnswer(undefined, d);
    },
    saveAnswer,
    goTo,
    finish,
    retryLoadQuestion: () => question && loadQuestion(question.index),
    applyOptimisticSurvival: (correct: boolean) => {
      setState((prev) => (prev ? { ...prev, lives: applySurvivalAnswer(prev.lives, correct).lives } : null));
    },
  };
}
