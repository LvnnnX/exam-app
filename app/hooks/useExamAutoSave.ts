"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { submitSessionExamViaRpc } from '@/lib/questions';
import type { GameMode, RecapItem } from '@/app/hooks/examTypes';

type UseExamAutoSaveArgs = {
  userName: string;
  total: number;
  endTime: number | null;
  saved: boolean;
  sessionId: string | null;
  gameMode: GameMode;
  setSaving: (value: boolean) => void;
  setScore: (value: number) => void;
  setTotalQuestions: (value: number) => void;
  setRecapData: (value: RecapItem[]) => void;
  setSaved: (value: boolean) => void;
  setSaveFailed: (value: boolean) => void;
  clearStorage: () => void;
};

export default function useExamAutoSave({
  userName,
  total,
  endTime,
  saved,
  sessionId,
  gameMode,
  setSaving,
  setScore,
  setTotalQuestions,
  setRecapData,
  setSaved,
  setSaveFailed,
  clearStorage,
}: UseExamAutoSaveArgs) {
  const router = useRouter();

  return useCallback(async () => {
    if (!userName || total === 0 || saved || !sessionId) return;
    setSaving(true);
    try {
      const finalEndTime = endTime ? new Date(endTime).toISOString() : new Date().toISOString();
      const result = await submitSessionExamViaRpc(sessionId, finalEndTime);

      setScore(result.score);
      if (gameMode === 'survival') setTotalQuestions(result.total_attempted);
      setRecapData(result.recap as RecapItem[]);
      setSaved(true);
      setSaveFailed(false);
      clearStorage();
      router.replace('/');
    } catch (err) {
      console.error('Auto-save error:', err);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }, [
    userName,
    total,
    endTime,
    saved,
    sessionId,
    gameMode,
    setSaving,
    setScore,
    setTotalQuestions,
    setRecapData,
    setSaved,
    setSaveFailed,
    clearStorage,
    router,
  ]);
}
