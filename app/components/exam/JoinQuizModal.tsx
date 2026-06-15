"use client";

import React from 'react';
import { motion } from 'framer-motion';
import NeumorphButton from '@/app/components/ui/neumorph-button';

type JoinQuizModalProps = {
  isOpen: boolean;
  quizCodeLength: number;
  quizCode: string;
  codeError: string;
  isCheckingCode: boolean;
  canJoin: boolean;
  onCodeChange: (value: string) => void;
  onJoin: () => void;
  onClose: () => void;
};

export default function JoinQuizModal({
  isOpen,
  quizCodeLength,
  quizCode,
  codeError,
  isCheckingCode,
  canJoin,
  onCodeChange,
  onJoin,
  onClose,
}: JoinQuizModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-dark-overlay fixed inset-0 z-[100] overflow-hidden bg-[#111111] text-white animate-in fade-in duration-200">
      <div className="flex min-h-screen items-center justify-center px-5 py-10">
        <motion.div
          layoutId="join-quiz-expandable"
          transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.9 }}
          className="w-full max-w-5xl rounded-[24px] bg-[#151515] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-8 lg:p-12"
        >
          <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_420px] lg:gap-14">
            <div className="order-1 flex flex-col space-y-5 lg:order-none lg:col-start-1 lg:row-start-1 lg:justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Join live quiz</p>
              <h2 className="font-display text-[42px] leading-[0.95] tracking-[-0.04em] text-white sm:text-[56px]">
                Enter quiz code.
              </h2>
              <p className="max-w-md text-[15px] leading-[1.6] tracking-tight text-white/65">
                Masukkan {quizCodeLength}-digit code dari host untuk masuk ke sesi quiz real-time.
              </p>
            </div>

            <div className="order-3 grid gap-3 sm:grid-cols-2 lg:order-none lg:col-start-1 lg:row-start-2">
              <div className="rounded-[10px] bg-white/5 p-4">
                <p className="text-[12px] font-medium text-white/55">Fast join</p>
                <p className="mt-1 text-[13px] text-white/80">Kode diverifikasi otomatis sebelum masuk.</p>
              </div>
              <div className="rounded-[10px] bg-white/5 p-4">
                <p className="text-[12px] font-medium text-white/55">Live session</p>
                <p className="mt-1 text-[13px] text-white/80">Leaderboard aktif saat quiz dimulai.</p>
              </div>
            </div>

            <div className="order-2 mx-auto w-full max-w-sm rounded-[18px] bg-white p-5 text-nike-black shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:p-6 lg:order-none lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:max-w-none lg:self-center">
              <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.12em] text-nike-grey-500">Quiz code *</p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={quizCodeLength}
                value={quizCode}
                onChange={(e) => onCodeChange(e.target.value)}
                placeholder="000000"
                className={`neumorph-pulse-control h-14 w-full rounded-[8px] px-5 text-center text-[24px] font-semibold tabular-nums tracking-[0.25em] transition-spring-fast focus:outline-none ${codeError ? 'bg-red-50 text-nike-red' : 'bg-black/5 text-nike-black focus:bg-black/10'}`}
              />
              {codeError && (
                <p className="mt-2 text-[12px] font-medium tracking-tight text-nike-red animate-in slide-in-from-top-1">
                  {codeError}
                </p>
              )}

              <div className="mt-6 space-y-3">
                <NeumorphButton
                  type="button"
                  intent="primary"
                  size="medium"
                  fullWidth
                  loading={isCheckingCode}
                  disabled={!canJoin}
                  onClick={onJoin}
                  className="h-12"
                >
                  {isCheckingCode ? 'Verifying…' : 'Join'}
                </NeumorphButton>
                <NeumorphButton
                  type="button"
                  intent="secondary"
                  size="medium"
                  fullWidth
                  onClick={onClose}
                  className="h-12"
                >
                  Cancel
                </NeumorphButton>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
