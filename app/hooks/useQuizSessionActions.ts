"use client";

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { secureSave, secureRemove } from '@/lib/security';
import {
  joinLiveQuiz,
  submitSecureAnswer,
  finishPlayerQuiz,
  updatePlayerHorseSkin,
  type KuisLog,
  type Player,
} from '@/lib/quiz';
import { supabase } from '@/lib/supabase';
import { type ShuffledQuestion } from '@/lib/questions';

type UseQuizSessionActionsArgs = {
  quizCode: string;
  session: KuisLog | null;
  player: Player | null;
  isFinished: boolean;
  changingHorseSkin: boolean;
  currentQuestion: ShuffledQuestion | null;
  currentIndex: number;
  startTime: number;
  selectedAnswer: string | null;
  localAnswers: (string | null)[];
  isStandard: boolean;
  name: string;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setPlayer: Dispatch<SetStateAction<Player | null>>;
  setDoubtFlags: Dispatch<SetStateAction<boolean[]>>;
  setLocalAnswers: Dispatch<SetStateAction<(string | null)[]>>;
  setSelectedAnswer: Dispatch<SetStateAction<string | null>>;
  setScore: Dispatch<SetStateAction<number>>;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setCurrentQuestion: Dispatch<SetStateAction<ShuffledQuestion | null>>;
  setStartTime: Dispatch<SetStateAction<number>>;
  setShowNavPopup: Dispatch<SetStateAction<boolean>>;
  setIsFinished: Dispatch<SetStateAction<boolean>>;
  setChangingHorseSkin: Dispatch<SetStateAction<boolean>>;
  router: AppRouterInstance;
};

export default function useQuizSessionActions({
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
}: UseQuizSessionActionsArgs) {
  const handleJoin = useCallback(async () => {
    if (!name.trim()) return;
    setLoading(true);

    if ((session?.status === 'active' || session?.status === 'paused') && session?.allow_join_mid_game === false) {
      alert('Maaf, kuis ini telah dimulai dan tidak menerima peserta baru.');
      setLoading(false);
      return;
    }

    const result = await joinLiveQuiz(quizCode, name.trim());
    if ('error' in result) {
      alert(result.error);
      setLoading(false);
      return;
    }

    setPlayer(result);
    secureSave(`quiz_player_${quizCode}`, result.id);
    secureSave(`quiz_index_${quizCode}`, '0');
    if (session) {
      setDoubtFlags(Array(session.question_count).fill(false));
      setLocalAnswers(Array(session.question_count).fill(null));
      secureSave(`quiz_doubts_${quizCode}`, JSON.stringify(Array(session.question_count).fill(false)));
      secureSave(`quiz_answers_${quizCode}`, JSON.stringify(Array(session.question_count).fill(null)));
    }
    setLoading(false);
  }, [name, setLoading, session, quizCode, setPlayer, setDoubtFlags, setLocalAnswers]);

  const handleHorseSkinChange = useCallback(async (horseSkin: string) => {
    if (!player || !session || session.status !== 'waiting' || changingHorseSkin) return;
    if (player.horse_skin === horseSkin) return;

    setChangingHorseSkin(true);
    const result = await updatePlayerHorseSkin(player.id, horseSkin);
    if ('error' in result) {
      alert(result.error);
      setChangingHorseSkin(false);
      return;
    }

    setPlayer((prev) => (prev ? { ...prev, horse_skin: result.horse_skin } : prev));
    setChangingHorseSkin(false);
  }, [player, session, changingHorseSkin, setChangingHorseSkin, setPlayer]);

  const handleAnswer = useCallback(async (opt: string | null) => {
    if (!player || !session || isFinished) return;
    if (session.status !== 'active') return;
    if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) return;

    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    if (!currentQuestion) return;
    const answerText = opt || '';

    const result = await submitSecureAnswer(player.id, currentQuestion.id, answerText, timeTaken, currentIndex);
    const isCorrect = result.success ? result.is_correct : false;

    if (isStandard) {
      const updated = [...localAnswers];
      updated[currentIndex] = answerText;
      setLocalAnswers(updated);
    }

    if (isCorrect) setScore(s => s + 1);

    setSelectedAnswer(null);
    if (currentIndex + 1 < (session?.question_count || 0)) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setCurrentQuestion(null);
      secureSave(`quiz_index_${quizCode}`, nextIndex.toString());
      setStartTime(Date.now());
    } else {
      await finishPlayerQuiz(player.id);
      secureRemove(`quiz_index_${quizCode}`);
      secureRemove(`quiz_player_${quizCode}`);
      setIsFinished(true);
      router.replace(`/quiz/${quizCode}`);
    }
  }, [player, session, isFinished, startTime, currentQuestion, currentIndex, isStandard, localAnswers, setLocalAnswers, setScore, setSelectedAnswer, setCurrentIndex, setCurrentQuestion, quizCode, setStartTime, setIsFinished, router]);

  const goToQuizQuestion = useCallback(async (targetIndex: number) => {
    if (!player || !session || isFinished) return;
    if (session.status !== 'active') return;
    if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) return;
    if (targetIndex < 0 || targetIndex >= (session.question_count || 0)) return;
    if (targetIndex === currentIndex) {
      setShowNavPopup(false);
      return;
    }
    setShowNavPopup(false);

    const updatedAnswers = [...localAnswers];
    if (selectedAnswer && currentQuestion) {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      await submitSecureAnswer(player.id, currentQuestion.id, selectedAnswer, timeTaken, currentIndex);
      updatedAnswers[currentIndex] = selectedAnswer;
      setLocalAnswers(updatedAnswers);
      secureSave(`quiz_answers_${quizCode}`, JSON.stringify(updatedAnswers));
    }

    setSelectedAnswer(updatedAnswers[targetIndex] || null);
    setCurrentIndex(targetIndex);
    setCurrentQuestion(null);
    secureSave(`quiz_index_${quizCode}`, targetIndex.toString());
    setStartTime(Date.now());
  }, [player, session, isFinished, currentIndex, localAnswers, selectedAnswer, currentQuestion, startTime, setShowNavPopup, setLocalAnswers, setSelectedAnswer, setCurrentIndex, setCurrentQuestion, quizCode, setStartTime]);

  const finishStandardQuiz = useCallback(async () => {
    if (!player || isFinished) return;
    if (session?.status !== 'active') return;
    const isExpired = session.expires_at && new Date(session.expires_at).getTime() <= Date.now();
    if (isExpired) return;
    if (selectedAnswer && currentQuestion) {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      await submitSecureAnswer(player.id, currentQuestion.id, selectedAnswer, timeTaken, currentIndex);
    }
    await finishPlayerQuiz(player.id);

    // Re-fetch the player from DB so the React state mirrors the final
    // server-side score (standard mode submits via RPC; local React `score`
    // was never bumped while answering).
    const { data: refreshed } = await supabase
      .from('public_players')
      .select('id, name, kuis_id, score, total_time, finished_at, joined_at, horse_skin')
      .eq('id', player.id)
      .single();
    if (refreshed) {
      setPlayer({ ...refreshed, question_ids: [] } as Player);
      if (typeof refreshed.score === 'number') {
        setScore(refreshed.score);
      }
    }

    // Keep quiz_player_<code> so a refresh on the leaderboard still recognises
    // the user (and shows "Skor kamu"). Only clear in-progress artefacts.
    secureRemove(`quiz_index_${quizCode}`);
    secureRemove(`quiz_answers_${quizCode}`);
    secureRemove(`quiz_doubts_${quizCode}`);
    setIsFinished(true);
    router.replace(`/quiz/${quizCode}`);
  }, [player, isFinished, session, selectedAnswer, currentQuestion, startTime, currentIndex, quizCode, setIsFinished, setPlayer, setScore, router]);

  return {
    handleJoin,
    handleHorseSkinChange,
    handleAnswer,
    goToQuizQuestion,
    finishStandardQuiz,
  };
}
