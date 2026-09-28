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

      // BUG-S2 fix: removed redundant finalizeScheduledExamAttemptAction call.
      // submit_session_exam(uuid, timestamptz) already atomically seals
      // scheduled_exam_attempts (recap, score, user_answers, submitted_at) in PR #27 migration.
      // The old finalize call was overwriting 5-field recap with sanitized 3-field data.

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
