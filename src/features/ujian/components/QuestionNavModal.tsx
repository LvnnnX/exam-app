'use client';

import React from 'react';
import type { AnswerMark } from '../types';
import Modal from './Modal';
import { BTN_SECONDARY } from './ui';

interface QuestionNavModalProps {
  total: number;
  answers: AnswerMark[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export default function QuestionNavModal({ total, answers, currentIndex, onSelect, onClose }: QuestionNavModalProps) {
  const byIndex = new Map(answers.map((a) => [a.index, a]));

  return (
    <Modal
      title="Daftar nomor soal"
      onClose={onClose}
      theme="light"
      footer={
        <button type="button" onClick={onClose} className={BTN_SECONDARY}>
          Tutup
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-medium text-fg-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-primary" aria-hidden="true" /> Terjawab
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-highlight" aria-hidden="true" /> Ragu
          </span>
          <span className="flex items-center gap-1.5">
            <span className="well h-3 w-3 rounded-sm border border-line-strong" aria-hidden="true" /> Kosong
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {Array.from({ length: total }, (_, i) => {
            const mark = byIndex.get(i);
            const isCurrent = i === currentIndex;
            const isDoubt = mark?.doubtful ?? false;
            const isAnswered = mark?.answered ?? false;
            const tone = isDoubt
              ? 'bg-highlight text-on-highlight'
              : isAnswered
                ? 'bg-primary text-on-primary'
                : 'well well-hover text-fg';
            const ring = isCurrent ? 'ring-2 ring-fg ring-offset-2 ring-offset-canvas' : '';

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onSelect(i);
                  onClose();
                }}
                className={`transition-calm flex h-11 items-center justify-center rounded-xl text-[14px] font-semibold tabular-nums ${tone} ${ring}`}
                aria-label={`Soal nomor ${i + 1}${isCurrent ? ', sedang dibuka' : ''}${
                  isDoubt ? ', ditandai ragu' : isAnswered ? ', terjawab' : ', belum dijawab'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
