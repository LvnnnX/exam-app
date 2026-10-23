"use client";

import useExamJoinByCode from '@/app/hooks/useExamJoinByCode';

type UseExamJoinWiringArgs = {
  quizCodeLength: number;
};

export default function useExamJoinWiring({ quizCodeLength }: UseExamJoinWiringArgs) {
  const {
    state: joinState,
    setters: joinSetters,
    actions: joinActions,
  } = useExamJoinByCode({ quizCodeLength });

  return {
    joinState,
    setIsJoinModalOpen: joinSetters.setIsJoinModalOpen,
    handleJoinQuiz: joinActions.handleJoinQuiz,
    handleQuizCodeChange: joinActions.handleQuizCodeChange,
    closeJoinModal: joinActions.closeJoinModal,
  };
}
