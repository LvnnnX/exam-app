"use client";

import useExamAutoSave from '@/app/hooks/useExamAutoSave';
import useExamSessionLifecycle from '@/app/hooks/useExamSessionLifecycle';
import useExamSessionProgression from '@/app/hooks/useExamSessionProgression';
import useExamExpiryTimer from '@/app/hooks/useExamExpiryTimer';

type UseExamSessionOrchestrationArgs = {
  autoSaveArgs: Parameters<typeof useExamAutoSave>[0];
  lifecycleArgs: Omit<Parameters<typeof useExamSessionLifecycle>[0], 'autoSaveToSupabase'>;
  progressionArgs: Omit<Parameters<typeof useExamSessionProgression>[0], 'onEndSession' | 'onAutoSaveToSupabase'>;
  expiryTimerArgs: Parameters<typeof useExamExpiryTimer>[0];
};

export default function useExamSessionOrchestration({
  autoSaveArgs,
  lifecycleArgs,
  progressionArgs,
  expiryTimerArgs,
}: UseExamSessionOrchestrationArgs) {
  const autoSaveToSupabase = useExamAutoSave(autoSaveArgs);

  const {
    goToStep,
    startExam,
    endSession,
    surrender,
    restart,
  } = useExamSessionLifecycle({
    ...lifecycleArgs,
    autoSaveToSupabase,
  });

  const {
    goToQuestion,
    nextQuestion,
    skipQuestion,
  } = useExamSessionProgression({
    ...progressionArgs,
    onEndSession: endSession,
    onAutoSaveToSupabase: autoSaveToSupabase,
  });

  useExamExpiryTimer(expiryTimerArgs);

  return {
    goToStep,
    startExam,
    endSession,
    goToQuestion,
    nextQuestion,
    skipQuestion,
    surrender,
    restart,
  };
}
