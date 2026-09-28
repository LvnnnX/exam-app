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

const secondary = 'well well-hover h-12 w-full rounded-xl text-[14px] font-medium text-fg transition-calm disabled:cursor-not-allowed disabled:opacity-40 sm:flex-1';

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
    <div className="mt-5 flex flex-col items-center gap-2 border-t border-line pt-5 sm:flex-row">
      {isStandard ? (
        <>
          <button
            type="button"
            onClick={onGoPrev}
            disabled={current === 0 || isLoading}
            className={secondary}
          >
            Back
          </button>
          <button
            type="button"
            aria-pressed={Boolean(doubtFlags[current])}
            onClick={onToggleDoubt}
            className={`h-12 w-full rounded-xl text-[14px] font-semibold transition-calm sm:flex-1 ${doubtFlags[current]
              ? 'clay-highlight'
              : 'well well-hover text-fg-muted'
              }`}
          >
            Ragu-ragu
          </button>
          <button
            type="button"
            onClick={() => {
              if (current >= total - 1) {
                onOpenSubmitConfirm();
              } else {
                onStandardNext();
              }
            }}
            disabled={isLoading}
            className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold sm:flex-1"
          >
            {current >= total - 1 ? 'Finish' : 'Next'}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onStrictNext}
            disabled={!hasAnswerSelected || feedbackResult !== null}
            className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold sm:flex-1"
          >
            Next question
          </button>
          {isSurvival ? (
            <button
              type="button"
              onClick={onOpenSurrenderConfirm}
              className="h-12 w-full rounded-xl bg-danger/10 px-6 text-[14px] font-semibold text-danger transition-calm hover:bg-danger/15 sm:w-auto"
            >
              Surrender
            </button>
          ) : (
            <button
              type="button"
              onClick={onSkip}
              className="well well-hover h-12 w-full rounded-xl px-6 text-[14px] font-medium text-fg-muted transition-calm hover:text-fg sm:w-auto"
            >
              Skip
            </button>
          )}
        </>
      )}
    </div>
  );
}
