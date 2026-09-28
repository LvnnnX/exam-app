"use client";

import React, { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import RichContent from '@/app/components/RichContent';
import AnalyticsHeroStats from '@/app/components/admin/AnalyticsHeroStats';
import AnalyticsInsights from '@/app/components/admin/AnalyticsInsights';
import StudentWeaknessPanel from '@/app/components/admin/StudentWeaknessPanel';
import RemedialQuizBuilder from '@/app/components/admin/RemedialQuizBuilder';
import RemedialQuizSuccessModal from '@/app/components/admin/RemedialQuizSuccessModal';

type AnalyticsSource = 'exam' | 'quiz';
type AnalyticsDateRange = { start: string; end: string };
type AnalyticsSummary = { attempts: number; avgScore: number; passRate: number; avgDurationSeconds: number | null };
type TopicStat = { key: string; mapel: string; bab: string; subBab: string; attempts: number; answered: number; correct: number; accuracy: number; wrongRate: number };
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
type QuestionStat = { questionId: number; attempts: number; incorrect: number; correct: number; wrongRate: number; question?: QuestionData };
type TrendPoint = { key: string; label: string; attempts: number; avgScore: number };
type TopicTrendPoint = { key: string; label: string; topic: string; attempts: number; correct: number; wrong: number; accuracy: number };
type StudentWeakness = {
  key: string;
  name: string;
  attempts: number;
  avgScore: number;
  totalQuestionsAnswered: number;
  totalQuestionsWrong: number;
  weakestTopics: { topic: string; attempts: number; correct: number; wrong: number; accuracy: number }[];
};
type AnalyticsParticipant = { key: string; name: string; attempts: number; avgScore: number; totalQuestionsAnswered: number; totalQuestionsWrong: number };
type AnalyticsQuizSession = { key: string; quizCode: string; label: string; mapel: string | null; bab: string | null; subBab: string | null; createdAt: string | null; finishedAt: string | null; attempts: number };
type RemedialQuestionCandidate = QuestionStat & { participantKeys: string[]; participantNames: string[] };
type AnalyticsData = {
  summary: AnalyticsSummary;
  hardestTopics: TopicStat[];
  hardestQuestions: QuestionStat[];
  scoreTrend: TrendPoint[];
  topicTrend: TopicTrendPoint[];
  studentWeaknesses: StudentWeakness[];
  participants: AnalyticsParticipant[];
  quizSessions: AnalyticsQuizSession[];
  remedialCandidates: RemedialQuestionCandidate[];
};

type AnalyticsTabPanelProps = {
  analyticsData: AnalyticsData;
  analyticsLoading: boolean;
  analyticsError: string | null;
  analyticsSource: AnalyticsSource;
  dateRange: AnalyticsDateRange;
  activeParticipantKey: string;
  activeQuizSessionKeys: string[];
  formatCategorySelectionLabel: (value?: string | null) => string;
  onRefresh: () => void;
  onSourceChange: (source: AnalyticsSource) => void;
  onDateRangeChange: (range: AnalyticsDateRange) => void;
  onParticipantChange: (participantKey: string) => void;
  onQuizSessionsChange: (sessionKeys: string[]) => void;
  onNavigateToQuiz: (code: string) => void;
  onCreateRemedialQuiz: (questionIds: number[]) => Promise<{ quiz_code: string; question_count: number }>;
  theme?: 'light' | 'dark';
};

function formatDuration(seconds: number | null) {
  if (seconds == null) return '-';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function rangeFromDays(days: number): AnalyticsDateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h ago` : `${days}d ago`;
  } else if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m ago` : `${hours}h ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return 'Just now';
  }
}

function TopicBadge({ label, value }: { label: string; value: string; theme?: 'light' | 'dark' }) {
  if (!value || value === '-') return null;
  return (
    <span className="well inline-flex max-w-[150px] items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium text-fg-muted">
      <span className="font-bold text-fg">{label}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}

function QuestionOption({ label, html, active }: { label: string; html: string; active: boolean; theme?: 'light' | 'dark' }) {
  if (!html) return null;
  return (
    <div className={`rounded-2xl p-3 ${active ? 'bg-primary/10 ring-1 ring-primary/30' : 'well'}`}>
      <div className={`mb-1 flex items-center justify-between text-[12px] font-semibold ${active ? 'text-primary' : 'text-fg-muted'}`}>
        Option {label}
        {active && <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px]">Correct</span>}
      </div>
      <div className="text-[14px] font-medium text-fg">
        <RichContent html={html} />
      </div>
    </div>
  );
}

function ModalCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="well well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-calm"
    >
      <X size={16} />
    </button>
  );
}

const chipButton = (active: boolean) =>
  `h-11 md:h-10 rounded-lg px-3 text-[13px] font-semibold transition-calm ${active ? 'clay' : 'text-fg-muted hover:text-fg'}`;

const pickerTile = (active: boolean) =>
  `rounded-2xl px-3.5 py-3 text-left transition-calm ${active ? 'bg-primary text-on-primary' : 'well well-hover text-fg'}`;

export default function AnalyticsTabPanel({
  analyticsData,
  analyticsLoading,
  analyticsError,
  analyticsSource,
  dateRange,
  activeParticipantKey,
  activeQuizSessionKeys,
  formatCategorySelectionLabel,
  theme = 'dark',
  onRefresh,
  onSourceChange,
  onDateRangeChange,
  onParticipantChange,
  onQuizSessionsChange,
  onNavigateToQuiz,
  onCreateRemedialQuiz,
}: AnalyticsTabPanelProps) {
  const { summary, hardestTopics, hardestQuestions, scoreTrend, topicTrend, studentWeaknesses, participants, quizSessions, remedialCandidates } = analyticsData;

  const isDateRangeActive = (days: number | 'all') => {
    if (days === 'all') {
      return dateRange.start === '' && dateRange.end === '';
    }
    const targetRange = rangeFromDays(days);
    return dateRange.start === targetRange.start && dateRange.end === targetRange.end;
  };
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionStat | null>(null);
  const [selectedRemedialIds, setSelectedRemedialIds] = useState<number[]>([]);
  const [creatingRemedial, setCreatingRemedial] = useState(false);
  const [remedialQuizBuilderOpen, setRemedialQuizBuilderOpen] = useState(false);
  const [remedialQuizStudentKeys, setRemedialQuizStudentKeys] = useState<string[]>([]);
  const [remedialQuizSuccess, setRemedialQuizSuccess] = useState<{ quizCode: string; questionCount: number } | null>(null);
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [draftQuizSessionKeys, setDraftQuizSessionKeys] = useState<string[]>([]);
  const candidateIds = remedialCandidates.map((candidate) => candidate.questionId);
  const selectedCandidateIds = selectedRemedialIds.filter((id) => candidateIds.includes(id));
  const activeParticipant = activeParticipantKey === 'all' ? null : participants.find((participant) => participant.key === activeParticipantKey);
  const activeQuizSessions = quizSessions.filter((session) => activeQuizSessionKeys.includes(session.key));
  const sessionCardTitle = analyticsSource !== 'quiz'
    ? 'Quiz only'
    : activeQuizSessionKeys.length === 0
      ? 'All quiz sessions'
      : activeQuizSessionKeys.length === 1
        ? (activeQuizSessions[0]?.label || '1 session selected')
        : `${activeQuizSessionKeys.length} sessions selected`;
  const toggleDraftSession = (sessionKey: string) => setDraftQuizSessionKeys((current) => current.includes(sessionKey) ? current.filter((key) => key !== sessionKey) : [...current, sessionKey]);

  const selectTop = (count: number) => setSelectedRemedialIds(candidateIds.slice(0, count));
  const toggleRemedialId = (id: number, checked: boolean) => setSelectedRemedialIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));

  const handleOpenRemedialQuizBuilder = (studentKeys: string[]) => {
    setRemedialQuizStudentKeys(studentKeys);
    setRemedialQuizBuilderOpen(true);
  };

  const handleCreateRemedialQuizFromBuilder = async (config: any) => {
    try {
      // Filter questions for selected students (UNION logic - include if at least 1 student got it wrong)
      const availableQuestions = remedialCandidates.filter(q =>
        q.participantKeys.some((key: string) => config.studentKeys.includes(key))
      );

      // Select questions based on mode
      let selectedQuestions: RemedialQuestionCandidate[] = [];

      if (config.mode === 'wrong_only') {
        // Use filtered questions directly
        selectedQuestions = availableQuestions;
      } else if (config.mode === 'wrong_similar') {
        // For now, use same as wrong_only
        // TODO: Enhance to include similar questions from same topics
        selectedQuestions = availableQuestions;
      } else if (config.mode === 'topic_based') {
        // For now, use same as wrong_only
        // TODO: Enhance to include all questions from weak topics
        selectedQuestions = availableQuestions;
      }

      // Sort by wrong rate (highest first) and limit to questionCount
      const sortedQuestions = selectedQuestions
        .sort((a, b) => b.wrongRate - a.wrongRate)
        .slice(0, config.questionCount);

      // Extract question IDs
      const questionIds = sortedQuestions.map(q => q.questionId);

      if (questionIds.length === 0) {
        window.alert('No questions available for the selected students.');
        return;
      }

      // Close the builder modal
      setRemedialQuizBuilderOpen(false);

      // Create the quiz
      const result = await onCreateRemedialQuiz(questionIds);

      // Show success modal
      setRemedialQuizSuccess({
        quizCode: result.quiz_code,
        questionCount: result.question_count,
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to create remedial quiz.');
    }
  };

  const createRemedialQuiz = async () => {
    if (selectedCandidateIds.length === 0) return;
    setCreatingRemedial(true);
    try {
      await onCreateRemedialQuiz(selectedCandidateIds);
      setSelectedRemedialIds([]);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to create remedial quiz.');
    } finally {
      setCreatingRemedial(false);
    }
  };

  React.useEffect(() => {
    if (sessionPickerOpen || participantPickerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sessionPickerOpen, participantPickerOpen]);

  React.useEffect(() => {
    if (!sessionPickerOpen && !participantPickerOpen && !selectedQuestion) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSessionPickerOpen(false);
      setParticipantPickerOpen(false);
      setSelectedQuestion(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionPickerOpen, participantPickerOpen, selectedQuestion]);

  const scopeCard = 'glass-sheet rounded-3xl px-4 py-3.5 text-left transition-calm hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div data-theme={theme} className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="glass mb-3 rounded-3xl px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[200px] flex-1">
            <h2 className="text-[22px] font-bold tracking-tight text-fg">Analytics</h2>
            <p className="mt-0.5 text-[13px] text-fg-muted">Analyze performance and identify areas for improvement.</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={analyticsLoading}
            className="well well-hover flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-medium text-fg transition-calm disabled:opacity-50"
          >
            {analyticsLoading ? <span className="spinner-calm h-3.5 w-3.5" aria-hidden="true" /> : <RefreshCw size={15} className="text-fg-subtle" />}
            {analyticsLoading ? 'Loading' : 'Refresh'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="well flex gap-1 rounded-xl p-1" role="group" aria-label="Source">
            <button
              type="button"
              aria-pressed={analyticsSource === 'exam'}
              onClick={() => onSourceChange('exam')}
              className={chipButton(analyticsSource === 'exam')}
            >
              Exam
            </button>
            <button
              type="button"
              aria-pressed={analyticsSource === 'quiz'}
              onClick={() => onSourceChange('quiz')}
              className={chipButton(analyticsSource === 'quiz')}
            >
              Quiz
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-fg-muted">Date range</span>
            <div className="well flex flex-wrap gap-1 rounded-xl p-1" role="group" aria-label="Date range">
              {[1, 3, 7, 14, 30].map((days) => {
                const isActive = isDateRangeActive(days);
                return (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onDateRangeChange(rangeFromDays(days))}
                    className={chipButton(isActive)}
                  >
                    {days}D
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={isDateRangeActive('all')}
                onClick={() => onDateRangeChange({ start: '', end: '' })}
                className={chipButton(isDateRangeActive('all'))}
              >
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {analyticsError && <div className="mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-[13px] font-semibold text-danger" role="alert">{analyticsError}</div>}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button type="button" onClick={() => { if (analyticsSource !== 'quiz') return; setDraftQuizSessionKeys(activeQuizSessionKeys); setSessionPickerOpen(true); }} disabled={analyticsSource !== 'quiz'} className={scopeCard}>
            <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-medium text-fg-muted">Sessions</span><span className="text-[13px] font-semibold text-primary">Change</span></div>
            <p className="mt-1 truncate text-[16px] font-bold text-fg">{sessionCardTitle}</p>
            <p className="mt-0.5 text-[12px] text-fg-muted">{analyticsSource === 'quiz' ? `${quizSessions.length} available in date range` : 'Active only for Quiz source'}</p>
          </button>
          <button type="button" onClick={() => setParticipantPickerOpen(true)} className={scopeCard}>
            <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-medium text-fg-muted">Participant</span><span className="text-[13px] font-semibold text-primary">Change</span></div>
            <p className="mt-1 truncate text-[16px] font-bold text-fg">{activeParticipant?.name || 'All participants'}</p>
            <p className="mt-0.5 text-[12px] text-fg-muted">{activeParticipant ? `${activeParticipant.attempts} attempts in scope` : `${participants.length} participants included`}</p>
          </button>
        </div>

        <div className="mb-4">
          <AnalyticsHeroStats summary={summary} theme={theme} />
        </div>

        {analyticsLoading && summary.attempts === 0 ? (
          <p className="flex items-center justify-center gap-2 py-8 text-center text-[14px] font-medium text-fg-muted" role="status">
            <span className="spinner-calm h-4 w-4" aria-hidden="true" />
            Loading analytics...
          </p>
        ) : summary.attempts === 0 ? (
          <div className="glass rounded-3xl p-8 text-center">
            <p className="text-[15px] font-semibold text-fg">No analytics data for current filters.</p>
            <p className="mt-1 text-[13px] text-fg-muted">Widen the date range or switch source to see results.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <AnalyticsInsights
              hardestTopics={hardestTopics}
              hardestQuestions={hardestQuestions}
              scoreTrend={scoreTrend}
              formatCategorySelectionLabel={formatCategorySelectionLabel}
              onQuestionClick={setSelectedQuestion}
              theme={theme}
            />

            <StudentWeaknessPanel
              students={studentWeaknesses}
              participants={participants}
              formatCategoryLabel={formatCategorySelectionLabel}
              onCreateRemedialQuiz={handleOpenRemedialQuizBuilder}
              theme={theme}
            />
          </div>
        )}
      </div>

      {/* Remedial Quiz Builder Modal */}
      {remedialQuizBuilderOpen && (
        <RemedialQuizBuilder
          selectedStudentKeys={remedialQuizStudentKeys}
          studentNames={remedialQuizStudentKeys.map(key => {
            const student = studentWeaknesses.find(s => s.key === key);
            return student?.name || 'Unknown';
          })}
          remedialCandidates={remedialCandidates}
          onClose={() => setRemedialQuizBuilderOpen(false)}
          onCreateQuiz={handleCreateRemedialQuizFromBuilder}
          theme={theme}
        />
      )}

      {/* Remedial Quiz Success Modal */}
      {remedialQuizSuccess && (
        <RemedialQuizSuccessModal
          quizCode={remedialQuizSuccess.quizCode}
          questionCount={remedialQuizSuccess.questionCount}
          onClose={() => setRemedialQuizSuccess(null)}
          onGoToQuiz={() => {
            onNavigateToQuiz(remedialQuizSuccess.quizCode);
            setRemedialQuizSuccess(null);
          }}
          theme={theme}
        />
      )}

      {sessionPickerOpen && (
        <div className="glass-scrim fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="session-picker-title" onClick={() => setSessionPickerOpen(false)}>
          <div className="glass-sheet animate-in w-full max-w-2xl rounded-4xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-fg-muted">Quiz session scope</p>
                <h3 id="session-picker-title" className="mt-0.5 text-[20px] font-bold tracking-tight text-fg">Choose sessions</h3>
                <p className="mt-1 text-[13px] text-fg-muted">Pilih satu/lebih quiz untuk menghitung soal tersulit hanya dari sesi itu.</p>
              </div>
              <ModalCloseButton onClick={() => setSessionPickerOpen(false)} />
            </div>
            <div className="well mb-4 inline-flex flex-wrap gap-1 rounded-xl p-1">
              <button type="button" onClick={() => setDraftQuizSessionKeys([])} className={chipButton(draftQuizSessionKeys.length === 0)}>All</button>
              {[1, 2, 5].map((count) => <button key={count} type="button" onClick={() => setDraftQuizSessionKeys(quizSessions.slice(0, count).map((session) => session.key))} className={chipButton(false)}>Latest {count}</button>)}
            </div>
            <div className="result-details-scroll-light grid max-h-[56vh] gap-2 overflow-y-auto sm:grid-cols-2">
              {quizSessions.map((session) => {
                const active = draftQuizSessionKeys.includes(session.key);
                const topics = [session.mapel, session.bab, session.subBab].filter(Boolean);
                const timeAgo = formatTimeAgo(session.createdAt || session.finishedAt);
                return (
                  <button key={session.key} type="button" aria-pressed={active} onClick={() => toggleDraftSession(session.key)} className={pickerTile(active)}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[14px] font-bold">{session.label}</p>
                      <span className={`text-[12px] font-semibold ${active ? 'text-on-primary' : 'text-fg-muted'}`}>{active ? 'Selected' : 'Select'}</span>
                    </div>
                    <p className={`mt-1 text-[12px] ${active ? 'text-on-primary/80' : 'text-fg-muted'}`}>
                      {timeAgo || 'No date available'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`text-[12px] font-medium ${active ? 'text-on-primary/80' : 'text-fg-muted'}`}>{session.attempts} attempts</span>
                      {topics.length > 0 && (
                        <>
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-on-primary/20 text-on-primary' : 'well text-fg-muted'}`}>
                            {formatCategorySelectionLabel(topics[0])}
                          </span>
                          {topics.length > 1 && (
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${active ? 'bg-on-primary/20 text-on-primary' : 'well text-fg-muted'}`}>
                              +{topics.length - 1}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
              {quizSessions.length === 0 && <p className="well rounded-2xl p-4 text-[13px] font-medium text-fg-muted sm:col-span-2">No quiz sessions in current date/filter scope.</p>}
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
              <button type="button" onClick={() => setSessionPickerOpen(false)} className="well well-hover h-11 rounded-xl px-5 text-[14px] font-medium text-fg transition-calm">Cancel</button>
              <button type="button" onClick={() => { setSelectedRemedialIds([]); onQuizSessionsChange(draftQuizSessionKeys); setSessionPickerOpen(false); }} className="clay-primary h-11 rounded-xl px-6 text-[14px] font-semibold">Apply</button>
            </div>
          </div>
        </div>
      )}

      {participantPickerOpen && (
        <div className="glass-scrim fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="participant-picker-title" onClick={() => setParticipantPickerOpen(false)}>
          <div className="glass-sheet animate-in w-full max-w-xl rounded-4xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-fg-muted">Participant scope</p>
                <h3 id="participant-picker-title" className="mt-0.5 text-[20px] font-bold tracking-tight text-fg">Choose participant</h3>
                <p className="mt-1 text-[13px] text-fg-muted">Analytics dan remedial akan dihitung ulang untuk pilihan ini.</p>
              </div>
              <ModalCloseButton onClick={() => setParticipantPickerOpen(false)} />
            </div>
            <div className="result-details-scroll-light grid max-h-[60vh] gap-2 overflow-y-auto sm:grid-cols-2">
              <button type="button" aria-pressed={activeParticipantKey === 'all'} onClick={() => { setSelectedRemedialIds([]); onParticipantChange('all'); setParticipantPickerOpen(false); }} className={pickerTile(activeParticipantKey === 'all')}>
                <p className="truncate text-[14px] font-bold">All participants</p>
                <p className={`mt-1 text-[12px] ${activeParticipantKey === 'all' ? 'text-on-primary/80' : 'text-fg-muted'}`}>{participants.length} participants included</p>
              </button>
              {participants.map((participant) => {
                const active = activeParticipantKey === participant.key;
                return (
                  <button key={participant.key} type="button" aria-pressed={active} onClick={() => { setSelectedRemedialIds([]); onParticipantChange(participant.key); setParticipantPickerOpen(false); }} className={pickerTile(active)}>
                    <p className="truncate text-[14px] font-bold">{participant.name}</p>
                    <p className={`mt-1 text-[12px] ${active ? 'text-on-primary/80' : 'text-fg-muted'}`}>{participant.attempts} attempts</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedQuestion && (
        <div className="glass-scrim fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="question-detail-title" onClick={() => setSelectedQuestion(null)}>
          <div className="glass-sheet animate-in max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-4xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-fg-muted">
                  Question #{selectedQuestion.questionId}
                </p>
                <h3 id="question-detail-title" className="mt-0.5 text-[20px] font-bold tracking-tight text-fg">
                  Question detail
                </h3>
              </div>
              <ModalCloseButton onClick={() => setSelectedQuestion(null)} />
            </div>
            <div className="mb-4 grid grid-cols-3 gap-2.5">
              <div className="clay rounded-2xl px-3 py-2.5">
                <div className="text-[24px] font-bold tabular-nums text-danger">
                  {selectedQuestion.wrongRate}%
                </div>
                <div className="text-[12px] font-medium text-fg-muted">
                  Wrong rate
                </div>
              </div>
              <div className="clay rounded-2xl px-3 py-2.5">
                <div className="text-[24px] font-bold tabular-nums text-fg">
                  {selectedQuestion.incorrect}/{selectedQuestion.attempts}
                </div>
                <div className="text-[12px] font-medium text-fg-muted">
                  Incorrect
                </div>
              </div>
              <div className="clay rounded-2xl px-3 py-2.5">
                <div className="text-[24px] font-bold tabular-nums text-primary">
                  {selectedQuestion.correct}
                </div>
                <div className="text-[12px] font-medium text-fg-muted">
                  Correct
                </div>
              </div>
            </div>
            {selectedQuestion.question ? (
              <div className="space-y-2">
                <div className="well rounded-2xl p-4">
                  <div className="mb-2 flex flex-wrap gap-1">
                    {selectedQuestion.question.mapels.map((value) => <TopicBadge key={`m-${value}`} label="M" value={formatCategorySelectionLabel(value)} theme={theme} />)}
                    {selectedQuestion.question.babs.map((value) => <TopicBadge key={`b-${value}`} label="B" value={formatCategorySelectionLabel(value)} theme={theme} />)}
                    {selectedQuestion.question.sub_babs.map((value) => <TopicBadge key={`s-${value}`} label="S" value={formatCategorySelectionLabel(value)} theme={theme} />)}
                  </div>
                  <div className="text-[15px] font-medium text-fg">
                    <RichContent html={selectedQuestion.question.question_text} />
                  </div>
                </div>
                {selectedQuestion.question.question_type === 'short_answer' ? (
                  <div className="rounded-2xl bg-primary/10 p-3">
                    <div className="mb-1 text-[12px] font-semibold text-primary">
                      Correct answer
                    </div>
                    <div className="text-[14px] font-medium text-fg">
                      {selectedQuestion.question.short_answer || '-'}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    <QuestionOption label="A" html={selectedQuestion.question.option_a} active={selectedQuestion.question.correct_answer === 'A'} theme={theme} />
                    <QuestionOption label="B" html={selectedQuestion.question.option_b} active={selectedQuestion.question.correct_answer === 'B'} theme={theme} />
                    <QuestionOption label="C" html={selectedQuestion.question.option_c} active={selectedQuestion.question.correct_answer === 'C'} theme={theme} />
                    <QuestionOption label="D" html={selectedQuestion.question.option_d} active={selectedQuestion.question.correct_answer === 'D'} theme={theme} />
                    <QuestionOption label="E" html={selectedQuestion.question.option_e} active={selectedQuestion.question.correct_answer === 'E'} theme={theme} />
                  </div>
                )}
              </div>
            ) : <div className="well rounded-2xl p-4 text-[14px] font-medium text-fg-muted">Question data not found. It may have been deleted.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
