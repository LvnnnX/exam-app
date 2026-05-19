"use client";

import { useState, useRef } from 'react';
import { normalizeQuizCode, type KuisLog, type Player } from '@/lib/quiz';
import { type ShuffledQuestion } from '@/lib/questions';
import { useRouter } from 'next/navigation';
import useQuizFinishConfetti from '@/app/hooks/useQuizFinishConfetti';
import useQuizLeaderboardAnimation from '@/app/hooks/useQuizLeaderboardAnimation';
import useQuizSecurityGuard from '@/app/hooks/useQuizSecurityGuard';
import useQuizSessionSync from '@/app/hooks/useQuizSessionSync';
import useQuizSessionActions from '@/app/hooks/useQuizSessionActions';
import useQuizLeaderboardData from '@/app/hooks/useQuizLeaderboardData';
import useQuizRankBadgeClasses from '@/app/hooks/useQuizRankBadgeClasses';
import useQuizProgressOps from '@/app/hooks/useQuizProgressOps';
import useSelectedAnswerRef from '@/app/hooks/useSelectedAnswerRef';

type AnswerData = string;

export default function useQuizSessionController(code: string) {
  const quizCode = normalizeQuizCode(code);
  const router = useRouter();

  const [session, setSession] = useState<KuisLog | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [name, setName] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<ShuffledQuestion | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useQuizFinishConfetti(isFinished);

  const [startTime, setStartTime] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeftDisplay, setTimeLeftDisplay] = useState<string>('');
  const [waitTimer, setWaitTimer] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerData | null>(null);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [doubtFlags, setDoubtFlags] = useState<boolean[]>([]);
  const [localAnswers, setLocalAnswers] = useState<(string | null)[]>([]);
  const [showNavPopup, setShowNavPopup] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isEditHorseModalOpen, setIsEditHorseModalOpen] = useState(false);
  const [showLeaderboardView, setShowLeaderboardView] = useState(false);
  const [changingHorseSkin, setChangingHorseSkin] = useState(false);
  const isStandard = session?.quiz_mode === 'standard';
  const leaderboardRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previousLeaderboardRects = useRef<Map<string, DOMRect>>(new Map());

  const selectedAnswerRef = useSelectedAnswerRef(selectedAnswer);

  useQuizLeaderboardAnimation(leaderboard, leaderboardRowRefs, previousLeaderboardRects);

  const { getRankBadgeClasses } = useQuizRankBadgeClasses();

  const { warningCount, showWarningModal, dismissWarning } = useQuizSecurityGuard({
    session,
    player,
    isFinished,
    startTime,
    currentQuestion,
    currentIndex,
    quizCode,
    selectedAnswerRef,
    setIsFinished,
  });

  const { fetchLeaderboard } = useQuizLeaderboardData({
    session,
    setLeaderboard,
  });

  const { loadQuestion, handleTimeout } = useQuizProgressOps({
    player,
    session,
    isFinished,
    quizCode,
    currentQuestion,
    currentIndex,
    startTime,
    selectedAnswerRef,
    setLoading,
    setLoadError,
    setCurrentQuestion,
    setIsFinished,
  });


  useQuizSessionSync({
    quizCode,
    session,
    setSession,
    player,
    setPlayer,
    isFinished,
    setIsFinished,
    loading,
    setLoading,
    loadError,
    setCurrentIndex,
    setDoubtFlags,
    setLocalAnswers,
    setSelectedAnswer,
    setScore,
    currentQuestion,
    currentIndex,
    startTime,
    setStartTime,
    pausedAt,
    setPausedAt,
    setTimeLeftDisplay,
    setWaitTimer,
    fetchLeaderboard,
    loadQuestion,
    handleTimeout,
  });

  const {
    handleJoin: handleJoinAction,
    handleHorseSkinChange: handleHorseSkinChangeAction,
    handleAnswer: handleAnswerAction,
    goToQuizQuestion: goToQuizQuestionAction,
    finishStandardQuiz: finishStandardQuizAction,
  } = useQuizSessionActions({
    quizCode,
    session,
    player,
    isFinished,
    changingHorseSkin,
    currentQuestion,
    currentIndex,
    startTime,
    selectedAnswer,
    localAnswers,
    isStandard,
    name,
    setLoading,
    setPlayer,
    setDoubtFlags,
    setLocalAnswers,
    setSelectedAnswer,
    setScore,
    setCurrentIndex,
    setCurrentQuestion,
    setStartTime,
    setShowNavPopup,
    setIsFinished,
    setChangingHorseSkin,
    router,
  });

  const handleAnswer = (opt: AnswerData | null) => handleAnswerAction(opt);
  const handleHorseSkinChange = (horseSkin: string) => handleHorseSkinChangeAction(horseSkin);
  const goToQuizQuestion = (targetIndex: number) => goToQuizQuestionAction(targetIndex);
  const finishStandardQuiz = () => finishStandardQuizAction();
  const handleJoin = () => handleJoinAction();


  return {
    meta: {
      quizCode,
      router,
      isStandard,
      leaderboardRowRefs,
      getRankBadgeClasses,
    },
    state: {
      session,
      player,
      name,
      currentQuestion,
      currentIndex,
      score,
      isFinished,
      startTime,
      leaderboard,
      loading,
      timeLeftDisplay,
      waitTimer,
      selectedAnswer,
      pausedAt,
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
    },
    setters: {
      setSession,
      setPlayer,
      setName,
      setCurrentQuestion,
      setCurrentIndex,
      setScore,
      setIsFinished,
      setStartTime,
      setLeaderboard,
      setLoading,
      setTimeLeftDisplay,
      setWaitTimer,
      setSelectedAnswer,
      setPausedAt,
      setLoadError,
      setDoubtFlags,
      setLocalAnswers,
      setShowNavPopup,
      setShowSubmitConfirm,
      setIsEditHorseModalOpen,
      setShowLeaderboardView,
      setChangingHorseSkin,
    },
    actions: {
      dismissWarning,
      handleJoin,
      handleHorseSkinChange,
      handleAnswer,
      goToQuizQuestion,
      finishStandardQuiz,
    },
  };
}
