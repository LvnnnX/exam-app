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
    <>
      <div className="mb-12">
        <RichContent
          html={currentQuestion.question_text}
          className="text-[32px] md:text-[40px] font-bold text-nike-black leading-[1.1] tracking-tight"
        />
      </div>

      <div className="space-y-4 mb-12">
        {currentQuestion.options.map((option) => {
          const isSelected = selectedAnswer === option.label;

          return (
            <button
              key={option.label}
              onClick={() => onSelectAnswer(option.label)}
              className={`w-full p-6 sm:px-8 rounded-[30px] text-left transition-all ${
                isSelected
                  ? 'bg-nike-black border-[1.5px] border-nike-black text-nike-white'
                  : 'bg-transparent border-[1.5px] border-nike-grey-300 text-nike-black hover:border-nike-grey-500 hover:bg-nike-grey-100'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className={`font-bold mt-0.5 ${isSelected ? 'text-nike-grey-300' : 'text-nike-grey-500'}`}>
                  {option.label}.
                </span>
                <RichContent
                  html={option.text}
                  className={`flex-1 text-[16px] sm:text-[18px] ${isSelected ? 'text-nike-white' : 'text-nike-black'}`}
                />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}