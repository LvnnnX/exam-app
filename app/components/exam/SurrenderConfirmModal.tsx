"use client";

import React from 'react';
import { motion } from 'framer-motion';
import NeumorphButton from '@/app/components/ui/neumorph-button';

type SurrenderConfirmModalProps = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function SurrenderConfirmModal({
  isOpen,
  onCancel,
  onConfirm,
}: SurrenderConfirmModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/95 backdrop-blur-2xl px-4 animate-in fade-in duration-200">
      <motion.div
        layoutId="surrender-expandable"
        transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.9 }}
        className="relative w-full max-w-3xl overflow-hidden rounded-[28px] bg-[#151515] p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-8 lg:p-10"
      >
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#ff4b35]/25 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-[#ff4b35]/15 blur-3xl" aria-hidden="true" />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_320px] lg:items-center">
          <div className="space-y-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#ff4b35]/15 text-[#ff4b35]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4v17" />
                <path d="M4 4h13l-2 4 2 4H4" />
              </svg>
            </span>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Survival mode</p>
              <h3 className="font-display text-[40px] leading-[0.95] tracking-[-0.04em] text-white sm:text-[52px]">
                Menyerah sekarang?
              </h3>
            </div>
            <p className="max-w-md text-[14px] leading-[1.65] tracking-tight text-white/65">
              Sesi survival akan langsung berakhir. Skor saat ini tetap disimpan sebagai hasil akhir.
            </p>
          </div>

          <div className="rounded-[18px] bg-white p-5 text-nike-black shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-nike-red">Confirm surrender</p>
            <p className="mt-2 text-[13px] leading-relaxed text-nike-grey-500">
              Kamu masih bisa lanjut bertahan kalau belum yakin.
            </p>
            <div className="mt-5 space-y-3">
              <NeumorphButton
                type="button"
                intent="danger"
                size="medium"
                fullWidth
                onClick={onConfirm}
                className="h-12"
              >
                Ya, menyerah
              </NeumorphButton>
              <NeumorphButton
                type="button"
                intent="secondary"
                size="medium"
                fullWidth
                onClick={onCancel}
                className="h-12"
              >
                Lanjut bertahan
              </NeumorphButton>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
