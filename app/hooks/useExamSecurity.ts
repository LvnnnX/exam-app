"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

type UseExamSecurityOptions = {
  /** Whether the exam is currently active (controls when protections are enabled) */
  isActive: boolean;
  /** Enable tab/window focus detection with 3-strike system (quiz mode only) */
  enableTabDetection: boolean;
  /** Enable screen wake lock to prevent dimming (recommended for all modes) */
  enableWakeLock?: boolean;
  /** Callback fired on the 3rd tab-switch strike — should auto-submit answers */
  onForceSubmit: () => void;
};

type UseExamSecurityReturn = {
  /** Current number of tab-switch warnings (0-2 shown, 3 = auto-submitted) */
  warningCount: number;
  /** Whether the warning modal should be displayed */
  showWarningModal: boolean;
  /** Dismiss the warning modal (user clicks "Saya Mengerti") */
  dismissWarning: () => void;
};

/**
 * Anti-cheat hook for exam security.
 *
 * Features:
 * - Tab/window focus detection with 3-strike system (quiz mode)
 * - Screen Wake Lock API to prevent screen dimming on mobile
 * - Text selection blocking (CSS class toggle on body)
 * - Right-click and keyboard shortcut blocking
 */
export function useExamSecurity({
  isActive,
  enableTabDetection,
  enableWakeLock = false,
  onForceSubmit,
}: UseExamSecurityOptions): UseExamSecurityReturn {
  const [warningCount, setWarningCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const forceSubmitRef = useRef(onForceSubmit);
  // Track whether we're currently showing a modal to prevent double-counting
  const isProcessingRef = useRef(false);

  // Keep the ref in sync so the visibility handler always calls the latest callback
  useEffect(() => {
    forceSubmitRef.current = onForceSubmit;
  }, [onForceSubmit]);

  // ─── A. Tab / Window Focus Detection (3-strike) ───────────────────
  useEffect(() => {
    if (!isActive || !enableTabDetection) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !isProcessingRef.current) {
        isProcessingRef.current = true;

        setWarningCount(prev => {
          const next = prev + 1;
          if (next >= 3) {
            // Strike 3 — auto-submit immediately
            forceSubmitRef.current();
          } else {
            // Strike 1 or 2 — show warning modal
            setShowWarningModal(true);
          }
          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, enableTabDetection]);

  const dismissWarning = useCallback(() => {
    setShowWarningModal(false);
    isProcessingRef.current = false;
  }, []);

  // ─── B. Screen Wake Lock API ──────────────────────────────────────
  useEffect(() => {
    if (!isActive || !enableWakeLock) return;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Silently fail — user may have denied permission or browser doesn't support
      }
    };

    // Re-acquire wake lock when page becomes visible again
    // (browsers auto-release wake lock when tab is hidden)
    const handleVisibilityForWakeLock = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityForWakeLock);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityForWakeLock);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [isActive, enableWakeLock]);

  // ─── C. Text Selection Blocking (CSS class on body) ───────────────
  useEffect(() => {
    if (!isActive) return;

    document.body.classList.add('exam-active');

    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      // Allow selection inside input and textarea elements
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      e.preventDefault();
    };

    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      document.body.classList.remove('exam-active');
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [isActive]);

  // ─── D. Right-Click & Keyboard Shortcut Blocking ──────────────────
  useEffect(() => {
    if (!isActive) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 — Dev Tools
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey; // metaKey for macOS Cmd

      if (ctrl) {
        const key = e.key.toLowerCase();

        // Ctrl+A (select all), Ctrl+C (copy), Ctrl+U (view source)
        if (key === 'a' || key === 'c' || key === 'u') {
          e.preventDefault();
          return;
        }

        // Ctrl+Shift combinations
        if (e.shiftKey) {
          // Ctrl+Shift+I (Dev Tools), Ctrl+Shift+J (Console), Ctrl+Shift+C (Inspector)
          if (key === 'i' || key === 'j' || key === 'c') {
            e.preventDefault();
            return;
          }
        }
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);

  return {
    warningCount,
    showWarningModal,
    dismissWarning,
  };
}
