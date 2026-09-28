"use client";

import React, { use, useEffect } from 'react';
import { motion } from 'framer-motion';
import { secureSave } from '@/lib/security';
import { formatHMS } from '@/lib/quiz';
import RichContent from '@/app/components/RichContent';
import TabWarningModal from '@/app/components/TabWarningModal';
import LeaderboardViewModal from '@/app/components/LeaderboardViewModal';
import EditHorseModal from '@/app/components/EditHorseModal';
import { getHorseSkin } from '@/lib/horse-skins';
import HorseAvatar from '@/app/components/HorseAvatar';
import { formatCategorySelectionLabel } from '@/lib/categories';
import CrownIcon from '@/app/components/CrownIcon';
import { QuestionGridLegend, questionTileClass } from '@/app/components/exam/QuestionNavPopup';
import useQuizSessionController from '@/app/hooks/useQuizSessionController';

function splitTopicLabels(raw: string | null | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((v) => formatCategorySelectionLabel(v));
}

function TopicRows({ tiers }: { tiers: ReadonlyArray<{ label: string; raw: string | null | undefined }> }) {
  return (
    <div className="space-y-1.5">
      {tiers.map(({ label, raw }) => {
        const items = splitTopicLabels(raw);
        if (items.length === 0) {
          return (
            <div key={label} className="flex items-baseline gap-2">
              <span className="w-11 shrink-0 text-left text-[12px] font-medium text-fg-muted">{label}</span>
              <span className="text-[14px] font-medium text-fg-subtle">None</span>
            </div>
          );
        }
        const [first, ...rest] = items;
        return (
          <div key={label} className="flex min-w-0 items-baseline gap-2">
            <span className="w-11 shrink-0 text-left text-[12px] font-medium text-fg-muted">{label}</span>
            <span className="truncate text-[14px] font-semibold text-fg">{first}</span>
            {rest.length > 0 && (
              <span
                title={items.join(', ')}
                className="well inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums text-fg-muted"
              >
                +{rest.length}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CenteredStatus({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6" role="status" aria-live="polite">
      <div className="glass flex flex-col items-center rounded-3xl px-8 py-7 text-center">
        <span className="spinner-calm mb-4 h-6 w-6" aria-hidden="true" />
        <p className="text-[15px] font-semibold text-fg">{title}</p>
        {detail && <p className="mt-1 text-[13px] text-fg-muted">{detail}</p>}
      </div>
    </div>
  );
}

export default function QuizSessionPage({ params }: { params: Promise<{ code: string }> }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { meta, state, setters, actions } = useQuizSessionController(code);

  const {
    quizCode,
    router,
    isStandard,
    leaderboardRowRefs,
  } = meta;

  const {
    session,
    player,
    name,
    currentQuestion,
    currentIndex,
    score,
    isFinished,
    leaderboard,
    loading,
    timeLeftDisplay,
    waitTimer,
    selectedAnswer,
    loadError,
    doubtFlags,
    localAnswers,
    showNavPopup,
    showSubmitConfirm,
    isEditHorseModalOpen,
    showLeaderboardView,
    changingHorseSkin,
    warningCount,
    showWarningModal,
  } = state;

  const {
    setName,
    setSelectedAnswer,
    setDoubtFlags,
    setShowNavPopup,
    setShowSubmitConfirm,
    setIsEditHorseModalOpen,
    setShowLeaderboardView,
  } = setters;

  const {
    dismissWarning,
    handleJoin,
    handleHorseSkinChange,
    handleAnswer,
    goToQuizQuestion,
    finishStandardQuiz,
  } = actions;

  // Escape closes the submit confirm first, then the question grid. The tab
  // warning swallows Escape in the capture phase, so it never reaches here.
  useEffect(() => {
    if (!showNavPopup && !showSubmitConfirm) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showSubmitConfirm) setShowSubmitConfirm(false);
      else setShowNavPopup(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNavPopup, showSubmitConfirm, setShowNavPopup, setShowSubmitConfirm]);

  if (loading) return <CenteredStatus title="Memuat kuis…" />;
  if (!session) return <CenteredStatus title="Mengalihkan…" detail="Kuis tidak ditemukan." />;

  const topicTiers = [
    { label: 'Mapel', raw: session.mapel },
    { label: 'Bab', raw: session.bab },
    { label: 'Sub', raw: session.sub_bab },
  ] as const;

  if (isFinished) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-6 pb-12 sm:px-6 md:pt-10">
        <div className="mx-auto w-full max-w-2xl">
          {/* Header */}
          <div className="mb-6">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-primary/12 px-2.5 text-[12px] font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              Live result
            </span>
            <h2 className="mt-3 text-[32px] font-bold leading-[1.05] tracking-[-0.02em] text-fg sm:text-[40px]">
              Leaderboard.
            </h2>
            <p className="mt-1 text-[14px] text-fg-muted">
              Hasil akhir untuk semua peserta.
            </p>
          </div>

          {/* Summary card */}
          <div className="glass mb-4 flex flex-col gap-4 rounded-3xl px-5 py-5">
            {player && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="clay flex h-12 min-w-12 items-center justify-center rounded-xl px-2 text-[20px] font-bold tabular-nums">
                    {score}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-fg-muted">Skor kamu</p>
                    <p className="text-[14px] font-semibold tabular-nums text-fg">dari {session.question_count} soal</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLeaderboardView(true)}
                  className="clay-primary h-11 shrink-0 rounded-xl px-5 text-[14px] font-semibold"
                >
                  Race view
                </button>
              </div>
            )}

            {player && <div className="h-px bg-line" aria-hidden="true" />}

            <div>
              <p className="mb-2 text-[12px] font-medium text-fg-muted">Topik</p>
              <TopicRows tiers={topicTiers} />
            </div>
          </div>

          {/* Leaderboard list */}
          {leaderboard.length === 0 ? (
            <div className="glass mb-5 rounded-3xl px-5 py-8 text-center">
              <p className="text-[15px] font-semibold text-fg">Belum ada peserta.</p>
              <p className="mt-1 text-[13px] text-fg-muted">Daftar ini terisi otomatis saat peserta bergabung.</p>
            </div>
          ) : (
            <div className="glass mb-5 overflow-hidden rounded-3xl p-1.5" role="list">
              {leaderboard.map((lb, idx) => {
                const isMe = lb.id === player?.id;
                const rank = idx + 1;
                const showCrown = rank <= 3;
                const pending = isStandard && !lb.finished_at;
                return (
                  <div
                    key={lb.id}
                    role="listitem"
                    ref={(element) => { leaderboardRowRefs.current[lb.id] = element; }}
                    className={`flex transform-gpu items-center gap-3 rounded-2xl px-3 py-2.5 will-change-transform transition-calm ${
                      isMe ? 'bg-highlight/15' : ''
                    }`}
                  >
                    <span className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold tabular-nums ${
                      rank === 1 ? 'clay-highlight' : 'clay'
                    }`}>
                      {rank}
                    </span>

                    <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-fg">
                      {lb.name}
                      {isMe && (
                        <span className="ml-2 text-[12px] font-semibold text-highlight-fg">Kamu</span>
                      )}
                    </p>

                    {showCrown && (
                      <CrownIcon rank={rank as 1 | 2 | 3} className="shrink-0 text-[20px]" />
                    )}

                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-bold leading-none tabular-nums text-fg">
                        {pending ? '?' : lb.score}
                        <span className="ml-1 text-[12px] font-medium text-fg-muted">
                          / {session.question_count}
                        </span>
                      </p>
                      <p className="mt-1 text-[12px] font-medium tabular-nums text-fg-muted">
                        {pending ? 'Mengerjakan' : formatHMS(lb.total_time)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <button
            type="button"
            onClick={() => router.push('/')}
            className="well well-hover h-12 w-full rounded-xl text-[14px] font-medium text-fg transition-calm"
          >
            Kembali ke beranda
          </button>

          <LeaderboardViewModal
            open={showLeaderboardView && !!session}
            session={session}
            players={leaderboard}
            onClose={() => setShowLeaderboardView(false)}
          />
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-danger/10 px-2.5 text-[12px] font-semibold text-danger">
              <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />
              Live quiz
            </span>
            <h2 className="mt-4 text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-fg sm:text-[34px]">
              Gabung ke kuis.
            </h2>
            <p className="mt-1 text-[14px] text-fg-muted">
              Masukkan namamu untuk masuk ruang tunggu.
            </p>
          </div>

          <div className="glass rounded-3xl p-5">
            <p className="mb-2 text-[12px] font-medium text-fg-muted">Topik</p>
            <div className="well mb-5 rounded-2xl px-3.5 py-3">
              <TopicRows tiers={topicTiers} />
            </div>

            <label htmlFor="quiz-player-name" className="mb-2 block text-[13px] font-medium text-fg-muted">Nama kamu</label>
            <input
              id="quiz-player-name"
              type="text"
              placeholder="Tulis nama lengkap"
              value={name}
              maxLength={24}
              onChange={e => setName(e.target.value.slice(0, 24))}
              className="well mb-3 h-12 w-full rounded-xl px-4 text-[15px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={!name.trim() || loading}
              className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold"
            >
              {loading ? 'Menyambungkan…' : 'Masuk ruang tunggu'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'waiting') {
    const skin = getHorseSkin(player?.horse_skin, player?.id);
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 text-center">
            <span className="well inline-flex h-7 items-center gap-2 rounded-lg px-2.5 text-[12px] font-semibold text-fg-muted">
              <span className="spinner-calm h-3 w-3" aria-hidden="true" />
              Ruang tunggu
            </span>
            <h2 className="mt-4 text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-fg sm:text-[34px]">
              Menunggu admin.
            </h2>
            <p className="mt-1 text-[14px] text-fg-muted" role="status" aria-live="polite">
              Kuis akan segera dimulai.
            </p>
          </div>

          <div className="glass rounded-3xl p-5">
            {waitTimer && (
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-4">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-fg-muted">Mulai otomatis</p>
                  <p className="text-[14px] font-semibold text-fg">Kuis akan dimulai dalam</p>
                </div>
                <span className="clay shrink-0 rounded-xl px-3.5 py-2 text-[22px] font-bold leading-none tabular-nums">
                  {waitTimer}
                </span>
              </div>
            )}

            <div className="mb-4 flex items-center gap-3">
              <div className="clay flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl">
                <HorseAvatar colors={skin.horse} mount={skin.mount} size="md" animate={true} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-fg-muted">Pemain</p>
                <p className="truncate text-[16px] font-bold text-fg">{player?.name || 'Tamu'}</p>
              </div>
              {/* Morphs into EditHorseModal (shared layoutId). */}
              <motion.button
                type="button"
                layoutId="edit-horse-expandable"
                onClick={() => setIsEditHorseModalOpen(true)}
                disabled={changingHorseSkin || !player}
                className="well well-hover h-11 shrink-0 rounded-xl px-4 text-[14px] font-medium text-fg transition-calm disabled:opacity-50"
              >
                {changingHorseSkin ? 'Tunggu…' : 'Ubah'}
              </motion.button>
            </div>

            <div className="well rounded-2xl px-3.5 py-3">
              <p className="mb-2 text-[12px] font-medium text-fg-muted">Topik</p>
              <TopicRows tiers={topicTiers} />
            </div>
          </div>
        </div>

        {/* Edit Horse Skin Modal */}
        {player && (
          <EditHorseModal
            isOpen={isEditHorseModalOpen}
            onClose={() => setIsEditHorseModalOpen(false)}
            onSave={handleHorseSkinChange}
            currentSkinId={player.horse_skin ?? null}
          />
        )}
      </div>
    );
  }

  // Active Quiz Playing
  const q = currentQuestion;
  if (!q) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        {loadError ? (
          <div className="glass animate-in max-w-sm rounded-3xl px-7 py-8 text-center" role="alert">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/12 text-danger" aria-hidden="true">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mb-2 text-[24px] font-bold tracking-tight text-fg">Waduh, soal gagal dimuat.</h2>
            <p className="mx-auto mb-6 max-w-xs text-[14px] text-fg-muted">{loadError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="clay-primary h-12 rounded-xl px-8 text-[15px] font-semibold"
            >
              Segarkan halaman
            </button>
          </div>
        ) : (
          <CenteredStatus title="Menyiapkan soal…" />
        )}
      </div>
    );
  }

  const textLength = q.question_text.replace(/<[^>]*>/g, '').length;
  const fontSizeClass = textLength > 500 ? 'text-[14px] md:text-[16px]' :
    textLength > 250 ? 'text-[15px] md:text-[18px]' :
      'text-[16px] md:text-[20px]';

  const renderTopicSegment = (items: string[]) => {
    if (items.length === 0) return <span className="text-fg-subtle">None</span>;
    const [first, ...rest] = items;
    return (
      <span title={items.join(', ')} className="inline-flex min-w-0 items-baseline gap-1">
        <span className="truncate">{first}</span>
        {rest.length > 0 && (
          <span className="well inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums text-fg-muted">
            +{rest.length}
          </span>
        )}
      </span>
    );
  };
  const totalQuestions = session?.question_count || 0;
  const isLastQuestion = currentIndex >= totalQuestions - 1;
  const hasAnswer = Boolean(selectedAnswer && selectedAnswer.trim().length > 0);

  return (
    <div className="relative flex flex-1 flex-col px-4 pt-5 pb-12 sm:px-6 md:pt-8 md:pb-16">
      {session.status === 'paused' && (
        <div className="glass-scrim fixed inset-0 z-[9999] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="quiz-paused-title">
          <div className="glass-sheet animate-in max-w-[300px] rounded-4xl px-8 py-7 text-center">
            <div className="clay mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" aria-hidden="true">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            </div>
            <h1 id="quiz-paused-title" className="mb-1 text-[22px] font-bold tracking-tight text-fg">Kuis dijeda</h1>
            <p className="text-[13px] font-medium text-fg-muted">Menunggu admin melanjutkan.</p>
          </div>
        </div>
      )}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
        {/* Status header */}
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="break-words text-[17px] font-bold tracking-tight text-fg">
              {player.name}
            </span>
            <div className="flex min-w-0 flex-wrap items-baseline gap-1.5 text-[12px] font-medium text-fg-muted">
              {renderTopicSegment(splitTopicLabels(session.mapel))}
              <span className="text-fg-subtle" aria-hidden="true">·</span>
              {renderTopicSegment(splitTopicLabels(session.bab))}
              <span className="text-fg-subtle" aria-hidden="true">·</span>
              {renderTopicSegment(splitTopicLabels(session.sub_bab))}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {timeLeftDisplay && (
              <div className="well inline-flex h-11 items-center gap-2 rounded-xl px-3.5" aria-label={`Sisa waktu ${timeLeftDisplay}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-danger animate-pulse" aria-hidden="true"></span>
                <span className="text-[14px] font-bold tabular-nums text-fg">{timeLeftDisplay}</span>
              </div>
            )}

            {isStandard && (
              <motion.button
                type="button"
                layoutId="quiz-question-nav-expandable"
                onClick={() => setShowNavPopup(true)}
                className="well well-hover flex h-11 items-center justify-center gap-2 rounded-xl px-3.5 text-fg transition-calm"
                aria-label="Daftar soal"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden text-[13px] font-semibold sm:block">Daftar soal</span>
              </motion.button>
            )}

            {hasAnswer ? (
              <span className="inline-flex h-11 items-center whitespace-nowrap rounded-xl bg-primary/12 px-3.5 text-[13px] font-semibold text-primary">
                Tersimpan
              </span>
            ) : (
              <span className="well inline-flex h-11 items-center whitespace-nowrap rounded-xl px-3.5 text-[13px] font-medium text-fg-muted">
                Pending
              </span>
            )}
          </div>
        </div>

        {/* Question Display Layout */}
        <div className="glass mb-0 flex h-auto flex-col overflow-y-auto rounded-3xl md:h-[min(62vh,580px)] md:min-h-[400px] md:overflow-hidden">
          <div className="flex flex-1 flex-col md:grid md:h-full md:grid-cols-[1.4fr_1fr]">
            <div className="scrollbar-stable flex h-auto min-w-0 flex-1 flex-col overflow-visible border-b border-line px-5 py-5 md:h-full md:overflow-y-auto md:border-b-0 md:border-r md:px-8 md:py-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <span className="clay flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-[17px] font-bold tabular-nums" aria-hidden="true">
                    {currentIndex + 1}
                  </span>
                  <p className="text-[18px] font-bold tabular-nums tracking-tight text-fg md:text-[20px]">
                    Soal No. {currentIndex + 1}
                  </p>
                </div>
                <span className="text-[13px] font-medium tabular-nums text-fg-muted">
                  {currentIndex + 1} / {totalQuestions}
                </span>
              </div>
              <RichContent
                html={q.question_text}
                className={`exam-question-content ${fontSizeClass} font-medium leading-[1.45] text-fg`}
              />
            </div>

            <div className="scrollbar-stable flex h-auto min-w-0 flex-1 flex-col justify-center overflow-visible px-4 py-5 md:h-full md:overflow-y-auto md:px-6 md:py-6">
              {q.question_type === 'short_answer' ? (
                <div className="w-full space-y-2.5">
                  <label htmlFor="quiz-short-answer" className="text-[13px] font-medium text-fg-muted">Jawaban singkat</label>
                  <input
                    id="quiz-short-answer"
                    type="text"
                    value={selectedAnswer ?? ''}
                    onChange={(event) => setSelectedAnswer(event.target.value)}
                    placeholder="Ketik jawaban…"
                    className="well h-12 w-full rounded-xl px-4 text-[15px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
                  />
                  <p className="text-[12px] text-fg-muted">Tekan Next untuk lanjut.</p>
                </div>
              ) : (
                <div className="w-full space-y-2" role="group" aria-label="Pilihan jawaban">
                  {q.options.map((opt, i) => {
                    const isSelected = selectedAnswer === opt.text;
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedAnswer(opt.text)}
                        className={`group flex min-h-12 w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-calm md:px-3.5 ${
                          isSelected
                            ? 'bg-primary text-on-primary'
                            : 'well well-hover text-fg'
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold tabular-nums transition-calm ${
                          isSelected ? 'bg-on-primary/20 text-on-primary' : 'border border-line-strong text-fg-muted'
                        }`}>
                          {opt.label}
                        </span>
                        <RichContent
                          html={opt.text}
                          className={`exam-option-content min-w-0 flex-1 text-[14px] font-medium leading-snug md:text-[15px] ${isSelected ? 'text-on-primary' : 'text-fg'}`}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col items-stretch gap-2 border-t border-line pt-5 sm:flex-row sm:items-center">
          {isStandard ? (
            <>
              <button
                type="button"
                onClick={() => goToQuizQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="well well-hover h-12 w-full rounded-xl text-[14px] font-medium text-fg transition-calm disabled:cursor-not-allowed disabled:opacity-40 sm:flex-1"
              >
                Back
              </button>
              <button
                type="button"
                aria-pressed={Boolean(doubtFlags[currentIndex])}
                onClick={() => {
                  const updated = [...doubtFlags];
                  updated[currentIndex] = !updated[currentIndex];
                  setDoubtFlags(updated);
                  secureSave(`quiz_doubts_${quizCode}`, JSON.stringify(updated));
                }}
                className={`h-12 w-full rounded-xl text-[14px] font-semibold transition-calm sm:flex-1 ${doubtFlags[currentIndex]
                  ? 'clay-highlight'
                  : 'well well-hover text-fg-muted'
                  }`}
              >
                Ragu-ragu
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isLastQuestion) {
                    setShowSubmitConfirm(true);
                  } else {
                    goToQuizQuestion(currentIndex + 1);
                  }
                }}
                className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold sm:flex-1"
              >
                {isLastQuestion ? 'Finish' : 'Next'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleAnswer(selectedAnswer)}
                disabled={!selectedAnswer || selectedAnswer.trim().length === 0}
                className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold sm:flex-1"
              >
                Next question
              </button>
              <button
                type="button"
                onClick={() => handleAnswer(null)}
                className="well well-hover h-12 w-full rounded-xl px-6 text-[14px] font-medium text-fg-muted transition-calm hover:text-fg sm:w-auto"
              >
                Skip
              </button>
            </>
          )}
        </div>

        {/* Standard Mode: Navigation Popup */}
        {isStandard && showNavPopup && (
          <div
            className="glass-scrim fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={() => setShowNavPopup(false)}
          >
            <motion.div
              layoutId="quiz-question-nav-expandable"
              role="dialog"
              aria-modal="true"
              aria-labelledby="quiz-nav-title"
              className="glass-sheet w-full max-w-md overflow-hidden rounded-4xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-line px-5 pt-4 pb-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 id="quiz-nav-title" className="text-[18px] font-bold tracking-tight text-fg">Daftar soal</h3>
                  <button
                    type="button"
                    onClick={() => setShowNavPopup(false)}
                    aria-label="Tutup"
                    autoFocus
                    className="well well-hover flex h-11 w-11 items-center justify-center rounded-xl text-fg transition-calm"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <QuestionGridLegend />
              </div>
              <div className="max-h-[60vh] overflow-y-auto px-5 py-5">
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
                  {Array.from({ length: totalQuestions }, (_, i) => {
                    const isAnswered = localAnswers[i] !== null && localAnswers[i] !== undefined && String(localAnswers[i]).trim().length > 0;
                    const isDoubt = doubtFlags[i] || false;
                    const isCurrent = i === currentIndex;
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-current={isCurrent ? 'step' : undefined}
                        aria-label={`Soal ${i + 1}${isDoubt ? ', ragu' : isAnswered ? ', terjawab' : ', kosong'}`}
                        onClick={() => goToQuizQuestion(i)}
                        className={questionTileClass({ isCurrent, isDoubt, isAnswered })}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {showSubmitConfirm && (
        <div
          className="glass-scrim fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={() => setShowSubmitConfirm(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="quiz-submit-title"
            className="glass-sheet animate-in w-full max-w-sm rounded-4xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="quiz-submit-title" className="mb-1.5 text-[20px] font-bold tracking-tight text-fg">Selesai kuis?</h3>
            <p className="mb-6 text-[14px] leading-relaxed text-fg-muted">
              Pastikan jawaban kamu sudah dicek sebelum menyelesaikan kuis.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setShowSubmitConfirm(false)}
                className="well well-hover h-11 flex-1 rounded-xl text-[14px] font-medium text-fg transition-calm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubmitConfirm(false);
                  finishStandardQuiz();
                }}
                className="clay-primary h-11 flex-1 rounded-xl text-[14px] font-semibold"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anti-Cheat: Tab Warning Modal */}
      <TabWarningModal
        warningCount={warningCount}
        isOpen={showWarningModal}
        onDismiss={dismissWarning}
      />
    </div>
  );
}
