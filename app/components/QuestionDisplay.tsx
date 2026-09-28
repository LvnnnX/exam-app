"use client";

import React from 'react';
import { type ShuffledQuestion } from '@/lib/questions';
import RichContent from '@/app/components/RichContent';

type QuestionDisplayProps = {
  currentQuestion: ShuffledQuestion;
  selectedAnswer: string | null;
  onSelectAnswer: (answerText: string) => void;
  questionNumber?: number;
  isSurvival?: boolean;
  score?: number;
  lives?: number;
};

export function LivesIndicator({ lives, max = 3 }: { lives: number; max?: number }) {
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Nyawa ${lives} dari ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={`h-[18px] w-[18px] transition-calm ${i < lives ? 'text-danger' : 'text-fg-subtle/40'}`}
          fill={i < lives ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinejoin="round" d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z" />
        </svg>
      ))}
    </div>
  );
}

export default function QuestionDisplay({
  currentQuestion,
  selectedAnswer,
  onSelectAnswer,
  questionNumber,
  isSurvival = false,
  score = 0,
  lives = 0,
}: QuestionDisplayProps) {
  const textLength = currentQuestion.question_text.replace(/<[^>]*>/g, '').length;
  const fontSizeClass = textLength > 500 ? 'text-[14px] md:text-[16px]' :
                        textLength > 250 ? 'text-[15px] md:text-[18px]' :
                        'text-[16px] md:text-[20px]';

  return (
    <div className="glass mb-0 flex h-auto flex-col overflow-y-auto rounded-3xl md:h-[min(62vh,580px)] md:min-h-[400px] md:overflow-hidden">
      <div className="flex flex-1 flex-col md:grid md:h-full md:grid-cols-[1.4fr_1fr]">
        {/* Question section */}
        <div className="scrollbar-stable flex h-auto flex-1 flex-col overflow-visible border-b border-line px-5 py-5 md:h-full md:overflow-y-auto md:border-b-0 md:border-r md:px-8 md:py-7">
          {typeof questionNumber === 'number' && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <span className="clay flex h-10 min-w-10 items-center justify-center rounded-xl px-2 text-[17px] font-bold tabular-nums" aria-hidden="true">
                  {questionNumber}
                </span>
                <p className="text-[18px] font-bold tabular-nums tracking-tight text-fg md:text-[20px]">
                  Soal No. {questionNumber}
                </p>
              </div>
              {isSurvival && (
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[20px] font-bold tabular-nums text-fg">{score}</span>
                    <span className="text-[12px] font-medium text-fg-muted">Score</span>
                  </div>
                  <span className="h-5 w-px bg-line-strong" aria-hidden="true" />
                  <LivesIndicator lives={lives} />
                </div>
              )}
            </div>
          )}
          <RichContent
            html={currentQuestion.question_text}
            className={`exam-question-content ${fontSizeClass} font-medium leading-[1.45] text-fg`}
          />
        </div>

        {/* Answer section */}
        <div className="scrollbar-stable flex h-auto min-w-0 flex-1 flex-col justify-center overflow-visible px-4 py-5 md:h-full md:overflow-y-auto md:px-6 md:py-6">
          {currentQuestion.question_type === 'short_answer' ? (
            <div className="w-full space-y-2.5">
              <label htmlFor="short-answer-input" className="text-[13px] font-medium text-fg-muted">Jawaban singkat</label>
              <input
                id="short-answer-input"
                type="text"
                value={selectedAnswer ?? ''}
                onChange={(event) => onSelectAnswer(event.target.value)}
                placeholder="Ketik jawaban…"
                className="well h-12 w-full rounded-xl px-4 text-[15px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
              />
              <p className="text-[12px] text-fg-muted">Tekan Next untuk lanjut.</p>
            </div>
          ) : (
            <div className="w-full space-y-2" role="group" aria-label="Pilihan jawaban">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedAnswer === option.text;

                return (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectAnswer(option.text)}
                    className={`group flex min-h-12 w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-calm md:px-3.5 ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'well well-hover text-fg'
                    }`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold tabular-nums transition-calm ${
                      isSelected ? 'bg-on-primary/20 text-on-primary' : 'border border-line-strong text-fg-muted'
                    }`}>
                      {option.label}
                    </span>
                    <RichContent
                      html={option.text}
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
  );
}
