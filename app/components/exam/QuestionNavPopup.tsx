"use client";

import React from 'react';
import { motion } from 'framer-motion';

type QuestionNavPopupProps = {
  isOpen: boolean;
  total: number;
  answers: (string | null)[];
  doubtFlags: boolean[];
  current: number;
  onClose: () => void;
  onGoToQuestion: (index: number) => void;
};

export default function QuestionNavPopup({
  isOpen,
  total,
  answers,
  doubtFlags,
  current,
  onClose,
  onGoToQuestion,
}: QuestionNavPopupProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-dark-800/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in duration-200">
      <motion.div
        layoutId="question-nav-expandable"
        transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.9 }}
        className="bg-white rounded-[28px] shadow-[0_30px_80px_rgba(0,0,0,0.45)] max-w-2xl w-full overflow-hidden"
      >
        <div className="px-5 pt-5 pb-4 border-b border-black/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[17px] font-semibold tracking-tight text-nike-black">Daftar soal</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-spring-fast active:scale-90"
            >
              <svg className="w-3.5 h-3.5 text-nike-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-nike-grey-500 tracking-tight">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-nike-black"></span> Terjawab</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span> Ragu</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-black/10"></span> Kosong</span>
          </div>
        </div>
        <div className="px-5 py-5 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
            {Array.from({ length: total }, (_, i) => {
              const isAnswered = answers[i] !== null && answers[i] !== undefined && String(answers[i]).trim().length > 0;
              const isDoubt = doubtFlags[i] || false;
              const isCurrent = i === current;
              return (
                <button
                  key={i}
                  onClick={() => onGoToQuestion(i)}
                  className={`h-10 rounded-xl text-[13px] font-medium tabular-nums transition-spring-fast active:scale-95 ${isCurrent ? 'ring-2 ring-nike-black ring-offset-2' : ''} ${isDoubt
                    ? 'bg-yellow-400 text-nike-black'
                    : isAnswered
                      ? 'bg-nike-black text-white'
                      : 'bg-black/5 text-nike-black hover:bg-black/10'
                    }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
