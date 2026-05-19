"use client";

import React from 'react';

type QuestionActionButtonsProps = {
  isStandard: boolean;
  current: number;
  total: number;
  isLoading: boolean;
  doubtFlags: boolean[];
  hasAnswerSelected: boolean;
  feedbackResult: 'correct' | 'wrong' | null;
  isSurvival: boolean;
  onGoPrev: () => void;
  onToggleDoubt: () => void;
  onStandardNext: () => void;
  onStrictNext: () => void;
  onOpenSubmitConfirm: () => void;
  onOpenSurrenderConfirm: () => void;
  onSkip: () => void;
};

export default function QuestionActionButtons({
  isStandard,
  current,
  total,
  isLoading,
  doubtFlags,
  hasAnswerSelected,
  feedbackResult,
  isSurvival,
  onGoPrev,
  onToggleDoubt,
  onStandardNext,
  onStrictNext,
  onOpenSubmitConfirm,
  onOpenSurrenderConfirm,
  onSkip,
}: QuestionActionButtonsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 border-t border-black/[0.06] pt-6">
      {isStandard ? (
        <>
          <button
            onClick={onGoPrev}
            disabled={current === 0 || isLoading}
            className="w-full sm:flex-1 h-12 rounded-full bg-black/5 text-nike-black text-[13px] font-medium hover:bg-black/10 transition-spring-fast active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed tracking-tight"
          >
            Back
          </button>
          <button
            onClick={onToggleDoubt}
            className={`w-full sm:flex-1 h-12 rounded-full text-[13px] font-medium transition-spring-fast active:scale-95 tracking-tight ${doubtFlags[current]
              ? 'bg-yellow-400 text-nike-black shadow-ios-sm'
              : 'bg-black/5 text-nike-grey-500 hover:bg-black/10'
              }`}
          >
            Ragu-ragu
          </button>
          <button
            onClick={() => {
              if (current >= total - 1) {
                onOpenSubmitConfirm();
              } else {
                onStandardNext();
              }
            }}
            disabled={isLoading}
            className="w-full sm:flex-1 h-12 rounded-full bg-nike-black text-white text-[13px] font-medium hover:bg-nike-grey-500 transition-spring-fast active:scale-[0.98] disabled:bg-black/5 disabled:text-nike-grey-500 disabled:cursor-not-allowed tracking-tight shadow-ios-sm"
          >
            {current >= total - 1 ? 'Finish' : 'Next'}
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onStrictNext}
            disabled={!hasAnswerSelected || feedbackResult !== null}
            className="w-full sm:flex-1 h-12 rounded-full bg-nike-black text-white text-[13px] font-medium hover:bg-nike-grey-500 transition-spring-fast active:scale-[0.98] disabled:bg-black/5 disabled:text-nike-grey-500 disabled:cursor-not-allowed tracking-tight shadow-ios-sm"
          >
            Next question
          </button>
          {isSurvival ? (
            <button
              onClick={onOpenSurrenderConfirm}
              className="w-full sm:w-auto sm:px-6 h-12 rounded-full bg-nike-red/10 text-nike-red text-[13px] font-medium hover:bg-nike-red/15 transition-spring-fast active:scale-95 tracking-tight"
            >
              Surrender
            </button>
          ) : (
            <button
              onClick={onSkip}
              className="w-full sm:w-auto sm:px-6 h-12 rounded-full bg-black/5 text-nike-grey-500 text-[13px] font-medium hover:bg-black/10 hover:text-nike-black transition-spring-fast active:scale-95 tracking-tight"
            >
              Skip
            </button>
          )}
        </>
      )}
    </div>
  );
}
