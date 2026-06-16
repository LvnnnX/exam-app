import React from 'react';
import { motion } from 'framer-motion';

type AdminTutorialModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: 'quiz' | 'scheduled';
};

type StepItem = {
  label: string;
  body: string;
};

const QUIZ_STEPS: StepItem[] = [
  { label: 'Buat Quiz', body: 'Klik tombol + untuk menambah quiz baru, atur judul, mapel, dan durasi.' },
  { label: 'Kelola Soal', body: 'Tambahkan soal satu per satu atau import dari file excel/csv.' },
  { label: 'Publish', body: 'Klik tombol Publish agar quiz bisa diakses oleh siswa.' },
];

const SCHEDULED_STEPS: StepItem[] = [
  { label: 'Jadwalkan', body: 'Pilih quiz yang sudah ada, tentukan tanggal mulai dan selesai.' },
  { label: 'Monitor', body: 'Pantau peserta yang sedang mengerjakan secara real-time.' },
  { label: 'Hasil', body: 'Skor dan detail jawaban otomatis terekam setelah siswa submit.' },
];

export default function AdminTutorialModal({ isOpen, onClose, type }: AdminTutorialModalProps) {
  if (!isOpen) return null;
  const steps = type === 'quiz' ? QUIZ_STEPS : SCHEDULED_STEPS;
  return (
    <div className="fixed inset-0 z-[150] bg-dark-800/95 backdrop-blur-2xl flex items-center justify-center p-4" onClick={onClose}>
      <motion.div className="bg-white rounded-[28px] max-w-lg w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-[20px] font-display font-semibold mb-4">Tutorial {type === 'quiz' ? 'Quiz' : 'Scheduled Exam'}</h3>
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li key={step.label} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-nike-black text-white text-[12px] font-medium flex items-center justify-center">{i + 1}</span>
              <div>
                <p className="font-semibold text-[14px]">{step.label}</p>
                <p className="text-[13px] text-nike-grey-500">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <button onClick={onClose} className="mt-6 w-full h-10 rounded-full bg-nike-black text-white text-[13px]">Mengerti</button>
      </motion.div>
    </div>
  );
}
