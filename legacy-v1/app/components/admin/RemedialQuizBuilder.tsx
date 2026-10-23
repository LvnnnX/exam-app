"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { buildRemedialQuestionPool, type RemedialQuestionLike } from '@/app/lib/remedialQuizSelection';

type RemedialCandidate = RemedialQuestionLike;

type RemedialQuizBuilderProps = {
  selectedStudentKeys: string[];
  studentNames: string[];
  remedialCandidates: RemedialCandidate[];
  questionPool: RemedialCandidate[];
  onClose: () => void;
  onCreateQuiz: (config: QuizConfig) => void;
  theme?: 'light' | 'dark';
};

type QuizConfig = {
  duration: number;
  questionCount: number;
  mode: 'wrong_only' | 'wrong_similar' | 'topic_based';
  quizMode: 'strict' | 'standard';
  studentKeys: string[];
};

const MODE_OPTIONS = [
  { value: 'wrong_only', label: 'Only wrong questions', desc: 'Include only questions students got wrong.' },
  { value: 'wrong_similar', label: 'Wrong + similar', desc: 'Wrong questions plus similar ones from the same topics.' },
  { value: 'topic_based', label: 'Topic-based', desc: 'All questions from weak topics.' },
] as const;

const POOL_NOTE: Record<QuizConfig['mode'], string> = {
  wrong_only: 'Questions that selected students answered incorrectly.',
  wrong_similar: 'Wrong questions first, then questions from the same topics.',
  topic_based: 'Questions from the topics where selected students are weakest.',
};

const fieldLabel = 'mb-2 block text-[13px] font-semibold text-fg';
const selectClass = 'well well-hover h-11 w-full cursor-pointer appearance-none rounded-xl pl-4 pr-10 text-[14px] font-medium text-fg transition-calm';
const segment = (active: boolean) =>
  `h-11 flex-1 rounded-lg text-[13px] font-semibold transition-calm ${active ? 'clay' : 'text-fg-muted hover:text-fg'}`;

function SelectChevron() {
  return (
    <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function RemedialQuizBuilder({
  selectedStudentKeys,
  studentNames,
  remedialCandidates,
  questionPool,
  onClose,
  onCreateQuiz,
  theme = 'dark',
}: RemedialQuizBuilderProps) {
  const [duration, setDuration] = useState(60);
  const [questionCount, setQuestionCount] = useState(20);
  const [mode, setMode] = useState<QuizConfig['mode']>('wrong_only');
  const [quizMode, setQuizMode] = useState<QuizConfig['quizMode']>('strict');

  const availableQuestions = useMemo(() => buildRemedialQuestionPool({
    mode,
    studentKeys: selectedStudentKeys,
    remedialCandidates,
    questionPool,
  }), [mode, selectedStudentKeys, remedialCandidates, questionPool]);

  const questionOptions = useMemo(() => {
    const presets = [5, 10, 20, 25, 30, 40, 50, 100];
    const capped = presets.filter((value) => value <= availableQuestions.length);
    return capped.length > 0 ? capped : availableQuestions.length > 0 ? [availableQuestions.length] : [];
  }, [availableQuestions.length]);

  const effectiveQuestionCount = availableQuestions.length > 0 ? Math.min(questionCount, availableQuestions.length) : questionCount;

  const handleCreate = () => {
    onCreateQuiz({
      duration,
      questionCount: effectiveQuestionCount,
      mode,
      quizMode,
      studentKeys: selectedStudentKeys,
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      data-theme={theme}
      className="glass-scrim fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remedial-builder-title"
      onClick={onClose}
    >
      <div
        className="glass-sheet animate-in remedial-modal-scroll-light max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-4xl p-5 sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-fg-muted">
              Smart remedial quiz
            </p>
            <h3 id="remedial-builder-title" className="mt-0.5 text-[22px] font-bold tracking-tight text-fg">
              Create remedial quiz
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="well well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-calm"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <span className={fieldLabel}>Mode navigasi</span>
            <div className="well flex gap-1 rounded-xl p-1" role="group" aria-label="Mode navigasi">
              <button type="button" aria-pressed={quizMode === 'strict'} onClick={() => setQuizMode('strict')} className={segment(quizMode === 'strict')}>
                Strict
              </button>
              <button type="button" aria-pressed={quizMode === 'standard'} onClick={() => setQuizMode('standard')} className={segment(quizMode === 'standard')}>
                Standard
              </button>
            </div>
            <p className="mt-2 text-[13px] text-fg-muted">
              {quizMode === 'strict'
                ? 'Soal harus dikerjakan berurutan, tidak bisa kembali.'
                : 'Peserta bisa bolak-balik soal dan menandai ragu-ragu.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="remedial-duration" className={fieldLabel}>
                Duration
              </label>
              <div className="relative">
                <select
                  id="remedial-duration"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className={selectClass}
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                  <option value={120}>120 minutes</option>
                  <option value={150}>150 minutes</option>
                  <option value={180}>180 minutes</option>
                </select>
                <SelectChevron />
              </div>
            </div>
            <div>
              <label htmlFor="remedial-question-count" className={fieldLabel}>
                Questions
              </label>
              <div className="relative">
                <select
                  id="remedial-question-count"
                  value={effectiveQuestionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  disabled={questionOptions.length === 0}
                  className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {questionOptions.length === 0 && <option value={questionCount}>No questions available</option>}
                  {questionOptions.map((value) => (
                    <option key={value} value={value}>{value} questions</option>
                  ))}
                </select>
                <SelectChevron />
              </div>
            </div>
          </div>

          <div>
            <span className={fieldLabel}>
              Question selection mode
            </span>
            <div className="space-y-2" role="radiogroup" aria-label="Question selection mode">
              {MODE_OPTIONS.map((option) => {
                const active = mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(option.value)}
                    className={`w-full rounded-2xl p-3.5 text-left transition-calm ${active ? 'bg-primary/12 ring-1 ring-primary/40' : 'well well-hover'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-primary' : 'border-line-strong'}`} aria-hidden="true">
                        {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                      </span>
                      <span className="flex-1">
                        <span className="block text-[14px] font-semibold text-fg">{option.label}</span>
                        <span className="mt-0.5 block text-[13px] text-fg-muted">{option.desc}</span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="well rounded-2xl p-4">
              <p className="mb-2 text-[13px] font-semibold text-fg-muted">
                Selected students ({selectedStudentKeys.length})
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {studentNames.map((name, index) => (
                  <li key={index} className="truncate text-[14px] font-medium text-fg">
                    {name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="clay rounded-2xl p-4">
              <p className="mb-1 text-[13px] font-semibold text-fg-muted">
                Available questions
              </p>
              <p className={`text-[28px] font-bold leading-tight tabular-nums ${availableQuestions.length === 0 ? 'text-danger' : 'text-fg'}`}>
                {availableQuestions.length}
              </p>
              <p className="text-[13px] text-fg-muted">
                {availableQuestions.length === 0
                  ? 'No questions match this mode for the selected students.'
                  : POOL_NOTE[mode]}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7 flex gap-2 border-t border-line pt-5">
          <button
            type="button"
            onClick={onClose}
            className="well well-hover h-12 flex-1 rounded-xl text-[14px] font-medium text-fg transition-calm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={availableQuestions.length === 0}
            className="clay-primary h-12 flex-1 rounded-xl text-[15px] font-semibold"
          >
            Create quiz
          </button>
        </div>
      </div>
    </div>
  );
}
