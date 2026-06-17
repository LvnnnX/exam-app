"use client";

import { useEffect, useCallback } from 'react';
import { saveSessionAnswerViaRpc, submitSessionExamViaRpc } from '@/lib/questions';
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

    const interval = setInterval(() => {
      const expiry = new Date(expiresAt).getTime();
      const now = Date.now();

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
