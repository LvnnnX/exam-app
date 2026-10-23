"use client";

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import RichContent from '@/app/components/RichContent';

type QuestionData = {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_answer: string;
  question_type: string;
  short_answer: string;
  mapels: string[];
  babs: string[];
  sub_babs: string[];
};

type QuestionStat = {
  questionId: number;
  attempts: number;
  incorrect: number;
  correct: number;
  wrongRate: number;
  question?: QuestionData;
};

type TopicStat = {
  key: string;
  mapel: string;
  bab: string;
  subBab: string;
  attempts: number;
  answered: number;
  correct: number;
  accuracy: number;
  wrongRate: number;
};

type TrendPoint = {
  key: string;
  label: string;
  attempts: number;
  avgScore: number;
};

type AnalyticsInsightsProps = {
  hardestTopics: TopicStat[];
  hardestQuestions: QuestionStat[];
  scoreTrend: TrendPoint[];
  formatCategorySelectionLabel: (value?: string | null) => string;
  onQuestionClick: (question: QuestionStat) => void;
  theme?: 'light' | 'dark';
};

export default function AnalyticsInsights({
  hardestTopics,
  hardestQuestions,
  formatCategorySelectionLabel,
  onQuestionClick,
  theme = 'dark',
}: AnalyticsInsightsProps) {
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<TopicStat | null>(null);
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | 'multiple_choice' | 'short_answer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'wrongRate' | 'attempts'>('wrongRate');

  // Accuracy: higher is better
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy > 70) return 'text-primary';
    if (accuracy > 50) return 'text-highlight-fg';
    return 'text-danger';
  };

  // Wrong rate: higher is worse
  const getWrongRateColor = (wrongRate: number) => {
    if (wrongRate > 70) return 'text-danger';
    if (wrongRate > 25) return 'text-highlight-fg';
    return 'text-primary';
  };

  const getDifficultyBadge = (wrongRate: number) => {
    if (wrongRate > 80) return { label: 'Very hard', color: 'bg-danger/12 text-danger' };
    if (wrongRate > 50) return { label: 'Hard', color: 'bg-warn/15 text-highlight-fg' };
    if (wrongRate > 25) return { label: 'Medium', color: 'well text-fg-muted' };
    return { label: 'Easy', color: 'bg-primary/12 text-primary' };
  };

  const displayedQuestions = hardestQuestions
    .filter(question => question.wrongRate > 0)
    .filter(question => {
      if (!selectedTopicFilter) return true;
      const topics = [
        ...(question.question?.mapels || []),
        ...(question.question?.babs || []),
        ...(question.question?.sub_babs || [])
      ];

      // Check if question contains ANY of the selected topic's values
      const topicValues = [
        selectedTopicFilter.mapel,
        selectedTopicFilter.bab,
        selectedTopicFilter.subBab
      ].filter(v => v && v !== 'Semua MAPEL'); // Exclude "Semua MAPEL" as it's a wildcard

      // Case-insensitive comparison
      const matches = topicValues.some(filterValue => {
        const filterLower = filterValue.toLowerCase();
        return topics.some(topic =>
          topic.toLowerCase() === filterLower ||
          topic.toLowerCase().includes(filterLower) ||
          filterLower.includes(topic.toLowerCase())
        );
      });

      return matches;
    })
    .filter(question => {
      // Question type filter
      if (questionTypeFilter === 'multiple_choice') {
        return question.question?.question_type !== 'short_answer';
      } else if (questionTypeFilter === 'short_answer') {
        return question.question?.question_type === 'short_answer';
      }
      return true;
    })
    .filter(question => {
      // Search filter
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const questionText = question.question?.question_text?.toLowerCase() || '';
      const questionId = question.questionId.toString();
      return questionText.includes(query) || questionId.includes(query);
    })
    .sort((a, b) => {
      // Sorting logic
      if (sortBy === 'wrongRate') {
        return b.wrongRate - a.wrongRate || b.incorrect - a.incorrect || b.attempts - a.attempts;
      } else if (sortBy === 'attempts') {
        return b.attempts - a.attempts || b.wrongRate - a.wrongRate;
      }
      return 0;
    });

  // Show 8 questions by default, with "Show More" button to see all
  const questionsToShow = showAllQuestions ? displayedQuestions : displayedQuestions.slice(0, 8);

  const typeSegment = (active: boolean) =>
    `h-11 md:h-9 rounded-lg px-3.5 text-[13px] font-semibold transition-calm ${active ? 'clay' : 'text-fg-muted hover:text-fg'}`;

  return (
    <div data-theme={theme} className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <section className="glass rounded-3xl p-5" aria-labelledby="hardest-topics-title">
        <div className="mb-4">
          <h3 id="hardest-topics-title" className="text-[17px] font-bold tracking-tight text-fg">
            Hardest topics
          </h3>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            Topics with highest miss rate. Pick one to filter the questions.
          </p>
        </div>

        <div className="space-y-2">
          {hardestTopics.slice(0, 5).map((topic, index) => {
            const missCount = topic.answered - topic.correct;
            const topicValue = topic.subBab || topic.bab || topic.mapel;
            const isSelected = selectedTopicFilter?.key === topic.key;
            return (
              <button
                key={topic.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedTopicFilter(isSelected ? null : topic)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition-calm ${
                  isSelected ? 'bg-primary/12 ring-1 ring-primary/40' : 'well well-hover'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold tabular-nums ${isSelected ? 'bg-primary text-on-primary' : 'clay'}`}>
                    {index + 1}
                  </span>
                  <span className={`truncate text-[14px] font-semibold ${isSelected ? 'text-primary' : 'text-fg'}`}>
                    {formatCategorySelectionLabel(topicValue)}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className={`text-[18px] font-bold leading-tight tabular-nums ${getAccuracyColor(topic.accuracy)}`}>
                    {topic.accuracy}%
                  </span>
                  <span className="text-[11px] font-medium text-fg-muted">
                    accuracy · {missCount} of {topic.answered} wrong
                  </span>
                </div>
              </button>
            );
          })}

          {hardestTopics.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center">
              <p className="text-[14px] font-medium text-fg-muted">No topic data available.</p>
            </div>
          )}
        </div>
      </section>

      <section className="glass rounded-3xl p-5 lg:col-span-2" aria-labelledby="hardest-questions-title">
        <div className="mb-4">
          <h3 id="hardest-questions-title" className="text-[17px] font-bold tracking-tight text-fg">
            Hardest questions
          </h3>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            Highest wrong rate questions. Click to inspect details.
          </p>
        </div>

        <div className="mb-4 space-y-2.5">
          <div className="relative">
            <input
              type="text"
              aria-label="Search questions"
              placeholder="Search by question ID or text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="well h-11 w-full rounded-xl pl-10 pr-4 text-[14px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
            />
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="well flex gap-1 rounded-xl p-1" role="group" aria-label="Question type">
              <button type="button" aria-pressed={questionTypeFilter === 'all'} onClick={() => setQuestionTypeFilter('all')} className={typeSegment(questionTypeFilter === 'all')}>
                All
              </button>
              <button type="button" aria-pressed={questionTypeFilter === 'multiple_choice'} onClick={() => setQuestionTypeFilter('multiple_choice')} className={typeSegment(questionTypeFilter === 'multiple_choice')}>
                PG
              </button>
              <button type="button" aria-pressed={questionTypeFilter === 'short_answer'} onClick={() => setQuestionTypeFilter('short_answer')} className={typeSegment(questionTypeFilter === 'short_answer')}>
                Isian
              </button>
            </div>

            <div className="relative">
              <select
                value={sortBy}
                aria-label="Sort"
                onChange={(e) => setSortBy(e.target.value as 'wrongRate' | 'attempts')}
                className="well well-hover h-11 min-w-[170px] cursor-pointer appearance-none rounded-xl pl-3.5 pr-10 text-[13px] font-medium text-fg transition-calm"
              >
                <option value="wrongRate">Sort by wrong rate</option>
                <option value="attempts">Sort by attempts</option>
              </select>
              <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <span className="text-[13px] font-medium tabular-nums text-fg-muted">
              {displayedQuestions.length} question{displayedQuestions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {questionsToShow.map((question, index) => {
            const topics = [
              ...(question.question?.mapels || []),
              ...(question.question?.babs || []),
              ...(question.question?.sub_babs || [])
            ].filter(Boolean);
            const studentCount = `${question.incorrect} of ${question.attempts} students`;
            const difficulty = getDifficultyBadge(question.wrongRate);

            return (
              <button
                key={question.questionId}
                type="button"
                onClick={() => onQuestionClick(question)}
                className="well well-hover w-full rounded-2xl p-3.5 text-left transition-calm"
              >
                <div className="flex items-start gap-3">
                  <span className="clay flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-fg">
                        Q{question.questionId}
                      </span>
                      <span className="text-[12px] font-medium text-fg-muted">
                        {studentCount}
                      </span>
                      {question.question?.question_type && (
                        <span className="well inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold text-fg-muted">
                          {question.question.question_type === 'short_answer' ? 'Isian' : 'PG'}
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${difficulty.color}`}>
                        {difficulty.label}
                      </span>
                    </div>
                    <div className="mb-2 truncate text-[14px] font-medium text-fg">
                      {question.question ? (
                        <RichContent html={question.question.question_text} />
                      ) : (
                        'Question unavailable'
                      )}
                    </div>
                    {topics.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {topics.slice(0, 2).map((topic, idx) => (
                          <span key={idx} className="inline-flex items-center rounded-md border border-line px-2 py-0.5 text-[11px] font-semibold text-fg-muted">
                            {formatCategorySelectionLabel(topic)}
                          </span>
                        ))}
                        {topics.length > 2 && (
                          <span className="inline-flex items-center rounded-md border border-line px-2 py-0.5 text-[11px] font-semibold tabular-nums text-fg-muted">
                            +{topics.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className={`text-[20px] font-bold leading-tight tabular-nums ${getWrongRateColor(question.wrongRate)}`}>
                      {question.wrongRate}%
                    </span>
                    <span className="text-[11px] font-medium text-fg-muted">
                      wrong
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {displayedQuestions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center">
              <p className="text-[14px] font-medium text-fg-muted">
                {selectedTopicFilter
                  ? 'No questions found for selected topic'
                  : 'No question data available'}
              </p>
            </div>
          )}

          {displayedQuestions.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllQuestions(!showAllQuestions)}
              className="well well-hover mt-2 h-11 w-full rounded-xl px-4 text-[13px] font-medium text-fg transition-calm"
            >
              {showAllQuestions ? 'Show less' : `Show more (${displayedQuestions.length - 8} more)`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
