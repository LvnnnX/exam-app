"use client";

import React, { useEffect } from 'react';

type TabWarningModalProps = {
  /** Current warning count (1 or 2) */
  warningCount: number;
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when user clicks "Saya mengerti" */
  onDismiss: () => void;
};

/**
 * Full-screen warning modal shown when a quiz participant switches tabs.
 * Cannot be dismissed by clicking outside or pressing Escape, only via the button.
 */
export default function TabWarningModal({ warningCount, isOpen, onDismiss }: TabWarningModalProps) {
  // Block Escape key from dismissing the modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  const remainingChances = 3 - warningCount;

  return (
    <div className="glass-scrim fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tab-warning-title"
        aria-describedby="tab-warning-desc"
        className="glass-sheet w-full max-w-md overflow-hidden rounded-4xl"
        style={{ animation: 'warningShake 0.45s var(--ease-calm)' }}
      >
        <div className="p-7 text-center sm:p-9">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/12 text-danger" aria-hidden="true">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h2 id="tab-warning-title" className="mb-3 text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-danger sm:text-[34px]">
            Peringatan.
          </h2>

          <p id="tab-warning-desc" className="mb-4 text-[15px] font-medium leading-relaxed text-fg sm:text-[16px]">
            Anda terdeteksi <span className="font-bold text-danger">membuka tab/aplikasi lain</span>.
          </p>

          <div className="mb-6 flex items-center justify-center gap-2" role="img" aria-label={`${warningCount} peringatan tercatat`}>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className={`h-3.5 w-3.5 rounded-full transition-calm ${
                  i <= warningCount
                    ? 'bg-danger'
                    : 'well border border-line-strong'
                }`}
              />
            ))}
          </div>

          <div className="mb-7 rounded-2xl bg-danger/8 p-4 text-left">
            <p className="mb-1 text-[14px] font-bold text-fg">
              Peringatan {warningCount} dari 2
            </p>
            <p className="text-[13px] font-medium leading-relaxed text-fg-muted sm:text-[14px]">
              {remainingChances <= 1
                ? <>Ini adalah peringatan <span className="font-bold text-danger">terakhir</span>. Jika terdeteksi sekali lagi, jawaban Anda akan langsung dikumpulkan secara otomatis.</>
                : `Anda masih memiliki ${remainingChances - 1} kesempatan. Jika terdeteksi lagi, jawaban Anda akan langsung dikumpulkan.`
              }
            </p>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="clay-danger h-12 w-full rounded-xl text-[15px] font-semibold"
          >
            Saya mengerti
          </button>
        </div>
      </div>

      <style>{`
        @keyframes warningShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
