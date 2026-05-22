"use client";

import React, { useMemo, useState } from 'react';
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
  name: string;
  duration: number;
  questionCount: number;
  mode: 'wrong_only' | 'wrong_similar' | 'topic_based';
  studentKeys: string[];
};

export default function RemedialQuizBuilder({
  selectedStudentKeys,
  studentNames,
  remedialCandidates,
  questionPool,
  onClose,
  onCreateQuiz,
  theme = 'dark',
}: RemedialQuizBuilderProps) {
  const [quizName, setQuizName] = useState('Remedial Quiz');
  const [duration, setDuration] = useState(60);
  const [questionCount, setQuestionCount] = useState(20);
  const [mode, setMode] = useState<'wrong_only' | 'wrong_similar' | 'topic_based'>('wrong_only');

  const availableQuestions = useMemo(() => buildRemedialQuestionPool({
    mode,
    studentKeys: selectedStudentKeys,
    remedialCandidates,
    questionPool,
  }), [mode, selectedStudentKeys, remedialCandidates, questionPool]);

  const questionOptions = useMemo(() => {
    const presets = [5, 10, 20, 30, 50, 100];
    const capped = presets.filter((value) => value <= availableQuestions.length);
    return capped.length > 0 ? capped : availableQuestions.length > 0 ? [availableQuestions.length] : [];
  }, [availableQuestions.length]);

  const effectiveQuestionCount = availableQuestions.length > 0 ? Math.min(questionCount, availableQuestions.length) : questionCount;

  const handleCreate = () => {
    onCreateQuiz({
      name: quizName,
      duration,
      questionCount: effectiveQuestionCount,
      mode,
      studentKeys: selectedStudentKeys,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border p-7 shadow-ios-xl ${
          theme === 'dark'
            ? 'border-dark-border-subtle bg-dark-800 remedial-modal-scroll-dark'
            : 'border-[#E5E5E5] bg-white remedial-modal-scroll-light'
        }`}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
              }`}
            >
              Smart remedial quiz
            </p>
            <h3
              className={`mt-1 text-[22px] font-semibold tracking-tight ${
                theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'
              }`}
            >
              Create remedial quiz
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`h-10 rounded-full border px-4 text-[11px] font-semibold transition-spring-fast hover:scale-[1.02] ${
              theme === 'dark'
                ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary hover:border-dark-text-primary'
                : 'border-[#cacacb] bg-white text-gray-900 hover:border-gray-900'
            }`}
          >
            Cancel
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label
              className={`mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] ${
                theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
              }`}
            >
              Quiz name
            </label>
            <input
              type="text"
              value={quizName}
              onChange={(e) => setQuizName(e.target.value)}
              className={`h-11 w-full rounded-2xl border px-4 text-sm font-medium transition-spring-fast focus:outline-none focus:ring-2 ${
                theme === 'dark'
                  ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary focus:border-accent-blue focus:ring-accent-blue/10'
                  : 'border-[#E5E5E5] bg-white text-gray-900 focus:border-gray-900 focus:ring-gray-900/10'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className={`mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] ${
                  theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
                }`}
              >
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={`h-11 w-full cursor-pointer rounded-2xl border px-4 text-sm font-medium transition-spring-fast focus:outline-none focus:ring-2 ${
                  theme === 'dark'
                    ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary focus:border-accent-blue focus:ring-accent-blue/10'
                    : 'border-[#E5E5E5] bg-white text-gray-900 focus:border-gray-900 focus:ring-gray-900/10'
                }`}
              >
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
                <option value={120}>120 minutes</option>
                <option value={150}>150 minutes</option>
                <option value={180}>180 minutes</option>
              </select>
            </div>
            <div>
              <label
                className={`mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] ${
                  theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
                }`}
              >
                Questions
              </label>
              <select
                value={effectiveQuestionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className={`h-11 w-full cursor-pointer rounded-2xl border px-4 text-sm font-medium transition-spring-fast focus:outline-none focus:ring-2 ${
                  theme === 'dark'
                    ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary focus:border-accent-blue focus:ring-accent-blue/10'
                    : 'border-[#E5E5E5] bg-white text-gray-900 focus:border-gray-900 focus:ring-gray-900/10'
                }`}
              >
                {questionOptions.map((value) => (
                  <option key={value} value={value}>{value} questions</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              className={`mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] ${
                theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
              }`}
            >
              Question selection mode
            </label>
            <div className="space-y-2.5">
              {([
                { value: 'wrong_only', label: 'Only Wrong Questions', desc: 'Include only questions students got wrong' },
                { value: 'wrong_similar', label: 'Wrong + Similar', desc: 'Include wrong questions plus similar ones from same topics' },
                { value: 'topic_based', label: 'Topic-Based', desc: 'Include all questions from weak topics' },
              ] as Array<{ value: QuizConfig['mode']; label: string; desc: string }>).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`w-full rounded-2xl border p-3.5 text-left transition-spring hover:scale-[1.01] ${
                    mode === option.value
                      ? theme === 'dark'
                        ? 'border-accent-blue/40 bg-accent-blue/12 shadow-ios-sm'
                        : 'border-blue-600/40 bg-blue-50 shadow-ios-sm'
                      : theme === 'dark'
                      ? 'border-dark-border-subtle bg-white/[0.03] hover:bg-white/[0.05]'
                      : 'border-[#E5E5E5] bg-black/[0.02] hover:bg-black/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        mode === option.value
                          ? theme === 'dark'
                            ? 'border-accent-blue'
                            : 'border-blue-600'
                          : theme === 'dark'
                          ? 'border-dark-border-medium'
                          : 'border-gray-300'
                      }`}
                    >
                      {mode === option.value && (
                        <div
                          className={`h-2 w-2 rounded-full ${
                            theme === 'dark' ? 'bg-accent-blue' : 'bg-blue-600'
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-semibold tracking-tight ${
                          theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'
                        }`}
                      >
                        {option.label}
                      </p>
                      <p
                        className={`text-xs font-medium ${
                          theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
                        }`}
                      >
                        {option.desc}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              theme === 'dark'
                ? 'border-dark-border-subtle bg-white/[0.03]'
                : 'border-[#E5E5E5] bg-black/[0.02]'
            }`}
          >
            <p
              className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
              }`}
            >
              Selected students ({selectedStudentKeys.length})
            </p>
            <div className="space-y-1.5">
              {studentNames.map((name, index) => (
                <p
                  key={index}
                  className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'
                  }`}
                >
                  • {name}
                </p>
              ))}
            </div>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              theme === 'dark'
                ? 'border-dark-border-subtle bg-white/[0.03]'
                : 'border-[#E5E5E5] bg-black/[0.02]'
            }`}
          >
            <p
              className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
              }`}
            >
              Available questions
            </p>
            <p
              className={`text-2xl font-semibold tabular-nums ${
                theme === 'dark' ? 'text-accent-blue' : 'text-blue-600'
              }`}
            >
              {availableQuestions.length} questions
            </p>
            <p
              className={`text-xs font-medium ${
                theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
              }`}
            >
              Questions that selected students answered incorrectly.
            </p>
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`h-12 flex-1 rounded-full border text-sm font-semibold transition-spring hover:scale-[1.02] ${
              theme === 'dark'
                ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary hover:border-dark-text-primary'
                : 'border-[#cacacb] bg-white text-gray-900 hover:border-gray-900'
            }`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={availableQuestions.length === 0}
            className={`h-12 flex-1 rounded-full text-sm font-semibold transition-spring hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 ${
              theme === 'dark'
                ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            Create quiz
          </button>
        </div>
      </div>
    </div>
  );
}
