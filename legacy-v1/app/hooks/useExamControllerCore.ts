"use client";

import useExamModeFlags from '@/app/hooks/useExamModeFlags';
import useExamSecurityActivation from '@/app/hooks/useExamSecurityActivation';
import useExamStorageSync from '@/app/hooks/useExamStorageSync';

type UseExamControllerCoreArgs = {
  modeFlagsArgs: Parameters<typeof useExamModeFlags>[0];
  securityStep: number;
  storageSyncArgs: Parameters<typeof useExamStorageSync>[0];
};

export default function useExamControllerCore({
  modeFlagsArgs,
  securityStep,
  storageSyncArgs,
}: UseExamControllerCoreArgs) {
  const {
    isSurvival,
    isStandard,
  } = useExamModeFlags(modeFlagsArgs);

  useExamSecurityActivation(securityStep);
  useExamStorageSync(storageSyncArgs);

  return {
    isSurvival,
    isStandard,
  };
}
