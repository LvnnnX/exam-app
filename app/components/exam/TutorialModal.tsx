"use client";

import React from 'react';
import { X } from 'lucide-react';

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

// Same colors as the real question grid (QuestionNavPopup), at preview size.
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
    <div className="grid grid-cols-6 gap-1.5" aria-hidden="true">
      {cells.map((c) => (
        <span
          key={c.n}
          className={`flex h-7 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums ${
            c.state === 'current'
              ? 'well text-fg ring-2 ring-fg ring-offset-1 ring-offset-canvas'
              : c.state === 'doubt'
                ? 'bg-highlight text-on-highlight'
                : c.state === 'answered'
                  ? 'bg-primary text-on-primary'
                  : 'well text-fg'
          }`}
        >
          {c.n}
        </span>
      ))}
    </div>
  );
}

const previewButton = 'flex h-8 items-center justify-center rounded-lg px-3 text-[11px] font-semibold';

export default function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="glass-scrim fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="glass-sheet animate-in flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-4xl text-fg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 pt-5 pb-4 sm:px-6">
          <div>
            <p className="mb-1 text-[12px] font-medium text-fg-muted">Tutorial</p>
            <h3 id="tutorial-title" className="text-[24px] font-bold leading-[1.05] tracking-[-0.02em] text-fg">
              Cara memulai ujian.
            </h3>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="well well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-calm"
            aria-label="Tutup tutorial"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <p className="mb-5 text-[14px] text-fg-muted">
            Atur sesi ujian dari pilihan berikut, lalu tekan Begin session.
          </p>

          <ol className="space-y-4">
            {SETUP_STEPS.map((step, i) => (
              <li key={step.label} className="flex gap-3">
                <span className="clay mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-fg">{step.label}</p>
                  <p className="text-[13px] leading-relaxed text-fg-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-7 border-t border-line pt-5">
            <h4 className="mb-1 text-[17px] font-bold tracking-tight text-fg">Saat menjawab soal.</h4>
            <p className="mb-4 text-[13px] text-fg-muted">
              Tampilan saat ujian berbeda tergantung mode navigasi.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="well rounded-2xl p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-fg">Strict</span>
                  <span className="well inline-flex h-5 items-center rounded-md px-2 text-[11px] font-medium text-fg-muted">
                    berurutan
                  </span>
                </div>
                <ul className="mb-3 space-y-1.5 text-[13px] leading-relaxed text-fg-muted">
                  <li>Soal muncul satu per satu dan harus dijawab dulu.</li>
                  <li>Tombol Next question aktif setelah memilih jawaban.</li>
                  <li>Tidak ada tombol Back, jawaban tidak bisa diubah.</li>
                  <li>Mode Exam punya tombol Skip, mode Survival punya Surrender.</li>
                </ul>
                <div className="glass-sheet flex gap-1.5 rounded-xl p-2.5" aria-hidden="true">
                  <span className={`${previewButton} clay-primary flex-1`}>Next question</span>
                  <span className={`${previewButton} well text-fg-muted`}>Skip</span>
                </div>
              </div>

              <div className="well rounded-2xl p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-fg">Standard</span>
                  <span className="well inline-flex h-5 items-center rounded-md px-2 text-[11px] font-medium text-fg-muted">
                    bebas
                  </span>
                </div>
                <ul className="mb-3 space-y-1.5 text-[13px] leading-relaxed text-fg-muted">
                  <li>Bisa pindah ke soal mana pun lewat Daftar soal.</li>
                  <li>Tombol Back, Ragu-ragu, dan Next tersedia.</li>
                  <li>Soal ragu ditandai kuning, terjawab hijau, kosong abu.</li>
                  <li>Tekan Finish di soal terakhir untuk menyelesaikan.</li>
                </ul>
                <div className="glass-sheet space-y-2 rounded-xl p-2.5">
                  <MiniNavGrid variant="doubt" />
                  <div className="flex gap-1.5" aria-hidden="true">
                    <span className={`${previewButton} well flex-1 text-fg`}>Back</span>
                    <span className={`${previewButton} clay-highlight flex-1`}>Ragu-ragu</span>
                    <span className={`${previewButton} clay-primary flex-1`}>Next</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-medium text-fg-muted">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-primary" aria-hidden="true" /> Terjawab</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-highlight" aria-hidden="true" /> Ragu</span>
              <span className="flex items-center gap-1.5"><span className="well h-3 w-3 rounded-[4px] border border-line-strong" aria-hidden="true" /> Kosong</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] ring-2 ring-fg" aria-hidden="true" /> Soal aktif</span>
            </div>
          </div>

          <div className="mt-7 border-t border-line pt-5">
            <h4 className="mb-1 text-[17px] font-bold tracking-tight text-fg">Setelah selesai.</h4>
            <p className="mb-4 text-[13px] text-fg-muted">
              Begitu ujian selesai, hasil langsung dihitung.
            </p>
            <ul className="space-y-2.5 text-[13px] leading-relaxed text-fg-muted">
              <li>
                <span className="font-semibold text-fg">Skor</span> ditampilkan dalam persen (mode Exam) atau jumlah jawaban benar (mode Survival).
              </li>
              <li>
                <span className="font-semibold text-fg">Ringkasan per soal</span> bisa dibuka lewat Lihat ringkasan untuk mengecek jawaban kamu satu per satu.
              </li>
              <li>
                <span className="font-semibold text-fg">Batas lulus 70 persen.</span> Skor di bawah itu ditandai berbeda, jadi kamu tahu perlu belajar lagi.
              </li>
            </ul>
            <div className="well mt-4 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3">
              <span className="inline-flex h-6 items-center rounded-md bg-primary/12 px-2.5 text-[12px] font-semibold tabular-nums text-primary">
                70% ke atas
              </span>
              <span className="text-[13px] text-fg-muted">lulus</span>
              <span className="text-fg-subtle" aria-hidden="true">·</span>
              <span className="well inline-flex h-6 items-center rounded-md px-2.5 text-[12px] font-semibold tabular-nums text-fg">
                di bawah 70%
              </span>
              <span className="text-[13px] text-fg-muted">belum lulus</span>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-line px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
