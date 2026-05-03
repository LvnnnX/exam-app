"use client";

import React, { useEffect } from 'react';

type TabWarningModalProps = {
  /** Current warning count (1 or 2) */
  warningCount: number;
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback when user clicks "Saya Mengerti" */
  onDismiss: () => void;
};

/**
 * Full-screen warning modal shown when a quiz participant switches tabs.
 * Cannot be dismissed by clicking outside or pressing Escape — only via the button.
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
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-6"
      style={{ background: 'rgba(211, 0, 5, 0.15)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
    >
      <div
        className="bg-white rounded-[32px] shadow-[0_32px_80px_-16px_rgba(211,0,5,0.3)] max-w-md w-full border-2 border-nike-red/30 overflow-hidden"
        style={{ animation: 'warningShake 0.5s ease-in-out' }}
      >
        {/* Red accent bar */}
        <div className="h-2 bg-nike-red w-full" />

        <div className="p-8 sm:p-10 text-center">
          {/* Warning icon */}
          <div className="w-20 h-20 bg-nike-red/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-nike-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          {/* Title */}
          <h2 className="font-display text-[36px] sm:text-[42px] text-nike-red leading-[0.9] tracking-[0.03em] uppercase mb-4">
            Peringatan!
          </h2>

          {/* Message */}
          <p className="text-[15px] sm:text-[16px] text-nike-black font-medium leading-relaxed mb-3">
            Anda terdeteksi <span className="font-black text-nike-red">membuka tab/aplikasi lain</span>.
          </p>

          {/* Strike indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  i <= warningCount
                    ? 'bg-nike-red scale-110 shadow-md shadow-nike-red/30'
                    : 'bg-nike-grey-200'
                }`}
              />
            ))}
          </div>

          <div className="bg-nike-red/5 border border-nike-red/15 rounded-[16px] p-4 mb-8">
            <p className="text-[13px] sm:text-[14px] text-nike-black font-bold uppercase tracking-wide mb-1">
              Peringatan {warningCount} dari 2
            </p>
            <p className="text-[12px] sm:text-[13px] text-nike-grey-500 font-medium">
              {remainingChances <= 1
                ? 'Ini adalah peringatan TERAKHIR. Jika terdeteksi sekali lagi, jawaban Anda akan langsung dikumpulkan secara otomatis.'
                : `Anda masih memiliki ${remainingChances - 1} kesempatan. Jika terdeteksi lagi, jawaban Anda akan langsung dikumpulkan.`
              }
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={onDismiss}
            className="w-full h-[56px] rounded-[28px] bg-nike-red text-white text-[15px] font-bold uppercase tracking-widest hover:bg-red-700 active:scale-[0.98] transition-all shadow-lg shadow-nike-red/20"
          >
            Saya Mengerti
          </button>
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes warningShake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-6px); }
          30%, 70% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
