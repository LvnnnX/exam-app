"use client";

type UseExamSetupOrchestrationArgsBuilderArgs = {
  storageKeys: readonly string[];
  setFetchError: (value: string | null) => void;
  setAvailableMapels: (value: string[]) => void;
  setMapels: (value: string[]) => void;
  setIsLoading: (value: boolean) => void;
  setUserName: (value: string) => void;
  setIsRestored: (value: boolean) => void;
  setSessionId: (value: string) => void;
  setTotalQuestions: (value: number) => void;
  setBabs: (value: string[]) => void;
  setSubBabs: (value: string[]) => void;
  setGameMode: (value: string) => void;
  setExamMode: (value: string) => void;
  setLives: (value: number) => void;
  setScore: (value: number) => void;
  setDoubtFlags: (value: Record<number, boolean>) => void;
  setStartTime: (value: number | null) => void;
  setAnswers: (value: Record<number, string>) => void;
  setCurrent: (value: number) => void;
  setStep: (value: number) => void;
  setCurrentQuestion: (value: unknown) => void;
  mapels: string[];
  babs: string[];
  setAvailableBabs: (value: string[]) => void;
  setAvailableSubBabs: (value: string[]) => void;
};

export default function useExamSetupOrchestrationArgs({
  storageKeys,
  setFetchError,
  setAvailableMapels,
  setMapels,
  setIsLoading,
  setUserName,
  setIsRestored,
  setSessionId,
  setTotalQuestions,
  setBabs,
  setSubBabs,
  setGameMode,
  setExamMode,
  setLives,
  setScore,
  setDoubtFlags,
  setStartTime,
  setAnswers,
  setCurrent,
  setStep,
  setCurrentQuestion,
  mapels,
  babs,
  setAvailableBabs,
  setAvailableSubBabs,
}: UseExamSetupOrchestrationArgsBuilderArgs) {
  return {
    bootstrapArgs: {
      storageKeys,
      setFetchError,
      setAvailableMapels,
      setMapels,
      setIsLoading,
      setUserName,
      setIsRestored,
      setSessionId,
      setTotalQuestions,
      setBabs,
      setSubBabs,
      setGameMode,
      setExamMode,
      setLives,
      setScore,
      setDoubtFlags,
      setStartTime,
      setAnswers,
      setCurrent,
      setStep,
      setCurrentQuestion,
    },
    categoryOptionsArgs: {
      mapels,
      babs,
      setAvailableBabs,
      setBabs,
      setAvailableSubBabs,
      setSubBabs,
    },
  };
}
