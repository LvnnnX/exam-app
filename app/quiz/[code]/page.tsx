"use client";

import React, { use } from 'react';
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
import useQuizSessionController from '@/app/hooks/useQuizSessionController';

export default function QuizSessionPage({ params }: { params: Promise<{ code: string }> }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { meta, state, setters, actions } = useQuizSessionController(code);

  const {
    quizCode,
    router,
    isStandard,
    leaderboardRowRefs,
    getRankBadgeClasses: _getRankBadgeClasses,
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


  if (loading) return <div className="p-8 text-center text-gray-500 font-bold">LOADING...</div>;
  if (!session) return null;

  if (isFinished) {
    const topicTiers = ([
      { label: 'Mapel', raw: session.mapel },
      { label: 'Bab', raw: session.bab },
      { label: 'Sub', raw: session.sub_bab },
    ] as const);

    return (
      <div className="flex-1 flex flex-col px-4 sm:px-6 pt-8 pb-10 bg-white min-h-screen">
        <div className="max-w-2xl mx-auto w-full">
          {/* Header */}
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-nike-green/10 text-nike-green text-[11px] font-medium tracking-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-nike-green animate-pulse" />
              Live result
            </span>
            <h2 className="mt-3 font-display text-[32px] sm:text-[40px] text-nike-black leading-[1.05] tracking-[-0.02em]">
              Leaderboard.
            </h2>
            <p className="mt-1 text-[13px] text-nike-grey-500 tracking-tight">
              Hasil akhir untuk semua peserta.
            </p>
          </div>

          {/* Summary card */}
          <div className="rounded-3xl bg-black/[0.03] px-5 py-4 mb-3 flex flex-col gap-3.5">
            {player && (
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-nike-grey-500/80 mb-1 tracking-tight uppercase">Skor kamu</p>
                  <p className="text-[22px] font-semibold tabular-nums text-nike-black tracking-tight leading-none">
                    {score} <span className="text-nike-grey-500/50 text-[16px]">/ {session.question_count}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLeaderboardView(true)}
                  className="h-9 px-4 rounded-full bg-nike-black text-white text-[12px] font-medium tracking-tight hover:bg-nike-grey-500 transition-spring-fast active:scale-95 shadow-ios-sm shrink-0"
                >
                  Race view
                </button>
              </div>
            )}

            <div className="h-px bg-black/[0.06]" aria-hidden="true" />

            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-nike-grey-500/80 mb-1 tracking-tight uppercase">Topik</p>
              {topicTiers.map(({ label, raw }) => {
                const items = String(raw || '')
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((v) => formatCategorySelectionLabel(v));
                if (items.length === 0) {
                  return (
                    <div key={label} className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase w-12 shrink-0 text-left">{label}</span>
                      <span className="text-[13px] font-medium text-nike-grey-500 tracking-tight">None</span>
                    </div>
                  );
                }
                const [first, ...rest] = items;
                return (
                  <div key={label} className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase w-12 shrink-0 text-left">{label}</span>
                    <span className="text-[13px] font-medium text-nike-black tracking-tight truncate">{first}</span>
                    {rest.length > 0 && (
                      <span
                        title={items.join(', ')}
                        className="inline-flex items-center px-1.5 h-5 rounded-full bg-black/[0.06] text-[10px] font-medium text-nike-grey-500 tabular-nums tracking-tight shrink-0"
                      >
                        +{rest.length}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaderboard list */}
          <div className="space-y-1.5 mb-5">
            {leaderboard.map((lb, idx) => {
              const isMe = lb.id === player?.id;
              const rank = idx + 1;
              const showCrown = rank <= 3;
              return (
                <div
                  key={lb.id}
                  ref={(element) => { leaderboardRowRefs.current[lb.id] = element; }}
                  className={`px-4 py-3 rounded-2xl flex items-center gap-3 transform-gpu will-change-transform transition-spring-fast ${
                    isMe ? 'bg-nike-black text-white shadow-ios-sm' : 'bg-black/[0.03] text-nike-black'
                  }`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${
                    showCrown
                      ? rank === 1
                        ? 'bg-yellow-400 text-yellow-900'
                        : rank === 2
                          ? 'bg-slate-300 text-slate-700'
                          : 'bg-amber-700 text-amber-100'
                      : isMe
                        ? 'bg-white/10 text-white/70'
                        : 'bg-black/[0.06] text-nike-grey-500'
                  }`}>
                    {showCrown ? (
                      <span className="text-[14px]">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span>
                    ) : rank}
                  </div>

                  <p className="flex-1 min-w-0 truncate text-[14px] font-semibold tracking-tight">
                    {lb.name}
                    {isMe && (
                      <span className="ml-1.5 text-[10px] font-medium text-white/60 tracking-tight uppercase">You</span>
                    )}
                  </p>

                  <div className="text-right shrink-0">
                    <p className={`text-[13px] font-semibold tabular-nums tracking-tight leading-none ${
                      isMe ? 'text-white' : 'text-nike-black'
                    }`}>
                      {isStandard && !lb.finished_at ? '?' : lb.score}
                      <span className={`text-[10px] font-medium ml-1 ${isMe ? 'text-white/50' : 'text-nike-grey-500'}`}>
                        / {session.question_count}
                      </span>
                    </p>
                    <p className={`mt-0.5 text-[10px] font-medium tabular-nums font-mono tracking-tight ${
                      isMe ? 'text-white/60' : 'text-nike-grey-500'
                    }`}>
                      {isStandard && !lb.finished_at ? '—' : formatHMS(lb.total_time)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <button
            onClick={() => router.push('/')}
            className="w-full h-12 rounded-full bg-black/5 text-nike-black text-[13px] font-medium hover:bg-black/10 transition-spring-fast active:scale-95 tracking-tight"
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-white">
        <div className="max-w-sm w-full">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-nike-red/10 text-nike-red text-[11px] font-medium tracking-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-nike-red animate-pulse" />
              Live quiz
            </span>
            <h2 className="mt-4 font-display text-[28px] sm:text-[32px] text-nike-black leading-[1.05] tracking-[-0.02em]">
              Gabung ke kuis.
            </h2>
            <p className="mt-1 text-[13px] text-nike-grey-500 tracking-tight">
              Masukkan namamu untuk masuk ruang tunggu.
            </p>
          </div>

          <div className="rounded-3xl bg-black/[0.03] px-5 py-4 mb-4">
            <p className="text-[10px] font-medium text-nike-grey-500/80 mb-2.5 tracking-tight uppercase">Topik</p>
            <div className="space-y-1.5">
              {([
                { label: 'Mapel', raw: session.mapel },
                { label: 'Bab', raw: session.bab },
                { label: 'Sub', raw: session.sub_bab },
              ] as const).map(({ label, raw }) => {
                const items = String(raw || '')
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((v) => formatCategorySelectionLabel(v));
                if (items.length === 0) {
                  return (
                    <div key={label} className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase w-12 shrink-0 text-left">{label}</span>
                      <span className="text-[13px] font-medium text-nike-grey-500 tracking-tight">None</span>
                    </div>
                  );
                }
                const [first, ...rest] = items;
                return (
                  <div key={label} className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase w-12 shrink-0 text-left">{label}</span>
                    <span className="text-[13px] font-medium text-nike-black tracking-tight truncate">{first}</span>
                    {rest.length > 0 && (
                      <span
                        title={items.join(', ')}
                        className="inline-flex items-center px-1.5 h-5 rounded-full bg-black/[0.06] text-[10px] font-medium text-nike-grey-500 tabular-nums tracking-tight shrink-0"
                      >
                        +{rest.length}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-medium text-nike-grey-500 tracking-tight pl-1">Nama kamu</label>
            <input
              type="text"
              placeholder="Tulis nama lengkap"
              value={name}
              maxLength={24}
              onChange={e => setName(e.target.value.slice(0, 24))}
              className="w-full h-12 rounded-2xl bg-black/5 px-4 text-[14px] font-medium text-nike-black placeholder-nike-grey-500/70 focus:outline-none focus:bg-black/10 transition-spring-fast tracking-tight"
            />
            <button
              onClick={handleJoin}
              disabled={!name.trim() || loading}
              className="w-full h-12 rounded-full bg-nike-black text-white text-[14px] font-medium hover:bg-nike-grey-500 transition-spring-fast active:scale-[0.98] disabled:bg-black/5 disabled:text-nike-grey-500 disabled:cursor-not-allowed tracking-tight shadow-ios-sm"
            >
              {loading ? 'Menyambungkan…' : 'Masuk ruang tunggu'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (session.status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-white">
        <div className="max-w-md w-full mx-auto">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-black/5 text-nike-grey-500 text-[11px] font-medium tracking-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-nike-grey-500 animate-pulse" />
              Ruang tunggu
            </span>
            <h2 className="mt-4 font-display text-[28px] sm:text-[32px] text-nike-black leading-[1.05] tracking-[-0.02em]">
              Menunggu admin.
            </h2>
            <p className="mt-1 text-[13px] text-nike-grey-500 tracking-tight">
              Kuis akan segera dimulai.
            </p>

            <div className="mt-5 flex items-center justify-center gap-1.5" aria-label="Memuat">
              <span className="w-1.5 h-1.5 rounded-full bg-nike-black animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-nike-black animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-nike-black animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>

          {waitTimer && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-3xl bg-black/[0.03] px-5 py-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-nike-black shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase">Mulai otomatis</p>
                  <p className="text-[12px] font-medium text-nike-grey-500 tracking-tight">Kuis akan dimulai dalam</p>
                </div>
              </div>
              <span className="text-[22px] font-semibold font-mono tabular-nums text-nike-black tracking-tight leading-none shrink-0">
                {waitTimer}
              </span>
            </div>
          )}

          <div className="rounded-3xl bg-black/[0.03] px-5 py-4 mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-ios-sm">
              <HorseAvatar colors={getHorseSkin(player?.horse_skin, player?.id).horse} mount={getHorseSkin(player?.horse_skin, player?.id).mount} size="md" animate={true} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase">Pemain</p>
              <p className="text-[14px] font-semibold text-nike-black tracking-tight truncate">{player?.name || 'Tamu'}</p>
            </div>
            <motion.button
              type="button"
              layoutId="edit-horse-expandable"
              transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.9 }}
              onClick={() => setIsEditHorseModalOpen(true)}
              disabled={changingHorseSkin || !player}
              className="h-9 px-4 rounded-full bg-black/5 text-nike-black text-[12px] font-medium tracking-tight hover:bg-black/10 transition-spring-fast hover:scale-[1.03] active:scale-95 disabled:opacity-50 shrink-0"
            >
              {changingHorseSkin ? 'Tunggu…' : 'Ubah'}
            </motion.button>
          </div>

          <div className="rounded-3xl bg-black/[0.03] px-5 py-4">
            <p className="text-[10px] font-medium text-nike-grey-500/80 mb-2.5 tracking-tight uppercase">Topik</p>
            <div className="space-y-1.5">
              {([
                { label: 'Mapel', raw: session.mapel },
                { label: 'Bab', raw: session.bab },
                { label: 'Sub', raw: session.sub_bab },
              ] as const).map(({ label, raw }) => {
                const items = String(raw || '')
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((v) => formatCategorySelectionLabel(v));
                if (items.length === 0) {
                  return (
                    <div key={label} className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase w-12 shrink-0 text-left">{label}</span>
                      <span className="text-[13px] font-medium text-nike-grey-500 tracking-tight">None</span>
                    </div>
                  );
                }
                const [first, ...rest] = items;
                return (
                  <div key={label} className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase w-12 shrink-0 text-left">{label}</span>
                    <span className="text-[13px] font-medium text-nike-black tracking-tight truncate">{first}</span>
                    {rest.length > 0 && (
                      <span
                        title={items.join(', ')}
                        className="inline-flex items-center px-1.5 h-5 rounded-full bg-black/[0.06] text-[10px] font-medium text-nike-grey-500 tabular-nums tracking-tight shrink-0"
                      >
                        +{rest.length}
                      </span>
                    )}
                  </div>
                );
              })}
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
      <div className="flex-1 flex flex-col items-center justify-center bg-white min-h-screen p-6">
        {loadError ? (
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="font-display text-[32px] text-nike-black uppercase mb-4">WADUH!</h2>
            <p className="text-nike-grey-500 font-bold uppercase tracking-widest text-sm mb-8 max-w-xs mx-auto">{loadError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-nike-black text-white rounded-full font-black text-sm uppercase tracking-widest hover:bg-nike-grey-500 transition-all shadow-xl shadow-nike-black/20"
            >
              SEGARKAN HALAMAN
            </button>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 border-4 border-nike-black border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-nike-grey-500 font-bold uppercase tracking-widest text-sm">Menyiapkan Soal...</p>
          </>
        )}
      </div>
    );
  }

  const textLength = q.question_text.replace(/<[^>]*>/g, '').length;
  const fontSizeClass = textLength > 500 ? 'text-[14px] md:text-[16px]' :
    textLength > 250 ? 'text-[15px] md:text-[18px]' :
      'text-[16px] md:text-[20px]';

  const splitMountTopicLabels = (raw: string | null | undefined) => String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((v) => formatCategorySelectionLabel(v));

  const renderTopicSegment = (items: string[]) => {
    if (items.length === 0) return <span className="text-nike-grey-500/70">None</span>;
    const [first, ...rest] = items;
    return (
      <span title={items.join(', ')} className="inline-flex items-baseline gap-1 min-w-0">
        <span className="truncate">{first}</span>
        {rest.length > 0 && (
          <span className="inline-flex items-center px-1.5 h-4 rounded-full bg-black/[0.06] text-[10px] font-medium text-nike-grey-500 tabular-nums shrink-0">
            +{rest.length}
          </span>
        )}
      </span>
    );
  };
  const totalQuestions = session?.question_count || 0;
  const isLastQuestion = currentIndex >= totalQuestions - 1;

  return (
    <div className="flex-1 flex flex-col px-4 sm:px-6 pt-6 pb-10 md:pt-8 md:pb-16 min-h-screen bg-white relative">
      {session.status === 'paused' && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-2xl z-[9999] flex items-center justify-center animate-in fade-in duration-300">
          <div className="text-center px-8 py-7 bg-white/85 rounded-[32px] shadow-ios-xl max-w-[280px]">
            <div className="w-14 h-14 bg-nike-black rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            </div>
            <h1 className="text-[22px] font-semibold text-nike-black tracking-tight mb-1">Kuis dijeda</h1>
            <p className="text-[12px] font-medium text-nike-grey-500 tracking-tight">Menunggu admin melanjutkan.</p>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Status header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex flex-col min-w-0 gap-1.5">
            <span className="text-[16px] font-semibold text-nike-black tracking-tight break-words">
              {player.name}
            </span>
            <div className="flex items-baseline gap-1.5 text-[11px] font-medium text-nike-grey-500 tracking-tight min-w-0 flex-wrap">
              {renderTopicSegment(splitMountTopicLabels(session.mapel))}
              <span className="text-nike-grey-500/40">·</span>
              {renderTopicSegment(splitMountTopicLabels(session.bab))}
              <span className="text-nike-grey-500/40">·</span>
              {renderTopicSegment(splitMountTopicLabels(session.sub_bab))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {timeLeftDisplay && (
              <div className="inline-flex items-center gap-2 bg-black/5 px-3 h-9 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-nike-red animate-pulse"></span>
                <span className="text-[12px] font-semibold tabular-nums font-mono text-nike-black">{timeLeftDisplay}</span>
              </div>
            )}

            {isStandard && (
              <motion.button
                layoutId="quiz-question-nav-expandable"
                transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.9 }}
                onClick={() => setShowNavPopup(true)}
                className="h-9 px-3 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center gap-2 transition-spring-fast hover:scale-[1.03] active:scale-95"
                title="Daftar soal"
              >
                <svg className="w-4 h-4 text-nike-black shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="text-[12px] font-medium text-nike-black hidden sm:block tracking-tight">Daftar soal</span>
              </motion.button>
            )}

            {selectedAnswer && selectedAnswer.trim().length > 0 ? (
              <span className="inline-flex items-center px-3 h-9 rounded-full bg-nike-green/10 text-nike-green text-[11px] font-medium tracking-tight whitespace-nowrap">
                Tersimpan
              </span>
            ) : (
              <span className="inline-flex items-center px-3 h-9 rounded-full bg-black/5 text-nike-grey-500 text-[11px] font-medium tracking-tight whitespace-nowrap">
                Pending
              </span>
            )}
          </div>
        </div>

        {/* Question Display Layout */}
        <div className="mb-0 h-auto md:h-[min(62vh,580px)] md:min-h-[400px] overflow-y-auto md:overflow-hidden rounded-3xl bg-black/[0.03] flex flex-col">
          <div className="flex flex-col md:grid md:h-full md:grid-cols-[1.4fr_1fr] flex-1">
            <div className="h-auto md:h-full overflow-visible md:overflow-y-auto scrollbar-stable px-5 py-5 md:px-8 md:py-8 flex flex-col flex-1 min-w-0 border-b border-black/[0.04] md:border-b-0 md:border-r">
              <div className="mb-4 pb-3 border-b border-black/[0.06] flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[20px] md:text-[22px] font-bold text-nike-black tracking-tight tabular-nums">
                  Soal No. {currentIndex + 1}
                </p>
                <span className="text-[11px] font-medium text-nike-grey-500 tabular-nums tracking-tight">
                  {currentIndex + 1} / {totalQuestions}
                </span>
              </div>
              <RichContent
                html={q.question_text}
                className={`exam-question-content ${fontSizeClass} font-medium text-nike-black leading-[1.4] tracking-tight`}
              />
            </div>

            <div className="flex-1 h-auto md:h-full overflow-visible md:overflow-y-auto scrollbar-stable px-5 py-5 md:px-6 md:py-6 flex flex-col justify-center min-w-0">
              {q.question_type === 'short_answer' ? (
                <div className="w-full space-y-2.5">
                  <p className="text-[11px] font-medium text-nike-grey-500 tracking-tight">Jawaban singkat</p>
                  <input
                    type="text"
                    value={selectedAnswer ?? ''}
                    onChange={(event) => setSelectedAnswer(event.target.value)}
                    placeholder="Ketik jawaban…"
                    className="w-full rounded-2xl bg-white px-4 h-11 text-[14px] font-medium text-nike-black placeholder-nike-grey-500/70 focus:outline-none transition-spring-fast shadow-ios-sm"
                  />
                  <p className="text-[11px] text-nike-grey-500 tracking-tight">Tekan Next untuk lanjut.</p>
                </div>
              ) : (
                <div className="space-y-1.5 w-full">
                  {q.options.map((opt, i) => {
                    const isSelected = selectedAnswer === opt.text;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedAnswer(opt.text)}
                        className={`w-full min-w-0 group flex items-center gap-2.5 px-3 py-2 md:px-3.5 md:py-2.5 rounded-2xl text-left transition-spring-fast active:scale-[0.99] ${
                          isSelected
                            ? 'bg-nike-black text-white shadow-ios-sm'
                            : 'bg-white text-nike-black hover:bg-black/[0.04]'
                        }`}
                      >
                        <span className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-medium tabular-nums transition-spring-fast ${
                          isSelected ? 'bg-white/15 text-white' : 'bg-black/[0.06] text-nike-grey-500'
                        }`}>
                          {opt.label}
                        </span>
                        <RichContent
                          html={opt.text}
                          className={`exam-option-content flex-1 min-w-0 text-[13px] md:text-[14px] font-medium tracking-tight leading-snug ${isSelected ? 'text-white' : 'text-nike-black'}`}
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-t border-black/[0.06] pt-6 mt-5">
          {isStandard ? (
            <>
              <button
                onClick={() => goToQuizQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="w-full sm:flex-1 h-12 rounded-full bg-black/5 text-nike-black text-[13px] font-medium hover:bg-black/10 transition-spring-fast active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed tracking-tight"
              >
                Back
              </button>
              <button
                onClick={() => {
                  const updated = [...doubtFlags];
                  updated[currentIndex] = !updated[currentIndex];
                  setDoubtFlags(updated);
                  secureSave(`quiz_doubts_${quizCode}`, JSON.stringify(updated));
                }}
                className={`w-full sm:flex-1 h-12 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 tracking-tight ${doubtFlags[currentIndex]
                  ? 'bg-yellow-400 text-nike-black shadow-ios-sm'
                  : 'bg-black/5 text-nike-grey-500 hover:bg-black/10'
                  }`}
              >
                Ragu-ragu
              </button>
              <button
                onClick={() => {
                  if (isLastQuestion) {
                    setShowSubmitConfirm(true);
                  } else {
                    goToQuizQuestion(currentIndex + 1);
                  }
                }}
                className="w-full sm:flex-1 h-12 rounded-full bg-nike-black text-white text-[13px] font-medium hover:bg-nike-grey-500 transition-spring-fast active:scale-[0.98] tracking-tight shadow-ios-sm"
              >
                {isLastQuestion ? 'Finish' : 'Next'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleAnswer(selectedAnswer)}
                disabled={!selectedAnswer || selectedAnswer.trim().length === 0}
                className="w-full sm:flex-1 h-12 rounded-full bg-nike-black text-white text-[13px] font-medium hover:bg-nike-grey-500 transition-spring-fast active:scale-[0.98] disabled:bg-black/5 disabled:text-nike-grey-500 disabled:cursor-not-allowed tracking-tight shadow-ios-sm"
              >
                Next question
              </button>
              <button
                onClick={() => handleAnswer(null)}
                className="w-full sm:w-auto sm:px-6 h-12 rounded-full bg-black/5 text-nike-grey-500 text-[13px] font-medium hover:bg-black/10 hover:text-nike-black transition-spring-fast active:scale-95 tracking-tight"
              >
                Skip
              </button>
            </>
          )}
        </div>

        {/* Standard Mode: Navigation Popup */}
        {isStandard && showNavPopup && (
          <div className="fixed inset-0 z-[100] bg-dark-800/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-200">
            <motion.div
              layoutId="quiz-question-nav-expandable"
              transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.9 }}
              className="bg-white rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.45)] max-w-2xl w-full overflow-hidden"
            >
              <div className="px-5 pt-5 pb-4 border-b border-black/[0.06]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[17px] font-semibold tracking-tight text-nike-black">Daftar soal</h3>
                  <button
                    onClick={() => setShowNavPopup(false)}
                    className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-spring-fast active:scale-90"
                  >
                    <svg className="w-3.5 h-3.5 text-nike-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-nike-grey-500 tracking-tight">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-nike-black"></span> Terjawab</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span> Ragu</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-black/10"></span> Kosong</span>
                </div>
              </div>
              <div className="px-5 py-5 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                  {Array.from({ length: totalQuestions }, (_, i) => {
                    const isAnswered = localAnswers[i] !== null && localAnswers[i] !== undefined && String(localAnswers[i]).trim().length > 0;
                    const isDoubt = doubtFlags[i] || false;
                    const isCurrent = i === currentIndex;
                    return (
                      <button
                        key={i}
                        onClick={() => goToQuizQuestion(i)}
                        className={`h-10 rounded-xl text-[13px] font-medium tabular-nums transition-spring-fast active:scale-95 ${isCurrent ? 'ring-2 ring-nike-black ring-offset-2' : ''} ${isDoubt
                          ? 'bg-yellow-400 text-nike-black'
                          : isAnswered
                            ? 'bg-nike-black text-white'
                            : 'bg-black/5 text-nike-black hover:bg-black/10'
                          }`}
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="bg-white rounded-[28px] p-6 max-w-sm w-full shadow-ios-xl animate-in zoom-in-95 duration-300">
            <h3 className="text-[17px] font-semibold tracking-tight text-nike-black mb-1">Selesai kuis?</h3>
            <p className="text-[13px] text-nike-grey-500 mb-5 tracking-tight">
              Pastikan jawaban kamu sudah dicek sebelum menyelesaikan kuis.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 h-11 rounded-full text-[13px] font-medium text-nike-black bg-black/5 hover:bg-black/10 transition-spring-fast active:scale-95 tracking-tight"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setShowSubmitConfirm(false);
                  finishStandardQuiz();
                }}
                className="flex-1 h-11 rounded-full text-[13px] font-medium text-white bg-nike-black hover:bg-nike-grey-500 transition-spring-fast active:scale-95 tracking-tight"
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
