"use client";

import React from 'react';
import QuestionDisplay from '@/app/components/QuestionDisplay';
import HelpTooltip from '@/app/components/exam/HelpTooltip';
import MultiSelectDropdown from '@/app/components/exam/MultiSelectDropdown';
import SingleSelectDropdown from '@/app/components/exam/SingleSelectDropdown';
import NeumorphButton from '@/app/components/ui/neumorph-button';
import JoinQuizModal from '@/app/components/exam/JoinQuizModal';
import TutorialModal from '@/app/components/exam/TutorialModal';
import ScheduledExamEntry from '@/app/components/exam/ScheduledExamEntry';
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
import { QUESTION_COUNTS, getSessionQuestionViaRpc } from '@/lib/questions';
import useExamPageController from '@/app/hooks/useExamPageController';
import { TIME_LIMIT_OPTIONS, STORAGE_KEYS } from '@/app/hooks/examControllerConstants';
import { secureLoad, secureSave } from '@/lib/security';

export default function ExamPage() {
  const {
    meta,
    state,
    setters,
    actions,
  } = useExamPageController();

  const [isTutorialOpen, setIsTutorialOpen] = React.useState(false);

  React.useEffect(() => {
    if (!state.isRestored) {
      return;
    }
    const seen = secureLoad<boolean>(STORAGE_KEYS.TUTORIAL_SEEN);
    if (!seen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsTutorialOpen(true);
    }
  }, [state.isRestored]);

  const closeTutorial = React.useCallback(() => {
    setIsTutorialOpen(false);
    secureSave(STORAGE_KEYS.TUTORIAL_SEEN, true);
  }, []);

  const [isScheduledModalOpen, setIsScheduledModalOpen] = React.useState(false);

  // When a scheduled exam session starts, initialize exam runtime and jump to step 3
  const handleScheduledExamStarted = React.useCallback(async (
    sessionId: string,
    questionCount: number,
    expiresAt: string,
    navMode: string,
    scheduledExamTitle: string,
    scheduledMapels: string[],
    scheduledBabs: string[],
    scheduledSubBabs: string[],
    scheduledTimeLimitMinutes: number,
  ) => {
    setIsScheduledModalOpen(false);
    setters.setSessionId(sessionId);
    setters.setTotalQuestions(questionCount);
    setters.setAnswers(Array(questionCount).fill(null));
    setters.setDoubtFlags(Array(questionCount).fill(false));
    setters.setCurrent(0);
    setters.setExpiresAt(expiresAt);
    setters.setStartTime(Number(new Date()));
    setters.setGameMode('exam');
    setters.setExamMode((navMode === 'standard' ? 'standard' : 'strict') as 'strict' | 'standard');
    setters.setIsScheduledExam(true);
    setters.setScheduledExamTitle(scheduledExamTitle);
    setters.setScheduledTimeLimitMinutes(scheduledTimeLimitMinutes);
    setters.setMapels(scheduledMapels);
    setters.setBabs(scheduledBabs);
    setters.setSubBabs(scheduledSubBabs);
    // Seed available lookup arrays so mapelsLabel/babsLabel/subBabsLabel resolve immediately
    // (useExamDerivedValues needs available* to map slugs → display labels)
    setters.setAvailableMapels(scheduledMapels.map(m => ({ value: m, label: m })));
    setters.setAvailableBabs(scheduledBabs.map(b => ({ value: b, label: b })));
    setters.setAvailableSubBabs(scheduledSubBabs.map(s => ({ value: s, label: s })));
    setters.setTimeLimit(scheduledTimeLimitMinutes);
    setters.setStep(3);
    try {
      const firstQ = await getSessionQuestionViaRpc(sessionId, 0);
      setters.setCurrentQuestion(firstQ);
    } catch {
      setters.setCurrentQuestion(null);
    }
  }, [setters]);

  if (!state.isRestored) {
    return <RestoringSessionView />;
  }

  if (state.step === 1) {
    return (
      <div className="flex-1 flex flex-col pt-10 md:pt-16 px-5 sm:px-6 pb-10">
        <div className="max-w-2xl mx-auto w-full">
          <div className="mb-7 md:mb-10">
            <p className="text-[12px] font-medium text-nike-grey-500 mb-2 tracking-tight">Smandapura Exam</p>
            <h1 className="font-display text-[36px] sm:text-[48px] text-nike-black leading-[1.05] tracking-[-0.02em] mb-2">
              Take the exam.
            </h1>
            <p className="text-[14px] text-nike-grey-500 tracking-tight">Pick your mode, your topic, and start whenever you’re ready.</p>
            <button
              type="button"
              onClick={() => setIsTutorialOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-black/5 text-nike-black text-[13px] font-medium hover:bg-black/10 transition-spring-fast active:scale-95 tracking-tight"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
              Lihat tutorial
            </button>
          </div>
          <div className="max-w-md w-full space-y-5">
            <div className="space-y-2">
              <span className="flex items-center text-[12px] font-medium text-nike-grey-500 tracking-tight">
                Mode
                <HelpTooltip text="Pilih mode ujian: Exam (biasa) atau Survival (nyawa terbatas)." />
              </span>
              <div className="grid grid-cols-2 gap-3">
                <NeumorphButton
                  type="button"
                  size="medium"
                  intent={state.gameMode === 'exam' ? 'primary' : 'secondary'}
                  pressed={state.gameMode === 'exam'}
                  fullWidth
                  onClick={() => setters.setGameMode('exam')}
                >
                  Exam
                </NeumorphButton>
                <NeumorphButton
                  type="button"
                  size="medium"
                  intent={state.gameMode === 'survival' ? 'primary' : 'secondary'}
                  pressed={state.gameMode === 'survival'}
                  fullWidth
                  onClick={() => { setters.setGameMode('survival'); setters.setExamMode('strict'); }}
                >
                  Survival
                </NeumorphButton>
              </div>
              <NeumorphButton
                type="button"
                size="medium"
                intent="primary"
                fullWidth
                layoutId="join-quiz-expandable"
                onClick={() => setters.setIsJoinModalOpen(true)}
              >
                Join with code
              </NeumorphButton>
              <NeumorphButton
                type="button"
                size="medium"
                intent="secondary"
                fullWidth
                layoutId="scheduled-exam-expandable"
                onClick={() => setIsScheduledModalOpen(true)}
              >
                Ujian terjadwal
              </NeumorphButton>
            </div>

            {!state.isSurvival && (
              <div className="space-y-2">
                <span className="flex items-center text-[12px] font-medium text-nike-grey-500 tracking-tight">
                  Navigation
                  <HelpTooltip text="Strict: Soal berurutan, tidak bisa kembali. Standard: Bebas navigasi dan bisa menandai ragu-ragu." />
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <NeumorphButton
                    type="button"
                    size="medium"
                    intent={state.examMode === 'strict' ? 'primary' : 'secondary'}
                    pressed={state.examMode === 'strict'}
                    fullWidth
                    onClick={() => setters.setExamMode('strict')}
                  >
                    Strict
                  </NeumorphButton>
                  <NeumorphButton
                    type="button"
                    size="medium"
                    intent={state.examMode === 'standard' ? 'primary' : 'secondary'}
                    pressed={state.examMode === 'standard'}
                    fullWidth
                    onClick={() => setters.setExamMode('standard')}
                  >
                    Standard
                  </NeumorphButton>
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
                maxLength={16}
                onChange={(e) => setters.setUserName(e.target.value.slice(0, 16))}
                placeholder="Enter name"
                className="neumorph-pulse-control w-full h-11 rounded-2xl bg-black/5 px-4 text-[14px] font-medium text-nike-black placeholder-nike-grey-500/70 focus:outline-none focus:bg-black/10 transition-spring-fast"
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <span className="flex items-center text-[12px] font-medium text-nike-grey-500 tracking-tight">
                  Time limit
                  <HelpTooltip text="Batas waktu maksimal untuk menyelesaikan seluruh soal." />
                </span>
                <SingleSelectDropdown
                  options={TIME_LIMIT_OPTIONS}
                  value={state.timeLimit}
                  onChange={setters.setTimeLimit}
                  placeholder="Choose time limit"
                />
              </div>

              <div className="space-y-2">
                <span className="flex items-center text-[12px] font-medium text-nike-grey-500 tracking-tight">
                  Question count
                  <HelpTooltip text="Jumlah soal yang ingin dikerjakan." />
                </span>
                <SingleSelectDropdown
                  options={QUESTION_COUNTS.map((count) => ({ value: count, label: `${count} questions` }))}
                  value={state.questionCount}
                  onChange={setters.setQuestionCount}
                  placeholder="Choose question count"
                />
              </div>
            </div>

            <NeumorphButton
              type="button"
              size="medium"
              intent="primary"
              fullWidth
              onClick={() => setters.setStep(2)}
              disabled={
                !state.userName.trim() ||
                state.mapels.length === 0 ||
                state.babs.length === 0 ||
                state.subBabs.length === 0
              }
              className="h-12 text-[14px]"
            >
              Begin session
            </NeumorphButton>
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

          <TutorialModal
            isOpen={isTutorialOpen}
            onClose={closeTutorial}
          />

          <ScheduledExamEntry
            isOpen={isScheduledModalOpen}
            onExamStarted={(sessionId, questionCount, expiresAt, navMode, scheduledExamTitle, scheduledMapels, scheduledBabs, scheduledSubBabs, scheduledTimeLimitMinutes) => {
              void handleScheduledExamStarted(sessionId, questionCount, expiresAt, navMode, scheduledExamTitle, scheduledMapels, scheduledBabs, scheduledSubBabs, scheduledTimeLimitMinutes);
            }}
            onClose={() => setIsScheduledModalOpen(false)}
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
            isScheduledExam={state.isScheduledExam}
            scheduledExamTitle={state.scheduledExamTitle}
            scheduledTimeLimitMinutes={state.scheduledTimeLimitMinutes}
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
