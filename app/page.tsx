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
import { ChoicePoll, CutoutCard, DistortedGlass, ExpandableScreen, GradientHeading, NeumorphButton, NeumorphEyebrow, TextAnimate } from '@/app/components/cult/CultPrimitives';

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
    return (
      <div className="relative flex-1 overflow-hidden px-5 pb-10 pt-8 sm:px-6 md:pt-14">
        <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#f1efe7] blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-[#d9eef7]/70 blur-3xl" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="pt-4 md:pt-10">
            <NeumorphEyebrow>Smandapura Exam</NeumorphEyebrow>
            <GradientHeading className="mt-5 mb-4">
              <TextAnimate>Take the exam.</TextAnimate>
            </GradientHeading>
            <p className="max-w-xl text-[15px] font-medium leading-7 text-black/50 tracking-tight">Pick your mode, your topic, and start whenever you’re ready. Built like a calm control room for focused work.</p>
            <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-3">
              <CutoutCard className="p-4"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">Mode</p><p className="mt-2 text-2xl font-black tracking-[-0.04em]">{state.isSurvival ? 'Survival' : 'Exam'}</p></CutoutCard>
              <CutoutCard className="p-4"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35">Timer</p><p className="mt-2 text-2xl font-black tracking-[-0.04em]">{state.timeLimit}m</p></CutoutCard>
              <ExpandableScreen title="Quick guide"><p>Pilih mapel, bab, sub-bab, lalu mulai sesi. Strict mengunci navigasi; Standard bebas pindah soal.</p></ExpandableScreen>
            </div>
          </div>
          <DistortedGlass className="p-4 sm:p-6">
          <div className="w-full space-y-5">
            <div className="space-y-2">
              <span className="flex items-center text-[12px] font-bold text-black/45 tracking-tight">
                Mode
                <HelpTooltip text="Pilih mode ujian: Exam (biasa) atau Survival (nyawa terbatas)." />
              </span>
              <ChoicePoll
                value={state.gameMode}
                onChange={(value) => {
                  if (value === 'survival') {
                    setters.setGameMode('survival');
                    setters.setExamMode('strict');
                  } else {
                    setters.setGameMode('exam');
                  }
                }}
                options={[{ value: 'exam', label: 'Exam' }, { value: 'survival', label: 'Survival', tone: 'red' }]}
              />
              <NeumorphButton type="button" onClick={() => setters.setIsJoinModalOpen(true)} className="w-full py-2.5 text-[13px]">
                Join with code
              </NeumorphButton>
            </div>

            {!state.isSurvival && (
              <div className="space-y-2">
                <span className="flex items-center text-[12px] font-medium text-nike-grey-500 tracking-tight">
                  Navigation
                  <HelpTooltip text="Strict: Soal berurutan, tidak bisa kembali. Standard: Bebas navigasi dan bisa menandai ragu-ragu." />
                </span>
                <div className="inline-flex w-full h-10 rounded-full bg-black/5 p-0.5">
                  <button
                    onClick={() => setters.setExamMode('strict')}
                    className={`flex-1 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${state.examMode === 'strict'
                      ? 'bg-white text-nike-black shadow-ios-sm'
                      : 'text-nike-grey-500'
                      }`}
                  >
                    Strict
                  </button>
                  <button
                    onClick={() => setters.setExamMode('standard')}
                    className={`flex-1 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 ${state.examMode === 'standard'
                      ? 'bg-white text-nike-black shadow-ios-sm'
                      : 'text-nike-grey-500'
                      }`}
                  >
                    Standard
                  </button>
                </div>
                <p className="text-[12px] text-nike-grey-500 tracking-tight">
                  {state.examMode === 'strict' ? 'Sequential only, no going back.' : 'Free navigation, mark as doubtful.'}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <span className="flex items-center text-[12px] font-medium text-nike-grey-500 tracking-tight">
                Your name
                <HelpTooltip text="Nama yang akan ditampilkan pada papan skor (leaderboard)." />
              </span>
              <input
                type="text"
                value={state.userName}
                onChange={(e) => setters.setUserName(e.target.value)}
                placeholder="Enter name"
                className="w-full h-11 rounded-2xl bg-black/5 px-4 text-[14px] font-medium text-nike-black placeholder-nike-grey-500/70 focus:outline-none focus:bg-black/10 transition-spring-fast"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <span className="flex items-center text-[12px] font-medium text-nike-grey-500 tracking-tight">
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
                <span className="flex items-center text-[12px] font-medium text-nike-grey-500 tracking-tight">
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
                <span className="flex items-center text-[12px] font-medium text-nike-grey-500 tracking-tight">
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
                <span className="flex items-center text-[12px] font-medium text-nike-grey-500 tracking-tight">
                  Time limit
                  <HelpTooltip text="Batas waktu maksimal untuk menyelesaikan seluruh soal." />
                </span>
                <div className="relative">
                  <select
                    value={state.timeLimit}
                    onChange={(e) => setters.setTimeLimit(Number(e.target.value))}
                    className="w-full appearance-none bg-black/5 hover:bg-black/10 rounded-2xl pl-4 pr-10 h-11 text-[13px] font-medium text-nike-black tracking-tight focus:outline-none focus:bg-black/10 transition-spring-fast cursor-pointer"
                  >
                    {TIME_LIMIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nike-grey-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {!state.isSurvival && (
                <div className="space-y-2">
                  <span className="flex items-center text-[12px] font-medium text-nike-grey-500 tracking-tight">
                    Question count
                    <HelpTooltip text="Jumlah soal yang ingin dikerjakan." />
                  </span>
                  <div className="relative">
                    <select
                      value={state.questionCount}
                      onChange={(e) => setters.setQuestionCount(Number(e.target.value) as typeof state.questionCount)}
                      className="w-full appearance-none bg-black/5 hover:bg-black/10 rounded-2xl pl-4 pr-10 h-11 text-[13px] font-medium text-nike-black tabular-nums tracking-tight focus:outline-none focus:bg-black/10 transition-spring-fast cursor-pointer"
                    >
                      {QUESTION_COUNTS.map((count) => (
                        <option key={count} value={count}>{count} questions</option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nike-grey-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setters.setStep(2)}
              disabled={
                !state.userName.trim() ||
                state.mapels.length === 0 ||
                state.babs.length === 0 ||
                state.subBabs.length === 0
              }
              className="w-full h-12 rounded-full bg-nike-black text-white text-[14px] font-medium hover:bg-nike-grey-500 transition-spring-fast active:scale-[0.98] disabled:bg-black/5 disabled:text-nike-grey-500 disabled:cursor-not-allowed tracking-tight shadow-ios-sm"
            >
              Begin session
            </button>
          </div>
          </DistortedGlass>

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
      <div className="flex-1 flex flex-col px-6 pt-6 pb-12 md:pt-8 md:pb-16">
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
      <div className="flex-1 flex flex-col px-6 pt-6 pb-12 md:pt-8 md:pb-16">
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
