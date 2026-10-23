'use client';

import React from 'react';
import { PASS_PERCENT, isPassed, scorePercent, scoreTone } from '../logic';
import type { FinishResult, TopicLabels, UjianMode } from '../types';
import { clearToken, type LastSetup } from '../client-storage';
import { BTN_PRIMARY, BTN_SECONDARY, ChipList, END_REASON_LABEL, topicsSummary } from './ui';

interface ResultViewProps {
  summary: FinishResult & {
    name: string;
    mode: UjianMode;
    topics: TopicLabels;
  };
  lastSetup: LastSetup | null;
  onShowRecap: () => void;
  onRetry: () => void;
}

const TONE_CLASSES = {
  green: 'text-primary border-primary/30 bg-primary/10',
  blue: 'text-fg border-line bg-well',
  orange: 'text-highlight-fg border-highlight/30 bg-highlight/15',
  red: 'text-danger border-danger/30 bg-danger/10',
};

export default function ResultView({ summary, onShowRecap, onRetry }: ResultViewProps) {
  const isExam = summary.mode === 'exam';
  const percent = summary.percent ?? scorePercent(summary.score, summary.total);
  const passed = isPassed(percent);
  const tone = scoreTone(percent);
  const endText = summary.end_reason ? END_REASON_LABEL[summary.end_reason] : null;

  const handleRetry = () => {
    clearToken();
    onRetry();
  };

  return (
    <div data-testid="ujian-result" className="flex flex-col gap-6">
      <div className="glass flex flex-col items-center gap-4 rounded-4xl p-6 text-center sm:p-8">
        <span className="text-[12px] font-semibold text-fg-muted">
          Hasil ujian mandiri • {summary.mode === 'exam' ? 'Exam' : 'Survival'}
        </span>
        <h2 className="text-[22px] font-bold text-fg sm:text-[26px]">{summary.name}</h2>

        {isExam ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 sm:h-32 sm:w-32 ${TONE_CLASSES[tone]}`}
            >
              <span className="text-[34px] font-bold tabular-nums leading-none sm:text-[40px]">{percent}%</span>
              <span className="text-[12px] font-medium text-fg-muted">
                {summary.score}/{summary.total}
              </span>
            </div>
            <span
              className={`inline-flex h-7 items-center rounded-full px-3 text-[12px] font-bold ${
                passed ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger'
              }`}
            >
              {passed ? `Lulus (>= ${PASS_PERCENT}%)` : `Belum lulus (< ${PASS_PERCENT}%)`}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="clay inline-flex h-24 w-24 items-center justify-center rounded-3xl text-[36px] font-bold tabular-nums text-fg">
              {summary.score}
            </span>
            <span className="text-[13px] font-medium text-fg-muted">{summary.answered} soal terjawab</span>
          </div>
        )}

        {endText && (
          <span className="well rounded-lg px-3 py-1 text-[12px] font-medium text-fg-muted">
            Status: {endText}
          </span>
        )}

        <div className="border-t border-line pt-3">
          <ChipList items={topicsSummary(summary.topics)} max={3} />
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={handleRetry} className={BTN_SECONDARY}>
          Ulangi
        </button>
        <button type="button" onClick={onShowRecap} className={BTN_PRIMARY}>
          Lihat pembahasan
        </button>
      </div>
    </div>
  );
}
