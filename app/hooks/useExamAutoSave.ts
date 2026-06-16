"use client";

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { submitSessionExamViaRpc } from '@/lib/questions';
import { finalizeScheduledExamAttemptAction } from '@/app/actions/scheduled-exam';
import type { GameMode, RecapItem } from '@/app/hooks/examTypes';

type UseExamAutoSaveArgs = {
  userName: string;
  total: number;
  endTime: number | null;
  saved: boolean;
  sessionId: string | null;
  gameMode: GameMode;
  isScheduledExam?: boolean;
  setSaving: (value: boolean) => void;
  setScore: (value: number) => void;
  setTotalQuestions: (value: number) => void;
  setRecapData: (value: RecapItem[]) => void;
  setSaved: (value: boolean) => void;
  setSaveFailed: (value: boolean) => void;
  setExpiresAt: (value: string | null) => void;
  clearStorage: () => void;
};

export default function useExamAutoSave({
  userName,
  total,
  endTime,
  saved,
  sessionId,
  gameMode,
  isScheduledExam,
  setSaving,
  setScore,
  setTotalQuestions,
  setRecapData,
  setSaved,
  setSaveFailed,
  setExpiresAt,
  clearStorage,
}: UseExamAutoSaveArgs) {
  const router = useRouter();

  return useCallback(async () => {
    if (!userName || total === 0 || saved || !sessionId) return;
    setSaving(true);
    try {
      const finalEndTime = endTime ? new Date(endTime).toISOString() : new Date().toISOString();
      const result = await submitSessionExamViaRpc(sessionId, finalEndTime);

      // If scheduled, seal the attempt record in DB
      if (isScheduledExam) {
        try {
          await finalizeScheduledExamAttemptAction(sessionId, result.score, result.recap);
        } catch (finalizeErr) {
          console.error('Failed to finalize scheduled attempt:', finalizeErr);
        }
      }

      setScore(result.score);
      if (gameMode === 'survival') setTotalQuestions(result.total_attempted);
      setRecapData(result.recap as RecapItem[]);
      setSaved(true);
      setSaveFailed(false);
      setExpiresAt(null); // Stop timer

      // Scheduled exams stay on the page to show performance; standard/survival redirect home
      if (!isScheduledExam) {
        clearStorage();
        router.replace('/');
      }
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
    isScheduledExam,
    setSaving,
    setScore,
    setTotalQuestions,
    setRecapData,
    setSaved,
    setSaveFailed,
    setExpiresAt,
    clearStorage,
    router,
  ]);
}
