"use client";

import { useEffect, useCallback, useRef } from 'react';
import { saveSessionAnswerViaRpc, submitSessionExamViaRpc, getServerTimeOffsetMs } from '@/lib/questions';
import type { Answer, GameMode, RecapItem } from '@/app/hooks/examTypes';

type UseExamExpiryTimerArgs = {
  step: number;
  expiresAt: string | null;
  sessionId: string | null;
  answers: Answer[];
  current: number;
  gameMode: GameMode;
  setEndTime: (value: number) => void;
  setStep: (value: number) => void;
  setSaving: (value: boolean) => void;
  setScore: (value: number) => void;
  setTotalQuestions: (value: number) => void;
  setRecapData: (value: RecapItem[]) => void;
  setSaved: (value: boolean) => void;
  setSaveFailed: (value: boolean) => void;
  setTimeLeftDisplay: (value: string) => void;
  clearStorage: () => void;
};

export default function useExamExpiryTimer({
  step,
  expiresAt,
  sessionId,
  answers,
  current,
  gameMode,
  setEndTime,
  setStep,
  setSaving,
  setScore,
  setTotalQuestions,
  setRecapData,
  setSaved,
  setSaveFailed,
  setTimeLeftDisplay,
  clearStorage,
}: UseExamExpiryTimerArgs) {
  // BUG-H1 fix: server-time offset to defeat client-clock manipulation.
  // Refreshed when timer mounts. Uses ref so changing the value doesn't trigger re-render.
  const serverOffsetMs = useRef<number>(0);

  const handleTimerExpiry = useCallback(async () => {
    if (!sessionId) return;

    const currentAnswer = answers[current];
    if (currentAnswer) {
      try {
        await saveSessionAnswerViaRpc(sessionId, current, currentAnswer);
      } catch {
      }
    }

    const now = Date.now();
    setEndTime(now);
    setStep(6);
    setSaving(true);
    try {
      const finalEndTime = new Date(now).toISOString();
      const result = await submitSessionExamViaRpc(sessionId, finalEndTime);
      setScore(result.score);
      if (gameMode === 'survival') setTotalQuestions(result.total_attempted);
      setRecapData(result.recap as RecapItem[]);
      setSaved(true);
      setSaveFailed(false);
      clearStorage();
    } catch (err) {
      console.error('Timer auto-submit error:', err);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }, [sessionId, answers, current, gameMode, setEndTime, setStep, setSaving, setScore, setTotalQuestions, setRecapData, setSaved, setSaveFailed, clearStorage]);

  useEffect(() => {
    if (step !== 3 || !expiresAt) return;

    // BUG-H1: refresh server-time offset when timer becomes active.
    // Fire-and-forget — if it fails, we keep the previous offset (initially 0).
    void getServerTimeOffsetMs().then((offset) => {
      serverOffsetMs.current = offset;
    });

    const interval = setInterval(() => {
      const expiry = new Date(expiresAt).getTime();
      // BUG-H1: use server-time-adjusted client clock instead of raw Date.now().
      // If user backdates their OS clock, serverOffsetMs becomes positive enough that
      // (Date.now() + offset) still tracks server time, so timer can't be extended.
      const now = Date.now() + serverOffsetMs.current;

      // BUG-H4 fix: guard against NaN from corrupt localStorage/expiresAt values.
      // Without this, NaN - Date.now() = NaN, and `NaN <= 0` is false → timer never expires.
      if (!Number.isFinite(expiry)) {
        clearInterval(interval);
        setTimeLeftDisplay('TIME EXPIRED');
        void handleTimerExpiry();
        return;
      }

      const diff = expiry - now;

      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeftDisplay('TIME EXPIRED');
        void handleTimerExpiry();
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeftDisplay(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [step, expiresAt, handleTimerExpiry, setTimeLeftDisplay]);
}
