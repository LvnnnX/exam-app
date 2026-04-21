"use client";

import React from 'react';
import { type ShuffledQuestion } from '@/lib/questions';
import RichContent from '@/app/components/RichContent';

type QuestionDisplayProps = {
  currentQuestion: ShuffledQuestion;
  selectedAnswer: string | null;
  onSelectAnswer: (answerLabel: string) => void;
};

export default function QuestionDisplay({
  currentQuestion,
  selectedAnswer,
  onSelectAnswer,
}: QuestionDisplayProps) {
  return (
    <div className="mb-0 h-auto md:h-[min(65vh,620px)] md:min-h-[420px] overflow-hidden border border-nike-grey-200 rounded-[24px] bg-white shadow-sm flex flex-col">
      <div className="flex flex-col md:grid md:h-full md:grid-cols-[1fr_1px_1fr] flex-1 overflow-hidden">
        {/* Step 3: Question text and media in the left column */}
        <div className="h-auto max-h-[40vh] md:h-full md:max-h-none overflow-y-auto p-6 md:p-10 flex flex-col pt-6 md:pt-12 border-b md:border-b-0 border-nike-grey-100">
          <RichContent
            html={currentQuestion.question_text}
            className="exam-question-content text-[18px] md:text-[28px] font-bold text-nike-black leading-[1.25] tracking-tight"
          />
        </div>

        {/* Step 5: Vertical divider line */}
        <div className="hidden md:flex items-center">
          <div className="w-px h-[85%] bg-nike-grey-200" aria-hidden="true" />
        </div>

        {/* Step 4: Multiple choice options from A to E in the right column */}
        <div className="flex-1 h-auto md:h-full overflow-y-auto p-6 md:p-10 flex flex-col justify-center bg-nike-grey-50 md:bg-white">
          <div className="grid grid-rows-5 gap-3 w-full">

            {currentQuestion.options.map((option) => {
              const isSelected = selectedAnswer === option.label;

              return (
                <button
                  key={option.label}
                  onClick={() => onSelectAnswer(option.label)}
                  className={`w-full group flex items-center p-4 md:p-5 rounded-[16px] text-left transition-all duration-200 border-[1.5px] ${
                    isSelected
                      ? 'bg-nike-black border-nike-black text-nike-white'
                      : 'bg-white border-nike-grey-200 text-nike-black hover:border-nike-black hover:bg-nike-grey-100'
                  }`}
                >
                  <div className="flex items-center gap-4 w-full">
                    <span className={`font-display text-[18px] md:text-[20px] transition-colors ${isSelected ? 'text-nike-grey-300' : 'text-nike-grey-500 group-hover:text-nike-black'}`}>
                      {option.label}
                    </span>
                    <div className="w-px h-6 bg-nike-grey-200 group-hover:bg-nike-grey-300 transition-colors" />
                    <RichContent
                      html={option.text}
                      className={`exam-option-content flex-1 text-[15px] md:text-[17px] font-medium leading-normal ${isSelected ? 'text-nike-white' : 'text-nike-black'}`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}