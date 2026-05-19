"use client";

import { useCallback } from 'react';
import { secureClear } from '@/lib/security';

export default function useExamClearStorage() {
  return useCallback(() => {
    secureClear();
  }, []);
}
