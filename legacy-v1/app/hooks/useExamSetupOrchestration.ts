"use client";

import useExamBootstrap from '@/app/hooks/useExamBootstrap';
import useExamCategoryOptions from '@/app/hooks/useExamCategoryOptions';

type UseExamSetupOrchestrationArgs = {
  bootstrapArgs: Parameters<typeof useExamBootstrap>[0];
  categoryOptionsArgs: Parameters<typeof useExamCategoryOptions>[0];
};

export default function useExamSetupOrchestration({
  bootstrapArgs,
  categoryOptionsArgs,
}: UseExamSetupOrchestrationArgs) {
  useExamBootstrap(bootstrapArgs);
  useExamCategoryOptions(categoryOptionsArgs);
}
