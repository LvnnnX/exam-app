"use client";

import React from 'react';
import { motion } from 'framer-motion';

type TutorialModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type StepItem = {
  label: string;
  body: string;
};

const SETUP_STEPS: StepItem[] = [
  {
    label: 'Mode',
    body: 'Pilih Exam untuk ujian biasa, atau Survival kalau mau pakai nyawa terbatas. Salah jawab di Survival mengurangi nyawa, dan sesi berakhir saat nyawa habis.',
  },
  {
    label: 'Navigation',
    body: 'Hanya muncul di mode Exam. Strict berarti soal berurutan dan tidak bisa kembali. Standard berarti bebas pindah soal dan bisa menandai soal ragu-ragu.',
  },
  {
    label: 'Your name',
    body: 'Nama yang ditampilkan di papan skor (leaderboard). Maksimal 16 karakter.',
  },
  {
    label: 'Mapel',
    body: 'Pilih satu atau beberapa mata pelajaran yang ingin diujikan. Wajib diisi sebelum mulai.',
  },
  {
    label: 'Bab',
    body: 'Bab materi dari mapel yang dipilih. Aktif setelah minimal satu mapel dipilih.',
  },
  {
    label: 'Sub-bab',
    body: 'Sub-bab materi dari bab yang dipilih. Aktif setelah minimal satu bab dipilih.',
  },
  {
    label: 'Time limit',
    body: 'Batas waktu untuk seluruh soal. Pilih No Time kalau tidak mau ada hitungan mundur.',
  },
  {
    label: 'Question count',
    body: 'Jumlah soal yang dikerjakan. Pilihannya 5 sampai 100 soal.',
  },
];

function MiniNavGrid({ variant }: { variant: 'doubt' | 'plain' }) {
  const cells = [
    { n: 1, state: 'answered' },
    { n: 2, state: variant === 'doubt' ? 'doubt' : 'answered' },
    { n: 3, state: 'current' },
    { n: 4, state: 'empty' },
    { n: 5, state: 'empty' },
    { n: 6, state: 'empty' },
  ] as const;
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {cells.map((c) => (
        <span
          key={c.n}
          className={`h-7 rounded-lg text-[11px] font-medium tabular-nums flex items-center justify-center ${
            c.state === 'current'
              ? 'bg-black/5 text-nike-black ring-2 ring-nike-black ring-offset-1'
              : c.state === 'doubt'
                ? 'bg-yellow-400 text-nike-black'
                : c.state === 'answered'
                  ? 'bg-nike-black text-white'
                  : 'bg-black/5 text-nike-black'
          }`}
        >
          {c.n}
        </span>
      ))}
    </div>
  );
}

export default function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[150] bg-[#111111]/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-200">
      <motion.div
        layoutId="tutorial-expandable"
        transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.9 }}
        className="bg-white rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.45)] max-w-2xl w-full overflow-hidden flex flex-col max-h-[88vh]"
      >
        <div className="px-6 pt-6 pb-4 border-b border-black/[0.06] flex items-start justify-between gap-4 shrink-0">
          <div>
            <p className="text-[12px] font-medium text-nike-grey-500 mb-1 tracking-tight">Tutorial</p>
            <h3 className="font-display text-[24px] leading-[1.05] tracking-[-0.02em] text-nike-black">
              Cara memulai ujian.
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-spring-fast active:scale-90 shrink-0"
            aria-label="Tutup tutorial"
          >
            <svg className="w-3.5 h-3.5 text-nike-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">
          <p className="text-[13px] text-nike-grey-500 tracking-tight mb-5">
            Atur sesi ujian dari pilihan berikut, lalu tekan Begin session.
          </p>

          <ol className="space-y-4">
            {SETUP_STEPS.map((step, i) => (
              <li key={step.label} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-nike-black text-white text-[12px] font-medium flex items-center justify-center tabular-nums mt-0.5">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-nike-black tracking-tight">{step.label}</p>
                  <p className="text-[13px] text-nike-grey-500 leading-relaxed tracking-tight">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-7 pt-5 border-t border-black/[0.06]">
            <h4 className="text-[16px] font-semibold text-nike-black tracking-tight mb-1">Saat menjawab soal.</h4>
            <p className="text-[13px] text-nike-grey-500 tracking-tight mb-4">
              Tampilan saat ujian berbeda tergantung mode navigasi.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-black/[0.03] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] font-semibold text-nike-black tracking-tight">Strict</span>
                  <span className="inline-flex items-center px-2 h-5 rounded-full bg-black/5 text-[10px] font-medium text-nike-grey-500 tracking-tight">
                    berurutan
                  </span>
                </div>
                <ul className="space-y-1.5 text-[12px] text-nike-grey-500 leading-relaxed tracking-tight mb-3">
                  <li>Soal muncul satu per satu dan harus dijawab dulu.</li>
                  <li>Tombol Next question aktif setelah memilih jawaban.</li>
                  <li>Tidak ada tombol Back, jawaban tidak bisa diubah.</li>
                  <li>Mode Exam punya tombol Skip, mode Survival punya Surrender.</li>
                </ul>
                <div className="rounded-xl bg-white border border-black/[0.06] p-2.5 flex gap-1.5">
                  <span className="flex-1 h-8 rounded-full bg-nike-black text-white text-[11px] font-medium flex items-center justify-center tracking-tight">
                    Next question
                  </span>
                  <span className="px-3 h-8 rounded-full bg-black/5 text-nike-grey-500 text-[11px] font-medium flex items-center justify-center tracking-tight">
                    Skip
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-black/[0.03] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] font-semibold text-nike-black tracking-tight">Standard</span>
                  <span className="inline-flex items-center px-2 h-5 rounded-full bg-black/5 text-[10px] font-medium text-nike-grey-500 tracking-tight">
                    bebas
                  </span>
                </div>
                <ul className="space-y-1.5 text-[12px] text-nike-grey-500 leading-relaxed tracking-tight mb-3">
                  <li>Bisa pindah ke soal mana pun lewat Daftar soal.</li>
                  <li>Tombol Back, Ragu-ragu, dan Next tersedia.</li>
                  <li>Soal ragu ditandai kuning, terjawab hitam, kosong abu.</li>
                  <li>Tekan Finish di soal terakhir untuk menyelesaikan.</li>
                </ul>
                <div className="rounded-xl bg-white border border-black/[0.06] p-2.5 space-y-2">
                  <MiniNavGrid variant="doubt" />
                  <div className="flex gap-1.5">
                    <span className="flex-1 h-8 rounded-full bg-black/5 text-nike-black text-[11px] font-medium flex items-center justify-center tracking-tight">
                      Back
                    </span>
                    <span className="flex-1 h-8 rounded-full bg-yellow-400 text-nike-black text-[11px] font-medium flex items-center justify-center tracking-tight">
                      Ragu-ragu
                    </span>
                    <span className="flex-1 h-8 rounded-full bg-nike-black text-white text-[11px] font-medium flex items-center justify-center tracking-tight">
                      Next
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-medium text-nike-grey-500 tracking-tight">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-nike-black"></span> Terjawab</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span> Ragu</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-black/10"></span> Kosong</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-black/[0.06] shrink-0">
          <button
            onClick={onClose}
            className="w-full h-11 rounded-full bg-nike-black text-white text-[13px] font-medium hover:bg-nike-grey-500 transition-spring-fast active:scale-[0.98] tracking-tight shadow-ios-sm"
          >
            Mengerti
          </button>
        </div>
      </motion.div>
    </div>
  );
}
