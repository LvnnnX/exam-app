"use client";

import { useCallback } from 'react';
import { getSessionQuestionViaRpc, saveSessionAnswerViaRpc, startExamSessionViaRpc, type ShuffledQuestion } from '@/lib/questions';
import type { Answer, GameMode, ExamMode, RecapItem } from '@/app/hooks/examTypes';

type UseExamSessionLifecycleArgs = {
  userName: string;
  mapels: string[];
  babs: string[];
  subBabs: string[];
  gameMode: GameMode;
  questionCount: number;
  timeLimit: number;
  sessionId: string | null;
  current: number;
  answers: Answer[];
  isSurvival: boolean;
  autoSaveToSupabase: () => Promise<void>;
  setIsLoading: (value: boolean) => void;
  setSessionId: (value: string | null) => void;
  setTotalQuestions: (value: number) => void;
  setAnswers: (value: Answer[]) => void;
  setDoubtFlags: (value: boolean[]) => void;
  setCurrent: (value: number) => void;
  setExpiresAt: (value: string | null) => void;
  setCurrentQuestion: (value: ShuffledQuestion | null) => void;
  setLives: (value: number) => void;
  setScore: (value: number) => void;
  setStep: (value: number) => void;
  setStartTime: (value: number | null) => void;
  setEndTime: (value: number | null) => void;
  setGameMode: (value: GameMode) => void;
  setExamMode: (value: ExamMode) => void;
  setSaved: (value: boolean) => void;
  setSaveFailed: (value: boolean) => void;
  setRecapData: (value: RecapItem[]) => void;
  clearStorage: () => void;
  preparingStep: number;
};

export default function useExamSessionLifecycle({
  userName,
  mapels,
  babs,
  subBabs,
  gameMode,
  questionCount,
  timeLimit,
  sessionId,
  current,
  answers,
  isSurvival,
  autoSaveToSupabase,
  setIsLoading,
  setSessionId,
  setTotalQuestions,
  setAnswers,
  setDoubtFlags,
  setCurrent,
  setExpiresAt,
  setCurrentQuestion,
  setLives,
  setScore,
  setStep,
  setStartTime,
  setEndTime,
  setGameMode,
  setExamMode,
  setSaved,
  setSaveFailed,
  setRecapData,
  clearStorage,
  preparingStep,
}: UseExamSessionLifecycleArgs) {
  const startNewSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const count = isSurvival ? 9999 : questionCount;
      const { sessionId: newSessionId, total: newTotal, expiresAt: serverExpiresAt } = await startExamSessionViaRpc(userName, mapels, babs, subBabs, gameMode, count, timeLimit);

      if (newTotal === 0) {
        throw new Error('Tidak ada soal di kategori ini.');
      }

      setSessionId(newSessionId);
      setTotalQuestions(newTotal);
      setAnswers(Array(newTotal).fill(null));
      setDoubtFlags(Array(newTotal).fill(false));
      setCurrent(0);
      setExpiresAt(serverExpiresAt);

      const firstQuestion = await getSessionQuestionViaRpc(newSessionId, 0);
      setCurrentQuestion(firstQuestion);
    } catch (err: unknown) {
      console.error('Failed to prepare session:', err);
      alert(err instanceof Error ? err.message : 'Gagal memulai sesi ujian.');
    } finally {
      setIsLoading(false);
    }
  }, [
    setIsLoading,
    isSurvival,
    questionCount,
    userName,
    mapels,
    babs,
    subBabs,
    gameMode,
    timeLimit,
    setSessionId,
    setTotalQuestions,
    setAnswers,
    setDoubtFlags,
    setCurrent,
    setExpiresAt,
    setCurrentQuestion,
  ]);

  const goToStep = useCallback((newStep: number) => {
    setStep(newStep);
  }, [setStep]);

  const startExam = useCallback(async () => {
    if (isSurvival) {
      setLives(3);
      setScore(0);
    }
    goToStep(preparingStep);
    await startNewSession();
    setStartTime(Number(new Date()));
    goToStep(3);
  }, [isSurvival, setLives, setScore, goToStep, preparingStep, startNewSession, setStartTime]);

  const endSession = useCallback(async (skipSave = false) => {
    setIsLoading(true);
    try {
      if (!skipSave && answers[current]) {
        const result = await saveSessionAnswerViaRpc(sessionId!, current, answers[current]);
        if (result && result.error === 'time_expired') {
          await autoSaveToSupabase();
          return;
        }
      }
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message === 'time_expired') {
        await autoSaveToSupabase();
        return;
      }
    } finally {
      setIsLoading(false);
    }

    setEndTime(Number(new Date()));
    setStep(6);
    await autoSaveToSupabase();
  }, [setIsLoading, sessionId, current, answers, autoSaveToSupabase, setEndTime, setStep]);

  const surrender = useCallback(async () => {
    await endSession();
  }, [endSession]);

  const restart = useCallback(() => {
    setIsLoading(false);
    setSessionId(null);
    setCurrentQuestion(null);
    setTotalQuestions(0);
    setCurrent(0);
    setAnswers([]);
    setDoubtFlags([]);
    setExpiresAt(null);
    setStartTime(null);
    setEndTime(null);
    setLives(3);
    setScore(0);
    setSaved(false);
    setSaveFailed(false);
    setRecapData([]);
    setGameMode('exam');
    setExamMode('strict');
    setStep(1);
    clearStorage();
  }, [
    setIsLoading,
    setSessionId,
    setCurrentQuestion,
    setTotalQuestions,
    setCurrent,
    setAnswers,
    setDoubtFlags,
    setExpiresAt,
    setStartTime,
    setEndTime,
    setLives,
    setScore,
    setSaved,
    setSaveFailed,
    setRecapData,
    setGameMode,
    setExamMode,
    setStep,
    clearStorage,
  ]);

  return {
    startNewSession,
    goToStep,
    startExam,
    endSession,
    surrender,
    restart,
  };
}
