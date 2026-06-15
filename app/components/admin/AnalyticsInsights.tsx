"use client";

import React, { useState } from 'react';
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
  scoreTrend: _scoreTrend,
  formatCategorySelectionLabel,
  onQuestionClick,
  theme = 'dark',
}: AnalyticsInsightsProps) {
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<TopicStat | null>(null);
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | 'multiple_choice' | 'short_answer'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'wrongRate' | 'attempts'>('wrongRate');

  // Helper function to get color for accuracy percentage (higher is better)
  const getAccuracyColor = (accuracy: number) => {
    if (accuracy > 70) {
      return theme === 'dark' ? 'text-accent-green' : 'text-green-600';
    } else if (accuracy > 50) {
      return theme === 'dark' ? 'text-accent-orange' : 'text-orange-600';
    } else {
      return theme === 'dark' ? 'text-accent-red' : 'text-red-600';
    }
  };

  // Helper function to get color for wrong rate percentage (higher is worse)
  const getWrongRateColor = (wrongRate: number) => {
    if (wrongRate > 70) {
      return theme === 'dark' ? 'text-accent-red' : 'text-red-600';
    } else if (wrongRate > 25) {
      return theme === 'dark' ? 'text-accent-orange' : 'text-orange-600';
    } else {
      return theme === 'dark' ? 'text-accent-green' : 'text-green-600';
    }
  };

  // Helper function to get difficulty badge
  const getDifficultyBadge = (wrongRate: number) => {
    if (wrongRate > 80) {
      return { label: 'Very Hard', color: theme === 'dark' ? 'bg-accent-red/20 text-accent-red' : 'bg-red-100 text-red-700' };
    } else if (wrongRate > 50) {
      return { label: 'Hard', color: theme === 'dark' ? 'bg-accent-orange/20 text-accent-orange' : 'bg-orange-100 text-orange-700' };
    } else if (wrongRate > 25) {
      return { label: 'Medium', color: theme === 'dark' ? 'bg-accent-blue/20 text-accent-blue' : 'bg-blue-100 text-blue-700' };
    } else {
      return { label: 'Easy', color: theme === 'dark' ? 'bg-accent-green/20 text-accent-green' : 'bg-green-100 text-green-700' };
    }
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
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div
        className={`rounded-[28px] border p-6 shadow-ios-md ${
          theme === 'dark'
            ? 'border-dark-border-subtle bg-dark-800'
            : 'border-nike-grey-200 bg-white'
        }`}
      >
        <div className="mb-4">
          <h3
            className={`text-base font-semibold tracking-tight ${
              theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'
            }`}
          >
            Hardest Topics
          </h3>
          <p
            className={`mt-1 text-xs font-medium ${
              theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
            }`}
          >
            Topics with highest miss rate.
          </p>
        </div>

        <div className="space-y-3">
          {hardestTopics.slice(0, 5).map((topic, index) => {
            const missCount = topic.answered - topic.correct;
            const topicValue = topic.subBab || topic.bab || topic.mapel;
            const isSelected = selectedTopicFilter?.key === topic.key;
            return (
              <button
                key={topic.key}
                type="button"
                onClick={() => setSelectedTopicFilter(isSelected ? null : topic)}
                className={`w-full flex items-center justify-between gap-3 rounded-[20px] border p-3.5 transition-spring hover:scale-[1.01] ${
                  isSelected
                    ? theme === 'dark'
                      ? 'border-accent-blue/40 bg-accent-blue/12 shadow-ios-sm'
                      : 'border-blue-600/40 bg-blue-50 shadow-ios-sm'
                    : theme === 'dark'
                    ? 'border-dark-border-subtle bg-white/[0.03] hover:bg-white/[0.05]'
                    : 'border-nike-grey-200 bg-black/[0.02] hover:bg-black/[0.03]'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      isSelected
                        ? theme === 'dark'
                          ? 'bg-accent-blue text-white'
                          : 'bg-blue-600 text-white'
                        : theme === 'dark'
                        ? 'bg-accent-red/15 text-accent-red'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`truncate text-sm font-semibold tracking-tight ${
                      isSelected
                        ? theme === 'dark'
                          ? 'text-accent-blue'
                          : 'text-blue-700'
                        : theme === 'dark'
                        ? 'text-dark-text-primary'
                        : 'text-gray-900'
                    }`}
                  >
                    {formatCategorySelectionLabel(topicValue)}
                  </span>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span
                    className={`text-lg font-semibold tabular-nums ${
                      isSelected
                        ? theme === 'dark'
                          ? 'text-accent-blue'
                          : 'text-blue-700'
                        : getAccuracyColor(topic.accuracy)
                    }`}
                  >
                    {topic.accuracy}%
                  </span>
                  <span
                    className={`text-[10px] font-medium ${
                      isSelected
                        ? theme === 'dark'
                          ? 'text-accent-blue/70'
                          : 'text-blue-600'
                        : theme === 'dark'
                        ? 'text-dark-text-tertiary'
                        : 'text-gray-500'
                    }`}
                  >
                    accuracy
                  </span>
                  <span
                    className={`text-[10px] font-medium ${
                      isSelected
                        ? theme === 'dark'
                          ? 'text-accent-blue/60'
                          : 'text-blue-500'
                        : theme === 'dark'
                        ? 'text-dark-text-tertiary'
                        : 'text-gray-400'
                    }`}
                  >
                    {missCount} of {topic.answered} wrong
                  </span>
                </div>
              </button>
            );
          })}

          {hardestTopics.length === 0 && (
            <div
              className={`rounded-[20px] border-2 border-dashed p-6 text-center ${
                theme === 'dark'
                  ? 'border-dark-border-medium bg-white/[0.02] text-dark-text-tertiary'
                  : 'border-gray-300 bg-black/[0.02] text-gray-400'
              }`}
            >
              <p className="text-sm font-medium">No topic data available.</p>
            </div>
          )}
        </div>
      </div>

      <div
        className={`rounded-[28px] border p-6 shadow-ios-md lg:col-span-2 ${
          theme === 'dark'
            ? 'border-dark-border-subtle bg-dark-800'
            : 'border-nike-grey-200 bg-white'
        }`}
      >
        <div className="mb-4">
          <h3
            className={`text-base font-semibold tracking-tight ${
              theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'
            }`}
          >
            Hardest Questions
          </h3>
          <p
            className={`mt-1 text-xs font-medium ${
              theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
            }`}
          >
            Highest wrong rate questions. Click to inspect details.
          </p>
        </div>

        <div className="mb-4 space-y-3">
          <input
            type="text"
            placeholder="Search by question ID or text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`h-11 w-full rounded-2xl border px-4 text-sm font-medium transition-spring-fast focus:outline-none focus:ring-2 ${
              theme === 'dark'
                ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary placeholder:text-dark-text-tertiary focus:border-accent-blue focus:ring-accent-blue/10'
                : 'border-nike-grey-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900/10'
            }`}
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <div className={`inline-flex h-10 rounded-full border p-0.5 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-800' : 'border-nike-grey-200 bg-white'}`}>
              <button
                type="button"
                onClick={() => setQuestionTypeFilter('all')}
                className={`rounded-full px-3.5 text-[11px] font-semibold transition-spring-fast ${
                  questionTypeFilter === 'all'
                    ? theme === 'dark'
                      ? 'bg-accent-blue text-white'
                      : 'bg-dark-800 text-white'
                    : theme === 'dark'
                    ? 'text-dark-text-primary hover:bg-dark-700'
                    : 'text-nike-black hover:bg-nike-grey-100'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setQuestionTypeFilter('multiple_choice')}
                className={`rounded-full px-3.5 text-[11px] font-semibold transition-spring-fast ${
                  questionTypeFilter === 'multiple_choice'
                    ? theme === 'dark'
                      ? 'bg-accent-blue text-white'
                      : 'bg-dark-800 text-white'
                    : theme === 'dark'
                    ? 'text-dark-text-primary hover:bg-dark-700'
                    : 'text-nike-black hover:bg-nike-grey-100'
                }`}
              >
                PG
              </button>
              <button
                type="button"
                onClick={() => setQuestionTypeFilter('short_answer')}
                className={`rounded-full px-3.5 text-[11px] font-semibold transition-spring-fast ${
                  questionTypeFilter === 'short_answer'
                    ? theme === 'dark'
                      ? 'bg-accent-blue text-white'
                      : 'bg-dark-800 text-white'
                    : theme === 'dark'
                    ? 'text-dark-text-primary hover:bg-dark-700'
                    : 'text-nike-black hover:bg-nike-grey-100'
                }`}
              >
                Isian
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'wrongRate' | 'attempts')}
              className={`h-10 min-w-[152px] cursor-pointer rounded-full border px-3.5 text-[11px] font-semibold transition-spring-fast focus:outline-none focus:ring-2 ${
                theme === 'dark'
                  ? 'border-dark-border-medium bg-dark-800 text-dark-text-primary focus:border-accent-blue focus:ring-accent-blue/10'
                  : 'border-nike-grey-200 bg-white text-nike-black focus:border-dark-800 focus:ring-dark-800/10'
              }`}
            >
              <option value="wrongRate">Sort by wrong rate</option>
              <option value="attempts">Sort by attempts</option>
            </select>

            <span
              className={`text-xs font-medium ${
                theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
              }`}
            >
              {displayedQuestions.length} question{displayedQuestions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {questionsToShow.map((question, index) => {
            const topics = [
              ...(question.question?.mapels || []),
              ...(question.question?.babs || []),
              ...(question.question?.sub_babs || [])
            ].filter(Boolean);
            const studentCount = `${question.incorrect} of ${question.attempts} students`;

            return (
              <button
                key={question.questionId}
                type="button"
                onClick={() => onQuestionClick(question)}
                className={`w-full rounded-[20px] border p-3.5 text-left transition-spring hover:scale-[1.01] ${
                  theme === 'dark'
                    ? 'border-dark-border-subtle bg-white/[0.03] hover:bg-white/[0.05]'
                    : 'border-nike-grey-200 bg-black/[0.02] hover:bg-black/[0.03]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      theme === 'dark'
                        ? 'bg-accent-red/15 text-accent-red'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold ${
                          theme === 'dark'
                            ? 'text-dark-text-secondary'
                            : 'text-gray-600'
                        }`}
                      >
                        Q{question.questionId}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          theme === 'dark'
                            ? 'text-dark-text-tertiary'
                            : 'text-gray-500'
                        }`}
                      >
                        {studentCount}
                      </span>
                      {question.question?.question_type && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                            theme === 'dark'
                              ? 'bg-dark-700 text-dark-text-secondary'
                              : 'bg-white text-gray-600'
                          }`}
                        >
                          {question.question.question_type === 'short_answer' ? 'Isian' : 'PG'}
                        </span>
                      )}
                      {/* Difficulty Badge */}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          getDifficultyBadge(question.wrongRate).color
                        }`}
                      >
                        {getDifficultyBadge(question.wrongRate).label}
                      </span>
                    </div>
                    <div
                      className={`truncate text-sm font-medium mb-2 ${
                        theme === 'dark'
                          ? 'text-dark-text-primary'
                          : 'text-gray-900'
                      }`}
                    >
                      {question.question ? (
                        <RichContent html={question.question.question_text} />
                      ) : (
                        'Question unavailable'
                      )}
                    </div>
                    {topics.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {topics.slice(0, 2).map((topic, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              theme === 'dark'
                                ? 'bg-dark-700 text-dark-text-secondary'
                                : 'bg-white text-gray-600'
                            }`}
                          >
                            {formatCategorySelectionLabel(topic)}
                          </span>
                        ))}
                        {topics.length > 2 && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              theme === 'dark'
                                ? 'bg-dark-700 text-dark-text-secondary'
                                : 'bg-white text-gray-600'
                            }`}
                          >
                            +{topics.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span
                      className={`text-xl font-semibold tabular-nums ${getWrongRateColor(question.wrongRate)}`}
                    >
                      {question.wrongRate}%
                    </span>
                    <span
                      className={`text-[10px] font-medium ${
                        theme === 'dark'
                          ? 'text-dark-text-tertiary'
                          : 'text-gray-500'
                      }`}
                    >
                      wrong
                    </span>
                  </div>
                </div>
              </button>
            );
          })}

          {displayedQuestions.length === 0 && (
            <div
              className={`rounded-[16px] border-2 border-dashed p-6 text-center ${
                theme === 'dark'
                  ? 'border-dark-600 text-dark-text-tertiary'
                  : 'border-gray-300 text-gray-400'
              }`}
            >
              <p className="text-sm font-medium">
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
              className={`w-full mt-3 h-10 rounded-full border px-4 text-xs font-bold uppercase tracking-[0.12em] transition-spring-fast hover:scale-105 ${
                theme === 'dark'
                  ? 'border-dark-600 bg-dark-750 text-dark-text-primary hover:border-accent-blue hover:text-accent-blue'
                  : 'border-nike-grey-300 bg-white text-gray-900 hover:border-gray-900'
              }`}
            >
              {showAllQuestions ? `Show Less` : `Show More (${displayedQuestions.length - 8} more)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
