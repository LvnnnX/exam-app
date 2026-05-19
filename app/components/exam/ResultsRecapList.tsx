"use client";

import React from 'react';
import RichContent from '@/app/components/RichContent';

type RecapItem = {
  user_answer: string | null;
  correct_text: string;
  is_correct: boolean;
  question_text: string;
};

type ResultsRecapListProps = {
  recapData: RecapItem[];
};

export default function ResultsRecapList({ recapData }: ResultsRecapListProps) {
  return (
    <div className="space-y-3 mb-8">
      {recapData
        .map((item, idx) => {
          const userAnswer = item.user_answer;
          const isCorrect = item.is_correct;
          const isSkipped = !userAnswer;

          return (
            <div key={idx} className="bg-black/[0.03] p-5 sm:p-6 rounded-3xl">
              <div className="flex gap-3 mb-3">
                <span className="text-[12px] font-medium text-nike-grey-500 tabular-nums shrink-0 mt-0.5 tracking-tight">{(idx + 1).toString().padStart(2, '0')}</span>
                <RichContent html={item.question_text} className="text-[14px] sm:text-[15px] font-medium text-nike-black leading-snug flex-1 min-w-0 tracking-tight" />
              </div>

              <div className="ml-7 sm:ml-9">
                {isSkipped ? (
                  <span className="inline-flex items-center px-3 h-7 rounded-full bg-black/5 text-nike-grey-500 text-[11px] font-medium tracking-tight">Skipped</span>
                ) : isCorrect ? (
                  <div className="flex items-start gap-2.5">
                    <span className="inline-flex items-center px-2.5 h-6 rounded-full bg-nike-green/10 text-nike-green text-[10px] font-medium tracking-tight shrink-0 mt-0.5">Correct</span>
                    <RichContent html={userAnswer} className="text-[13px] font-medium text-nike-black flex-1 min-w-0 tracking-tight" />
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <span className="inline-flex items-center px-2.5 h-6 rounded-full bg-nike-red/10 text-nike-red text-[10px] font-medium tracking-tight shrink-0 mt-0.5">Wrong</span>
                    <RichContent html={userAnswer} className="text-[13px] font-medium text-nike-red flex-1 min-w-0 tracking-tight" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
