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
    <div className="mb-0 h-auto md:h-[min(62vh,580px)] md:min-h-[400px] overflow-y-auto md:overflow-hidden rounded-3xl bg-black/[0.03] flex flex-col">
      <div className="flex flex-col md:grid md:h-full md:grid-cols-[1.4fr_1fr] flex-1">
        {/* Question section */}
        <div className="h-auto md:h-full overflow-visible md:overflow-y-auto scrollbar-stable px-5 py-5 md:px-8 md:py-8 flex flex-col flex-1 border-b border-black/[0.04] md:border-b-0 md:border-r">
          {typeof questionNumber === 'number' && (
            <div className="mb-4 pb-3 border-b border-black/[0.06] flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[20px] md:text-[22px] font-bold text-nike-black tracking-tight tabular-nums">
                Soal No. {questionNumber}
              </p>
              {isSurvival && (
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[18px] md:text-[20px] font-semibold tabular-nums text-nike-black tracking-tight">{score}</span>
                    <span className="text-[10px] font-medium text-nike-grey-500 tracking-tight">Score</span>
                  </div>
                  <span className="w-px h-5 bg-black/[0.08]" aria-hidden="true" />
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span key={i} className={`text-[16px] transition-spring-fast ${i < lives ? '' : 'grayscale opacity-25'}`}>
                        ❤️
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <RichContent
            html={currentQuestion.question_text}
            className={`exam-question-content ${fontSizeClass} font-medium text-nike-black leading-[1.4] tracking-tight`}
          />
        </div>

        {/* Answer section */}
        <div className="flex-1 h-auto md:h-full overflow-visible md:overflow-y-auto scrollbar-stable px-5 py-5 md:px-6 md:py-6 flex flex-col justify-center min-w-0">
          {currentQuestion.question_type === 'short_answer' ? (
            <div className="w-full space-y-2.5">
              <p className="text-[11px] font-medium text-nike-grey-500 tracking-tight">Jawaban singkat</p>
              <input
                type="text"
                value={selectedAnswer ?? ''}
                onChange={(event) => onSelectAnswer(event.target.value)}
                placeholder="Ketik jawaban…"
                className="w-full rounded-2xl bg-white px-4 h-11 text-[14px] font-medium text-nike-black placeholder-nike-grey-500/70 focus:outline-none transition-spring-fast shadow-ios-sm"
              />
              <p className="text-[11px] text-nike-grey-500 tracking-tight">Tekan Next untuk lanjut.</p>
            </div>
          ) : (
            <div className="space-y-1.5 w-full">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedAnswer === option.text;

                return (
                  <button
                    key={option.label}
                    onClick={() => onSelectAnswer(option.text)}
                    className={`w-full min-w-0 group flex items-center gap-2.5 px-3 py-2 md:px-3.5 md:py-2.5 rounded-2xl text-left transition-spring-fast active:scale-[0.99] ${
                      isSelected
                        ? 'bg-nike-black text-white shadow-ios-sm'
                        : 'bg-white text-nike-black hover:bg-black/[0.04]'
                    }`}
                  >
                    <span className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-medium tabular-nums transition-spring-fast ${
                      isSelected ? 'bg-white/15 text-white' : 'bg-black/[0.06] text-nike-grey-500'
                    }`}>
                      {option.label}
                    </span>
                    <RichContent
                      html={option.text}
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
  );
}
