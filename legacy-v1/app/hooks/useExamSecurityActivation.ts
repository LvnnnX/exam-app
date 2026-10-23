"use client";

import { useExamSecurity } from '@/app/hooks/useExamSecurity';

export default function useExamSecurityActivation(step: number) {
  const examSecurityActive = step >= 3 && step <= 5;

  useExamSecurity({
    isActive: examSecurityActive,
    enableTabDetection: false,
    enableWakeLock: true,
    onForceSubmit: () => { },
  });
}
