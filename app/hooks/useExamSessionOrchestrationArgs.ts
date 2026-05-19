"use client";

type UseExamSessionOrchestrationArgsBuilderArgs = {
  userName: string;
  total: number;
  endTime: number | null;
  saved: boolean;
  sessionId: string;
  gameMode: string;
  setSaving: (value: boolean) => void;
  setScore: (value: number) => void;
  setTotalQuestions: (value: number) => void;
  setRecapData: (value: unknown[]) => void;
  setSaved: (value: boolean) => void;
  setSaveFailed: (value: boolean) => void;
  clearStorage: () => void;
  mapels: string[];
  babs: string[];
  subBabs: string[];
  questionCount: number;
  timeLimit: number;
  current: number;
  answers: Record<number, string>;
  isSurvival: boolean;
  setIsLoading: (value: boolean) => void;
  setSessionId: (value: string) => void;
  setAnswers: (value: Record<number, string>) => void;
  setDoubtFlags: (value: Record<number, boolean>) => void;
  setCurrent: (value: number) => void;
  setExpiresAt: (value: number | null) => void;
  setCurrentQuestion: (value: unknown) => void;
  setLives: (value: number) => void;
  setStep: (value: number) => void;
  setStartTime: (value: number | null) => void;
  setEndTime: (value: number | null) => void;
  setGameMode: (value: string) => void;
  setExamMode: (value: string) => void;
  recapDataSetterBridge: (value: unknown[]) => void;
  preparingStep: number;
  currentQuestion: unknown;
  feedbackResult: unknown;
  lives: number;
  setShowNavPopup: (value: boolean) => void;
  setFeedbackResult: (value: unknown) => void;
  step: number;
  expiresAt: number | null;
  setTimeLeftDisplay: (value: string) => void;
};

export default function useExamSessionOrchestrationArgs({
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
  mapels,
  babs,
  subBabs,
  questionCount,
  timeLimit,
  current,
  answers,
  isSurvival,
  setIsLoading,
  setSessionId,
  setAnswers,
  setDoubtFlags,
  setCurrent,
  setExpiresAt,
  setCurrentQuestion,
  setLives,
  setStep,
  setStartTime,
  setEndTime,
  setGameMode,
  setExamMode,
  recapDataSetterBridge,
  preparingStep,
  currentQuestion,
  feedbackResult,
  lives,
  setShowNavPopup,
  setFeedbackResult,
  step,
  expiresAt,
  setTimeLeftDisplay,
}: UseExamSessionOrchestrationArgsBuilderArgs) {
  return {
    autoSaveArgs: {
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
    },
    lifecycleArgs: {
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
      setRecapData: recapDataSetterBridge,
      clearStorage,
      preparingStep,
    },
    progressionArgs: {
      sessionId,
      current,
      total,
      answers,
      currentQuestion,
      gameMode,
      isSurvival,
      feedbackResult,
      lives,
      setIsLoading,
      setCurrentQuestion,
      setCurrent,
      setShowNavPopup,
      setFeedbackResult,
      setScore,
      setLives,
    },
    expiryTimerArgs: {
      step,
      expiresAt,
      sessionId,
      answers,
      current,
      gameMode,
      setEndTime: (value: number | null) => setEndTime(value),
      setStep: (value: number) => setStep(value),
      setSaving: (value: boolean) => setSaving(value),
      setScore: (value: number) => setScore(value),
      setTotalQuestions: (value: number) => setTotalQuestions(value),
      setRecapData: (value: unknown[]) => recapDataSetterBridge(value),
      setSaved: (value: boolean) => setSaved(value),
      setSaveFailed: (value: boolean) => setSaveFailed(value),
      setTimeLeftDisplay: (value: string) => setTimeLeftDisplay(value),
      clearStorage,
    },
  };
}
