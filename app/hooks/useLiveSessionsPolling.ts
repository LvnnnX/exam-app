"use client";

import { useEffect } from 'react';

type UseLiveSessionsPollingArgs = {
  isAuthenticated: boolean | null;
  isLiveMode: boolean;
  fetchLiveSessions: () => Promise<void>;
  intervalMs?: number;
};

export default function useLiveSessionsPolling({
  isAuthenticated,
  isLiveMode,
  fetchLiveSessions,
  intervalMs = 120000,
}: UseLiveSessionsPollingArgs) {
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isAuthenticated && isLiveMode) {
      interval = setInterval(() => {
        void fetchLiveSessions();
      }, intervalMs);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated, isLiveMode, fetchLiveSessions, intervalMs]);
}
