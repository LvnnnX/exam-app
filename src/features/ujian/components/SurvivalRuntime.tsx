'use client';

import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { SURVIVAL_LIVES, VIOLATION_LIMIT } from '../logic';
import type { UjianState } from '../types';
import { useAntiCheat } from '../hooks/useAntiCheat';
import { useUjianSession } from '../hooks/useUjianSession';
import ExamHeader from './ExamHeader';
import Modal from './Modal';
import QuestionCard from './QuestionCard';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, ErrorBlock, LoadingBlock } from './ui';

interface SurvivalRuntimeProps {
  sessionId: string;
  secret: string;
  initialState?: UjianState | null;
  onFinished: () => void;
}

interface FeedbackState {
  correct: boolean;
  score: number;
}

export default function SurvivalRuntime({ sessionId, secret, initialState, onFinished }: SurvivalRuntimeProps) {
  const session = useUjianSession({ sessionId, secret, initialState, onFinished });
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [confirmSurrenderOpen, setConfirmSurrenderOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const antiCheat = useAntiCheat({
    sessionId,
    secret,
    enabled: Boolean(session.state && session.state.status === 'active'),
    onTerminated: onFinished,
  });

  const state = session.state;
  const q = session.question;
  if (!state) return <LoadingBlock label="Menyiapkan arena survival..." />;

  const lives = state.lives;

  const handleAnswer = async () => {
    if (!q || !session.localAnswer || submitting) return;
    setSubmitting(true);
    const res = await session.saveAnswer();
    setSubmitting(false);
    if (!res) return;

    if (res.is_correct !== undefined) {
      setFeedback({ correct: res.is_correct, score: res.score ?? (state.score ?? 0) });
      session.applyOptimisticSurvival(res.is_correct);
      setTimeout(() => setFeedback(null), 1200);
    }
  };

  const doSurrender = async () => {
    setSubmitting(true);
    await session.finish('surrender');
    setSubmitting(false);
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
        onSurrender={() => setConfirmSurrenderOpen(true)}
      />

      {/* Bar Nyawa & Skor */}
      <div className="glass flex items-center justify-between rounded-2xl p-4">
        <div
          data-testid="ujian-lives"
          role="status"
          aria-label={`Nyawa ${lives} dari ${SURVIVAL_LIVES}`}
          className="flex items-center gap-1.5"
        >
          {Array.from({ length: SURVIVAL_LIVES }, (_, i) => {
            const active = i < lives;
            return (
              <Heart
                key={i}
                size={22}
                className={`transition-calm ${
                  active ? 'fill-danger text-danger' : 'fill-transparent text-fg-subtle opacity-40'
                }`}
                aria-hidden="true"
              />
            );
          })}
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-medium text-fg-muted">Skor:</span>
          <span data-testid="ujian-score" className="text-[20px] font-bold tabular-nums text-fg">
            {state.score ?? 0}
          </span>
        </div>
      </div>

      {session.loadingQuestion && <LoadingBlock label={`Memuat soal nomor ${(q?.index ?? state.current_index) + 1}...`} />}

      {session.questionError && !session.loadingQuestion && (
        <ErrorBlock title="Gagal memuat soal" detail={session.questionError} onRetry={session.retryLoadQuestion} />
      )}

      {q && !session.loadingQuestion && (
        <QuestionCard
          question={q}
          value={session.localAnswer}
          onChange={session.setLocalAnswer}
          guards={antiCheat.cardGuards}
        />
      )}

      {/* Bar aksi bawah */}
      <footer className="glass-sheet fixed inset-x-0 bottom-0 z-20 flex justify-end border-t border-line p-3 sm:static sm:rounded-3xl sm:border sm:p-4">
        <button
          type="button"
          data-testid="ujian-next"
          disabled={!session.localAnswer || submitting}
          onClick={handleAnswer}
          className={`${BTN_PRIMARY} w-full sm:w-auto`}
        >
          {submitting ? 'Memeriksa...' : 'Jawab'}
        </button>
      </footer>

      {/* Popup feedback jawaban (MOTION 2) */}
      {feedback && (
        <div
          data-testid="ujian-feedback"
          role="status"
          aria-live="assertive"
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-4"
        >
          <div
            className={`clay animate-in flex flex-col items-center gap-1 rounded-3xl p-6 text-center shadow-lg sm:p-8 ${
              feedback.correct ? 'bg-primary text-on-primary' : 'bg-danger text-on-danger'
            }`}
          >
            <span className="text-[26px] font-bold">{feedback.correct ? 'Benar' : 'Salah'}</span>
            <span className="text-[14px] font-semibold opacity-90">
              {feedback.correct ? '+1 skor' : '-1 nyawa'}
            </span>
          </div>
        </div>
      )}

      {confirmSurrenderOpen && (
        <Modal
          title="Yakin ingin menyerah?"
          theme="light"
          onClose={() => setConfirmSurrenderOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setConfirmSurrenderOpen(false)} className={BTN_SECONDARY}>
                Kembali
              </button>
              <button type="button" onClick={doSurrender} disabled={submitting} className={BTN_DANGER}>
                Ya, menyerah
              </button>
            </>
          }
        >
          <p className="text-[14px] text-fg">Sesi survival kamu akan dihentikan dan skor akhir akan dicatat.</p>
        </Modal>
      )}

      {antiCheat.warningCount !== null && (
        <Modal title="Peringatan anti-curang" theme="light" onClose={null}>
          <div className="flex flex-col gap-3 text-center">
            <p className="text-[14px] text-fg">Dilarang berpindah tab saat mode survival berlangsung.</p>
            <p className="font-semibold text-danger">
              Peringatan {antiCheat.warningCount}/{VIOLATION_LIMIT}
            </p>
            {antiCheat.warningCount >= VIOLATION_LIMIT ? (
              <p className="text-[13px] text-danger">Batas pelanggaran terlampaui. Ujian kamu dihentikan otomatis.</p>
            ) : (
              <button type="button" onClick={antiCheat.dismissWarning} className={`${BTN_PRIMARY} mt-2 w-full`}>
                Saya paham, lanjutkan
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
