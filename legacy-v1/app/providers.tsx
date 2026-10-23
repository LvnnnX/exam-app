"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { useState } from 'react';

// DESIGN.md motion: calm curve, no spring overshoot. framer-motion skips
// transform and layout animation for visitors who ask for reduced motion.
const CALM_TRANSITION = { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] } as const;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user" transition={CALM_TRANSITION}>
        {children}
      </MotionConfig>
    </QueryClientProvider>
  );
}
