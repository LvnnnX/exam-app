'use client';

import { useEffect, useRef, useState } from 'react';
import { reportUjianViolationAction } from '../actions';
import { VIOLATION_LIMIT } from '../logic';

const TERMINATE_NOTICE_MS = 2000;

interface AntiCheatOptions {
  sessionId: string;
  secret: string;
  enabled: boolean;
  onTerminated: () => void;
}

export function useAntiCheat({ sessionId, secret, enabled, onTerminated }: AntiCheatOptions) {
  const [warningCount, setWarningCount] = useState<number | null>(null);
  const onTerminatedRef = useRef(onTerminated);

  useEffect(() => {
    onTerminatedRef.current = onTerminated;
  }, [onTerminated]);

  // 1. Wake Lock API (KL-16)
  useEffect(() => {
    if (!enabled) return;
    let wakeLock: { release: () => Promise<void> } | null = null;
    const nav = typeof navigator !== 'undefined' ? (navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    }) : null;
    nav?.wakeLock?.request('screen').then((lock) => {
      wakeLock = lock;
    }).catch(() => {
      /* denied / not supported */
    });
    return () => {
      wakeLock?.release().catch(() => {});
    };
  }, [enabled]);

  // 2. Tab switch detection
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = async () => {
      if (!document.hidden) return;
      try {
        const res = await reportUjianViolationAction(sessionId, secret);
        if (!res.success) return;
        const count = res.data.violation_count;
        setWarningCount(count);
        if (res.data.finished || count >= VIOLATION_LIMIT) {
          // Keep the 3/3 warning on screen briefly so the student sees why the exam stopped.
          setTimeout(() => onTerminatedRef.current(), TERMINATE_NOTICE_MS);
        }
      } catch {
        /* abaikan kegagalan jaringan pelaporan */
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, sessionId, secret]);

  const dismissWarning = () => setWarningCount(null);

  return {
    warningCount,
    dismissWarning,
    cardGuards: {
      onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
      onCut: (e: React.ClipboardEvent) => e.preventDefault(),
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}
