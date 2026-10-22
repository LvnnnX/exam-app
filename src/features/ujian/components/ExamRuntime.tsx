'use client';

import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { VIOLATION_LIMIT } from '../logic';
import type { UjianState } from '../types';
import { useAntiCheat } from '../hooks/useAntiCheat';
import { useUjianSession } from '../hooks/useUjianSession';
import ExamHeader from './ExamHeader';
import Modal from './Modal';
import QuestionCard from './QuestionCard';
import QuestionNavModal from './QuestionNavModal';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, ErrorBlock, LoadingBlock } from './ui';

interface ExamRuntimeProps {
  sessionId: string;
  secret: string;
  initialState?: UjianState | null;
  onFinished: () => void;
}

export default function ExamRuntime({ sessionId, secret, initialState, onFinished }: ExamRuntimeProps) {
  const session = useUjianSession({ sessionId, secret, initialState, onFinished });
  const [navOpen, setNavOpen] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmSurrenderOpen, setConfirmSurrenderOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const antiCheat = useAntiCheat({
    sessionId,
    secret,
    enabled: Boolean(session.state && session.state.status === 'active'),
    onTerminated: onFinished,
  });

  const state = session.state;
  const q = session.question;
  if (!state) return <LoadingBlock label="Menyiapkan lembar ujian..." />;

  const isStrict = state.nav_mode === 'strict';
  const isLast = q ? q.index + 1 >= state.total : false;
  const isFirst = q ? q.index === 0 : true;

  // Hitung jumlah kosong dan ragu dari answers server + perubahan lokal soal aktif
  const currentMark = q ? { answered: session.localAnswer !== null, doubtful: session.localDoubt } : null;
  const effectiveAnswers = state.answers.map((a) => (q && a.index === q.index ? { ...a, ...currentMark } : a));
  const emptyCount = effectiveAnswers.filter((a) => !a.answered).length;
  const doubtCount = effectiveAnswers.filter((a) => a.doubtful).length;

  const handleNext = async () => {
    if (!q) return;
    setBusy(true);
    const ok = await session.saveAnswer();
    setBusy(false);
    if (!ok && isStrict) return;
    if (isLast) {
      setConfirmSubmitOpen(true);
    } else {
      await session.goTo(q.index + 1);
    }
  };

  const handleSkip = async () => {
    if (!q) return;
    session.setLocalAnswer(null);
    setBusy(true);
    const ok = await session.saveAnswer(null, session.localDoubt);
    setBusy(false);
    if (!ok) return;
    if (isLast) {
      setConfirmSubmitOpen(true);
    } else {
      await session.goTo(q.index + 1);
    }
  };

  const handlePrev = async () => {
    if (!q || isStrict || isFirst) return;
    await session.goTo(q.index - 1);
  };

  const doSubmit = async () => {
    setBusy(true);
    await session.finish('submit');
    setBusy(false);
  };

  const doSurrender = async () => {
    setBusy(true);
    await session.finish('surrender');
    setBusy(false);
  };

  return (
    <div className="flex w-full flex-col gap-4 pb-28 sm:pb-8">
      <ExamHeader
        name={state.name}
        topics={state.topics}
        index={q?.index ?? state.current_index}
        total={state.total}
        seconds={session.seconds}
        saveStatus={session.saveStatus}
        isStandard={!isStrict}
        onSurrender={() => setConfirmSurrenderOpen(true)}
        onOpenNav={() => setNavOpen(true)}
      />

      {session.loadingQuestion && <LoadingBlock label={`Memuat soal nomor ${(q?.index ?? state.current_index) + 1}...`} />}

      {session.questionError && !session.loadingQuestion && (
        <ErrorBlock
          title="Gagal memuat soal"
          detail={session.questionError}
          onRetry={session.retryLoadQuestion}
        />
      )}

      {q && !session.loadingQuestion && (
        <QuestionCard
          question={q}
          value={session.localAnswer}
          onChange={session.setLocalAnswer}
          guards={antiCheat.cardGuards}
        />
      )}

      {/* Bar aksi bawah: sticky di HP supaya jempol selalu sampai, static di tablet/desktop */}
      <footer className="glass-sheet fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 border-t border-line p-3 sm:static sm:rounded-3xl sm:border sm:p-4">
        {isStrict ? (
          <>
            <button
              type="button"
              data-testid="ujian-skip"
              disabled={busy}
              onClick={handleSkip}
              className={BTN_SECONDARY}
            >
              Lewati
            </button>
            <button
              type="button"
              data-testid="ujian-next"
              disabled={busy}
              onClick={handleNext}
              className={BTN_PRIMARY}
            >
              {isLast ? 'Selesai' : 'Lanjut'}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="ujian-back"
                disabled={isFirst || busy}
                onClick={handlePrev}
                className={BTN_SECONDARY}
              >
                Sebelumnya
              </button>
              <button
                type="button"
                data-testid="ujian-doubt"
                aria-pressed={session.localDoubt}
                onClick={() => session.setLocalDoubt(!session.localDoubt)}
                className={`transition-calm inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-[14px] font-semibold ${
                  session.localDoubt ? 'bg-highlight text-on-highlight' : 'well well-hover text-fg'
                }`}
              >
                <Flag size={15} />
                <span className="hidden sm:inline">Ragu-ragu</span>
              </button>
            </div>

            <button
              type="button"
              data-testid={isLast ? 'ujian-finish' : 'ujian-next'}
              disabled={busy}
              onClick={handleNext}
              className={BTN_PRIMARY}
            >
              {isLast ? 'Selesai' : 'Lanjut'}
            </button>
          </>
        )}
      </footer>

      {!isStrict && navOpen && (
        <QuestionNavModal
          total={state.total}
          answers={effectiveAnswers}
          currentIndex={q?.index ?? 0}
          onSelect={(idx) => void session.goTo(idx)}
          onClose={() => setNavOpen(false)}
        />
      )}

      {confirmSubmitOpen && (
        <Modal
          title="Kumpulkan jawaban?"
          theme="light"
          onClose={() => setConfirmSubmitOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setConfirmSubmitOpen(false)} className={BTN_SECONDARY}>
                Periksa lagi
              </button>
              <button type="button" onClick={doSubmit} disabled={busy} className={BTN_PRIMARY}>
                Ya, kumpulkan
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-2 text-[14px] text-fg">
            <p>Setelah dikumpulkan, kamu tidak bisa mengubah jawaban lagi.</p>
            {(emptyCount > 0 || doubtCount > 0) && (
              <p className="rounded-xl bg-highlight/15 p-3 text-[13px] font-medium text-highlight-fg">
                Perhatian: {emptyCount > 0 && `${emptyCount} soal belum dijawab`}
                {emptyCount > 0 && doubtCount > 0 && ', '}
                {doubtCount > 0 && `${doubtCount} soal ditandai ragu-ragu`}.
              </p>
            )}
          </div>
        </Modal>
      )}

      {confirmSurrenderOpen && (
        <Modal
          title="Yakin ingin menyerah?"
          theme="light"
          onClose={() => setConfirmSurrenderOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setConfirmSurrenderOpen(false)} className={BTN_SECONDARY}>
                Kembali ujian
              </button>
              <button type="button" onClick={doSurrender} disabled={busy} className={BTN_DANGER}>
                Ya, menyerah
              </button>
            </>
          }
        >
          <p className="text-[14px] text-fg">
            Ujian akan dihentikan sekarang. Nilai kamu dihitung dari soal yang sudah sempat kamu jawab.
          </p>
        </Modal>
      )}

      {antiCheat.warningCount !== null && (
        <Modal title="Peringatan anti-curang" theme="light" onClose={null}>
          <div className="flex flex-col gap-3 text-center">
            <p className="text-[14px] text-fg">
              Dilarang berpindah tab atau meninggalkan aplikasi saat ujian berlangsung.
            </p>
            <p className="font-semibold text-danger">
              Peringatan {antiCheat.warningCount}/{VIOLATION_LIMIT}
            </p>
            {antiCheat.warningCount >= VIOLATION_LIMIT ? (
              <p className="text-[13px] text-danger">Batas pelanggaran terlampaui. Ujian kamu dihentikan otomatis.</p>
            ) : (
              <button type="button" onClick={antiCheat.dismissWarning} className={`${BTN_PRIMARY} mt-2 w-full`}>
                Saya paham, lanjutkan ujian
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
