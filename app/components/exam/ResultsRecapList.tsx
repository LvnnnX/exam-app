"use client";

import React from 'react';
import RichContent from '@/app/components/RichContent';
import type { RecapItem } from '@/app/hooks/examTypes';

type ResultsRecapListProps = {
  recapData: RecapItem[];
};

export default function ResultsRecapList({ recapData }: ResultsRecapListProps) {
  if (recapData.length === 0) {
    return (
      <div className="glass mb-8 rounded-3xl px-5 py-8 text-center">
        <p className="text-[15px] font-semibold text-fg">Belum ada rekap.</p>
        <p className="mt-1 text-[13px] text-fg-muted">Rekap jawaban muncul di sini setelah sesi selesai dan tersimpan.</p>
      </div>
    );
  }

  return (
    <div className="glass mb-8 overflow-hidden rounded-3xl">
      {recapData
        .map((item, idx) => {
          const userAnswer = item.user_answer;
          const isCorrect = item.is_correct;
          const isSkipped = !userAnswer;

          return (
            <div key={item.question_id} className="border-b border-line px-5 py-5 last:border-b-0 sm:px-6">
              <div className="mb-3 flex gap-3">
                <span className="clay flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-1.5 text-[13px] font-bold tabular-nums">
                  {idx + 1}
                </span>
                <RichContent html={item.question_text} className="min-w-0 flex-1 pt-1 text-[15px] font-medium leading-snug text-fg" />
              </div>

              <div className="ml-11">
                {isSkipped ? (
                  <span className="well inline-flex h-7 items-center rounded-lg px-3 text-[12px] font-medium text-fg-muted">Skipped</span>
                ) : isCorrect ? (
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-md bg-primary/12 px-2.5 text-[12px] font-semibold text-primary">Correct</span>
                    <RichContent html={userAnswer} className="min-w-0 flex-1 text-[14px] font-medium text-fg" />
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-md bg-danger/12 px-2.5 text-[12px] font-semibold text-danger">Wrong</span>
                    <RichContent html={userAnswer} className="min-w-0 flex-1 text-[14px] font-medium text-danger" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
