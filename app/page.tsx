"use client";

import React from 'react';
import QuestionDisplay from '@/app/components/QuestionDisplay';
import HelpTooltip from '@/app/components/exam/HelpTooltip';
import MultiSelectDropdown from '@/app/components/exam/MultiSelectDropdown';
import JoinQuizModal from '@/app/components/exam/JoinQuizModal';
import ConfirmIdentityStep from '@/app/components/exam/ConfirmIdentityStep';
import RestoringSessionView from '@/app/components/exam/RestoringSessionView';
import PreparingQuestionView from '@/app/components/exam/PreparingQuestionView';
import QuestionNavPopup from '@/app/components/exam/QuestionNavPopup';
import SubmitConfirmModal from '@/app/components/exam/SubmitConfirmModal';
import SurrenderConfirmModal from '@/app/components/exam/SurrenderConfirmModal';
import FeedbackPopup from '@/app/components/exam/FeedbackPopup';
import QuestionStatusHeader from '@/app/components/exam/QuestionStatusHeader';
import QuestionActionButtons from '@/app/components/exam/QuestionActionButtons';
import ScoreStepView from '@/app/components/exam/ScoreStepView';
import ResultsHeader from '@/app/components/exam/ResultsHeader';
import ResultsRecapList from '@/app/components/exam/ResultsRecapList';
import ResultsFooter from '@/app/components/exam/ResultsFooter';
import AppFallbackView from '@/app/components/exam/AppFallbackView';
import { QUESTION_COUNTS } from '@/lib/questions';
import useExamPageController from '@/app/hooks/useExamPageController';
import { TIME_LIMIT_OPTIONS } from '@/app/hooks/examControllerConstants';

export default function ExamPage() {
  const {
    meta,
    state,
    setters,
    actions,
  } = useExamPageController();

  if (!state.isRestored) {
    return <RestoringSessionView />;
  }

  if (state.step === 1) {
    const segmentBase = 'flex-1 h-11 rounded-lg text-[14px] font-semibold transition-calm';
    const segmentIdle = 'text-fg-muted hover:text-fg';
    return (
      <div className="flex-1 flex flex-col px-4 pt-8 pb-12 sm:px-6 md:pt-14">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-6 md:mb-8">
            <p className="mb-2 text-[13px] font-medium text-fg-muted">Smandapura Exam</p>
            <h1 className="mb-2 text-[36px] font-bold leading-[1.05] tracking-[-0.02em] text-fg sm:text-[44px]">
              Take the exam.
            </h1>
            <p className="text-[15px] text-fg-muted">Pick your mode, your topic, and start whenever you’re ready.</p>
          </div>
          <div className="glass w-full space-y-5 rounded-3xl p-5 md:p-6">
            <div className="space-y-2">
              <span className="flex items-center text-[13px] font-medium text-fg-muted">
                Mode
                <HelpTooltip text="Pilih mode ujian: Exam (biasa) atau Survival (nyawa terbatas)." />
              </span>
              <div className="well flex w-full gap-1 rounded-xl p-1" role="group" aria-label="Mode">
                <button
                  type="button"
                  aria-pressed={state.gameMode === 'exam'}
                  onClick={() => setters.setGameMode('exam')}
                  className={`${segmentBase} ${state.gameMode === 'exam' ? 'clay' : segmentIdle}`}
                >
                  Exam
                </button>
                <button
                  type="button"
                  aria-pressed={state.gameMode === 'survival'}
                  onClick={() => { setters.setGameMode('survival'); setters.setExamMode('strict'); }}
                  className={`${segmentBase} ${state.gameMode === 'survival' ? 'clay-danger' : segmentIdle}`}
                >
                  Survival
                </button>
              </div>
              <button
                type="button"
                onClick={() => setters.setIsJoinModalOpen(true)}
                className="well well-hover flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-medium text-fg transition-calm"
              >
                Join with code
              </button>
            </div>

            {!state.isSurvival && (
              <div className="space-y-2">
                <span className="flex items-center text-[13px] font-medium text-fg-muted">
                  Navigation
                  <HelpTooltip text="Strict: Soal berurutan, tidak bisa kembali. Standard: Bebas navigasi dan bisa menandai ragu-ragu." />
                </span>
                <div className="well flex w-full gap-1 rounded-xl p-1" role="group" aria-label="Navigation">
                  <button
                    type="button"
                    aria-pressed={state.examMode === 'strict'}
                    onClick={() => setters.setExamMode('strict')}
                    className={`${segmentBase} ${state.examMode === 'strict' ? 'clay' : segmentIdle}`}
                  >
                    Strict
                  </button>
                  <button
                    type="button"
                    aria-pressed={state.examMode === 'standard'}
                    onClick={() => setters.setExamMode('standard')}
                    className={`${segmentBase} ${state.examMode === 'standard' ? 'clay' : segmentIdle}`}
                  >
                    Standard
                  </button>
                </div>
                <p className="text-[13px] text-fg-muted">
                  {state.examMode === 'strict' ? 'Sequential only, no going back.' : 'Free navigation, mark as doubtful.'}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="exam-user-name" className="flex items-center text-[13px] font-medium text-fg-muted">
                Your name
                <HelpTooltip text="Nama yang akan ditampilkan pada papan skor (leaderboard)." />
              </label>
              <input
                id="exam-user-name"
                type="text"
                value={state.userName}
                onChange={(e) => setters.setUserName(e.target.value)}
                placeholder="Enter name"
                className="well h-11 w-full rounded-xl px-4 text-[15px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <span className="flex items-center text-[13px] font-medium text-fg-muted">
                  Mapel
                  <HelpTooltip text="Mata pelajaran yang ingin diujikan." />
                </span>
                <MultiSelectDropdown
                  label="Mapel"
                  options={state.availableMapels}
                  selectedValues={state.mapels}
                  onChange={setters.setMapels}
                  placeholder="Choose mapel"
                />
              </div>

              <div className="space-y-2">
                <span className="flex items-center text-[13px] font-medium text-fg-muted">
                  Bab
                  <HelpTooltip text="Bab materi yang ingin diujikan." />
                </span>
                <MultiSelectDropdown
                  label="BAB"
                  options={state.availableBabs}
                  selectedValues={state.babs}
                  onChange={setters.setBabs}
                  disabled={state.mapels.length === 0}
                  placeholder={state.mapels.length === 0 ? 'Choose mapel' : 'Choose bab'}
                />
              </div>

              <div className="space-y-2">
                <span className="flex items-center text-[13px] font-medium text-fg-muted">
                  Sub-bab
                  <HelpTooltip text="Sub-bab materi yang ingin diujikan." />
                </span>
                <MultiSelectDropdown
                  label="Sub-bab"
                  options={state.availableSubBabs}
                  selectedValues={state.subBabs}
                  onChange={setters.setSubBabs}
                  disabled={state.babs.length === 0}
                  placeholder={state.babs.length === 0 ? 'Choose bab' : 'Choose sub-bab'}
                />
              </div>
            </div>

            <div className={`grid gap-3 ${state.isSurvival ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div className="space-y-2">
                <label htmlFor="exam-time-limit" className="flex items-center text-[13px] font-medium text-fg-muted">
                  Time limit
                  <HelpTooltip text="Batas waktu maksimal untuk menyelesaikan seluruh soal." />
                </label>
                <div className="relative">
                  <select
                    id="exam-time-limit"
                    value={state.timeLimit}
                    onChange={(e) => setters.setTimeLimit(Number(e.target.value))}
                    className="well well-hover h-11 w-full cursor-pointer appearance-none rounded-xl pl-4 pr-10 text-[14px] font-medium text-fg transition-calm"
                  >
                    {TIME_LIMIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {!state.isSurvival && (
                <div className="space-y-2">
                  <label htmlFor="exam-question-count" className="flex items-center text-[13px] font-medium text-fg-muted">
                    Question count
                    <HelpTooltip text="Jumlah soal yang ingin dikerjakan." />
                  </label>
                  <div className="relative">
                    <select
                      id="exam-question-count"
                      value={state.questionCount}
                      onChange={(e) => setters.setQuestionCount(Number(e.target.value) as typeof state.questionCount)}
                      className="well well-hover h-11 w-full cursor-pointer appearance-none rounded-xl pl-4 pr-10 text-[14px] font-medium tabular-nums text-fg transition-calm"
                    >
                      {QUESTION_COUNTS.map((count) => (
                        <option key={count} value={count}>{count} questions</option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setters.setStep(2)}
              disabled={
                !state.userName.trim() ||
                state.mapels.length === 0 ||
                state.babs.length === 0 ||
                state.subBabs.length === 0
              }
              className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold"
            >
              Begin session
            </button>
          </div>

          <JoinQuizModal
            isOpen={state.isJoinModalOpen}
            quizCodeLength={meta.QUIZ_CODE_LENGTH}
            quizCode={state.quizCode}
            codeError={state.codeError}
            isCheckingCode={state.isCheckingCode}
            canJoin={state.canJoinQuiz}
            onCodeChange={actions.handleQuizCodeChange}
            onJoin={actions.handleJoinQuiz}
            onClose={actions.closeJoinModal}
          />

        </div>
      </div>
    );
  }

  if (state.step === 2) {
    return (
      <ConfirmIdentityStep
        userName={state.userName}
        isSurvival={state.isSurvival}
        examMode={state.examMode}
        mapelsLabel={state.mapelsLabel}
        babsLabel={state.babsLabel}
        subBabsLabel={state.subBabsLabel}
        questionCount={state.questionCount}
        timeLimitLabel={meta.TIME_LIMIT_OPTIONS.find(o => o.value === state.timeLimit)?.label}
        isLoading={state.isLoading}
        onEdit={() => setters.setStep(1)}
        onStart={actions.startExam}
      />
    );
  }

  if (state.step === meta.PREPARING_STEP) {
    return <PreparingQuestionView />;
  }

  if (state.step >= 3 && state.step <= 5 && state.currentQuestion) {
    return (
      <div className="flex-1 flex flex-col px-4 pt-5 pb-12 sm:px-6 md:pt-8 md:pb-16">
        <div className="max-w-6xl mx-auto w-full">
          <QuestionStatusHeader
            isSurvival={state.isSurvival}
            score={state.score}
            lives={state.lives}
            userName={state.userName}
            mapelsLabel={state.mapelsLabel}
            babsLabel={state.babsLabel}
            subBabsLabel={state.subBabsLabel}
            current={state.current}
            isStandard={state.isStandard}
            timeLimit={state.timeLimit}
            expiresAt={state.expiresAt}
            timeLeftDisplay={state.timeLeftDisplay}
            hasAnswerSelected={state.hasAnswerSelected}
            onOpenNavPopup={() => setters.setShowNavPopup(true)}
          />

          <QuestionDisplay
            currentQuestion={state.currentQuestion}
            selectedAnswer={state.answers[state.current]}
            onSelectAnswer={actions.selectAnswer}
            questionNumber={state.current + 1}
            isSurvival={state.isSurvival}
            score={state.score}
            lives={state.lives}
          />

          <QuestionActionButtons
            isStandard={state.isStandard}
            current={state.current}
            total={state.total}
            isLoading={state.isLoading}
            doubtFlags={state.doubtFlags}
            hasAnswerSelected={state.hasAnswerSelected}
            feedbackResult={state.feedbackResult}
            isSurvival={state.isSurvival}
            onGoPrev={() => actions.goToQuestion(state.current - 1)}
            onToggleDoubt={() => {
              const updated = [...state.doubtFlags];
              updated[state.current] = !updated[state.current];
              setters.setDoubtFlags(updated);
            }}
            onStandardNext={() => actions.goToQuestion(state.current + 1)}
            onStrictNext={actions.nextQuestion}
            onOpenSubmitConfirm={() => setters.setShowSubmitConfirm(true)}
            onOpenSurrenderConfirm={() => setters.setShowSurrenderConfirm(true)}
            onSkip={actions.skipQuestion}
          />

          <SubmitConfirmModal
            isOpen={state.showSubmitConfirm}
            onCancel={() => setters.setShowSubmitConfirm(false)}
            onConfirm={() => {
              setters.setShowSubmitConfirm(false);
              void actions.endSession();
            }}
          />

          <QuestionNavPopup
            isOpen={state.isStandard && state.showNavPopup}
            total={state.total}
            answers={state.answers}
            doubtFlags={state.doubtFlags}
            current={state.current}
            onClose={() => setters.setShowNavPopup(false)}
            onGoToQuestion={actions.goToQuestion}
          />

          <FeedbackPopup feedbackResult={state.feedbackResult} />

          <SurrenderConfirmModal
            isOpen={state.showSurrenderConfirm}
            onCancel={() => setters.setShowSurrenderConfirm(false)}
            onConfirm={() => {
              setters.setShowSurrenderConfirm(false);
              actions.surrender();
            }}
          />

        </div>
      </div>
    );
  }

  if (state.step === 6) {
    return (
      <ScoreStepView
        isSurvival={state.isSurvival}
        score={state.score}
        total={state.total}
        mapelsLabel={state.mapelsLabel}
        babsLabel={state.babsLabel}
        subBabsLabel={state.subBabsLabel}
        saving={state.saving}
        saved={state.saved}
        saveFailed={state.saveFailed}
        onViewBreakdown={() => actions.goToStep(7)}
      />
    );
  }

  if (state.step === 7) {
    return (
      <div className="flex-1 flex flex-col px-4 pt-5 pb-12 sm:px-6 md:pt-8 md:pb-16">
        <div className="max-w-3xl mx-auto w-full">
          <ResultsHeader
            startTime={state.startTime}
            endTime={state.endTime}
            formattedDuration={state.formattedDuration}
            userName={state.userName}
            isSurvival={state.isSurvival}
            answeredCount={state.answeredCount}
            score={state.score}
            total={state.total}
            mapelsLabel={state.mapelsLabel}
            babsLabel={state.babsLabel}
            subBabsLabel={state.subBabsLabel}
            saved={state.saved}
          />

          <ResultsRecapList recapData={state.recapData} />

          <ResultsFooter onRestart={actions.restart} />
        </div>
      </div>
    );
  }

  return <AppFallbackView onReset={actions.restart} />;
}
