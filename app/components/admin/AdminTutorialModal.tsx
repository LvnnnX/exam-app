"use client";

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

type AdminTutorialModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: 'quiz' | 'scheduled';
};

type StepItem = {
  label: string;
  body: string;
};

// Steps describe the controls that exist in AdminQuizTab and ScheduledExamTabPanel.
const QUIZ_STEPS: StepItem[] = [
  { label: 'Pilih topik', body: 'Di tab Create, pilih mapel, bab, dan sub-bab. Atur jumlah soal, durasi, dan mode navigasi Strict atau Standard.' },
  { label: 'Buat kuis', body: 'Tekan Buat kuis. Sistem membuat kode 6 digit yang dibagikan ke siswa lewat Join with code.' },
  { label: 'Pantau live', body: 'Di tab Manage, mulai kuis, pantau pemain dan leaderboard, lalu akhiri saat selesai. Sesi yang selesai pindah ke History.' },
];

const SCHEDULED_STEPS: StepItem[] = [
  { label: 'Buat ujian', body: 'Di tab Create, isi judul, kode akses (atau tekan Acak), topik, jumlah soal, batas waktu, dan jendela waktu mulai sampai selesai.' },
  { label: 'Bagikan kode', body: 'Siswa masuk lewat Ujian terjadwal di halaman depan memakai kode akses, hanya selama jendela waktu terbuka.' },
  { label: 'Pantau dan nilai', body: 'Di tab Manage, tekan Lihat untuk melihat peserta, skor live, bank soal, dan jawaban tiap peserta. Ujian yang ditutup pindah ke History.' },
];

export default function AdminTutorialModal({ isOpen, onClose, type }: AdminTutorialModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const steps = type === 'quiz' ? QUIZ_STEPS : SCHEDULED_STEPS;
  return (
    <div className="glass-scrim fixed inset-0 z-[150] flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-tutorial-title"
        className="glass-sheet animate-in w-full max-w-lg rounded-4xl p-6 text-fg"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-fg-muted">Tutorial</p>
            <h3 id="admin-tutorial-title" className="mt-0.5 text-[20px] font-bold tracking-tight text-fg">
              {type === 'quiz' ? 'Kuis live' : 'Ujian terjadwal'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup tutorial"
            className="well well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-calm"
          >
            <X size={16} />
          </button>
        </div>
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li key={step.label} className="flex gap-3">
              <span className="clay mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold tabular-nums">{i + 1}</span>
              <div>
                <p className="text-[14px] font-semibold text-fg">{step.label}</p>
                <p className="text-[13px] leading-relaxed text-fg-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onClose} className="clay-primary mt-6 h-12 w-full rounded-xl text-[15px] font-semibold">
          Mengerti
        </button>
      </div>
    </div>
  );
}
