"use client";

import React, { useState } from 'react';
import RichContent from '@/app/components/RichContent';
import AnalyticsHeroStats from '@/app/components/admin/AnalyticsHeroStats';
import AnalyticsInsights from '@/app/components/admin/AnalyticsInsights';
import StudentWeaknessPanel from '@/app/components/admin/StudentWeaknessPanel';
import RemedialQuizBuilder from '@/app/components/admin/RemedialQuizBuilder';
import RemedialQuizSuccessModal from '@/app/components/admin/RemedialQuizSuccessModal';
import { buildRemedialQuestionPool } from '@/app/lib/remedialQuizSelection';

type AnalyticsSource = 'exam' | 'quiz' | 'scheduled';
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
  is_hidden?: boolean;
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
  activeParticipantKeys: string[];
  activeQuizSessionKeys: string[];
  formatCategorySelectionLabel: (value?: string | null) => string;
  onRefresh: () => void;
  onSourceChange: (source: AnalyticsSource) => void;
  onDateRangeChange: (range: AnalyticsDateRange) => void;
  onParticipantsChange: (participantKeys: string[]) => void;
  onQuizSessionsChange: (sessionKeys: string[]) => void;
  onNavigateToQuiz: (code: string) => void;
  onCreateRemedialQuiz: (questionIds: number[], options: { quizMode: 'strict' | 'standard'; duration: number }) => Promise<{ quiz_code: string; question_count: number }>;
  theme?: 'light' | 'dark';
};


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

function TopicBadge({ label, value, theme = 'dark' }: { label: string; value: string; theme?: 'light' | 'dark' }) {
  if (!value || value === '-') return null;
  return (
    <span className={`inline-flex max-w-[130px] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
      theme === 'dark'
        ? 'border-dark-600 bg-dark-750 text-dark-text-tertiary'
        : 'border-nike-grey-200 bg-white text-dark-text-muted'
    }`}>
      <span className={theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}>{label}</span>
      <span className="truncate">{value}</span>
    </span>
  );
}

function QuestionOption({ label, html, active, theme = 'dark' }: { label: string; html: string; active: boolean; theme?: 'light' | 'dark' }) {
  if (!html) return null;
  return (
    <div className={`rounded-[14px] border p-3 ${
      active
        ? theme === 'dark'
          ? 'border-accent-green/30 bg-accent-green/10'
          : 'border-status-green bg-mint-soft'
        : theme === 'dark'
        ? 'border-dark-600 bg-dark-750'
        : 'border-nike-grey-200 bg-nike-grey-100'
    }`}>
      <div className={`mb-1 text-[10px] font-black uppercase tracking-[0.16em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-dark-text-muted'}`}>
        Option {label}
      </div>
      <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>
        <RichContent html={html} />
      </div>
    </div>
  );
}

export default function AnalyticsTabPanel({
  analyticsData,
  analyticsLoading,
  analyticsError,
  analyticsSource,
  dateRange,
  activeParticipantKeys,
  activeQuizSessionKeys,
  formatCategorySelectionLabel,
  theme = 'dark',
  onRefresh,
  onSourceChange,
  onDateRangeChange,
  onParticipantsChange,
  onQuizSessionsChange,
  onNavigateToQuiz,
  onCreateRemedialQuiz,
}: AnalyticsTabPanelProps) {
  const { summary, hardestTopics, hardestQuestions, scoreTrend, topicTrend: _topicTrend, studentWeaknesses, participants, quizSessions, remedialCandidates } = analyticsData;

  const isDateRangeActive = (days: number | 'all') => {
    if (days === 'all') {
      return dateRange.start === '' && dateRange.end === '';
    }
    const targetRange = rangeFromDays(days);
    return dateRange.start === targetRange.start && dateRange.end === targetRange.end;
  };
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionStat | null>(null);
  const [selectedRemedialIds, setSelectedRemedialIds] = useState<number[]>([]);
  const [_creatingRemedial, setCreatingRemedial] = useState(false);
  const [remedialQuizBuilderOpen, setRemedialQuizBuilderOpen] = useState(false);
  const [remedialQuizStudentKeys, setRemedialQuizStudentKeys] = useState<string[]>([]);
  const [remedialQuizSuccess, setRemedialQuizSuccess] = useState<{ quizCode: string; questionCount: number } | null>(null);
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);
  const [draftQuizSessionKeys, setDraftQuizSessionKeys] = useState<string[]>([]);
  const candidateIds = remedialCandidates.map((candidate) => candidate.questionId);
  const selectedCandidateIds = selectedRemedialIds.filter((id) => candidateIds.includes(id));
  const activeParticipants = participants.filter((participant) => activeParticipantKeys.includes(participant.key));
  const participantCardTitle = activeParticipantKeys.length === 0
    ? 'All participants'
    : activeParticipantKeys.length === 1
      ? (activeParticipants[0]?.name || '1 participant selected')
      : `${activeParticipantKeys.length} participants selected`;
  const participantCardMeta = activeParticipantKeys.length === 0
    ? `${participants.length} participants included`
    : `${activeParticipants.reduce((sum, participant) => sum + participant.attempts, 0)} attempts in scope`;
  const activeQuizSessions = quizSessions.filter((session) => activeQuizSessionKeys.includes(session.key));
  const sessionCardTitle = analyticsSource !== 'quiz'
    ? 'Quiz only'
    : activeQuizSessionKeys.length === 0
      ? 'All quiz sessions'
      : activeQuizSessionKeys.length === 1
        ? (activeQuizSessions[0]?.label || '1 session selected')
        : `${activeQuizSessionKeys.length} sessions selected`;
  const [draftParticipantKeys, setDraftParticipantKeys] = useState<string[]>([]);
  const toggleDraftSession = (sessionKey: string) => setDraftQuizSessionKeys((current) => current.includes(sessionKey) ? current.filter((key) => key !== sessionKey) : [...current, sessionKey]);
  const toggleDraftParticipant = (participantKey: string) => setDraftParticipantKeys((current) => current.includes(participantKey) ? current.filter((key) => key !== participantKey) : [...current, participantKey]);

  const _selectTop = (count: number) => setSelectedRemedialIds(candidateIds.slice(0, count));
  const _toggleRemedialId = (id: number, checked: boolean) => setSelectedRemedialIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id));

  const handleOpenRemedialQuizBuilder = (studentKeys: string[]) => {
    setRemedialQuizStudentKeys(studentKeys);
    setRemedialQuizBuilderOpen(true);
  };

  const handleCreateRemedialQuizFromBuilder = async (config: { studentKeys: string[]; mode: string; questionCount: number; quizMode: 'strict' | 'standard'; duration: number }) => {
    try {
      const selectedQuestions = buildRemedialQuestionPool({
        mode: config.mode as 'wrong_only' | 'wrong_similar' | 'topic_based',
        studentKeys: config.studentKeys,
        remedialCandidates,
        questionPool: hardestQuestions.map((question) => ({ ...question, participantKeys: [] })),
      });

      const questionIds = selectedQuestions
        .slice(0, Math.min(config.questionCount, selectedQuestions.length))
        .map((question) => question.questionId);

      if (questionIds.length === 0) {
        window.alert('No questions available for the selected students.');
        return;
      }

      // Close the builder modal
      setRemedialQuizBuilderOpen(false);

      // Create the quiz
      const result = await onCreateRemedialQuiz(questionIds, { quizMode: config.quizMode, duration: config.duration });

      // Show success modal
      setRemedialQuizSuccess({
        quizCode: result.quiz_code,
        questionCount: result.question_count,
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to create remedial quiz.');
    }
  };

  const _createRemedialQuiz = async () => {
    if (selectedCandidateIds.length === 0) return;
    setCreatingRemedial(true);
    try {
      await onCreateRemedialQuiz(selectedCandidateIds, { quizMode: 'strict', duration: 30 });
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className={`mb-4 rounded-3xl px-5 py-4 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[220px] flex-1">
            <h2 className={`text-[20px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Analytics</h2>
            <p className={`mt-0.5 text-[12px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Analyze performance and identify areas for improvement.</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={analyticsLoading}
            className={`h-9 rounded-full px-4 text-[12px] font-medium transition-spring-fast active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-700 hover:bg-black/10'}`}
          >
            {analyticsLoading ? 'Loading' : 'Refresh'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className={`inline-flex h-9 rounded-full p-0.5 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`}>
            <button
              type="button"
              onClick={() => onSourceChange('exam')}
              className={`rounded-full px-4 text-[12px] font-medium transition-spring-fast ${analyticsSource === 'exam' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
            >
              Exam
            </button>
            <button
              type="button"
              onClick={() => onSourceChange('quiz')}
              className={`rounded-full px-4 text-[12px] font-medium transition-spring-fast ${analyticsSource === 'quiz' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
            >
              Quiz
            </button>
            <button
              type="button"
              onClick={() => onSourceChange('scheduled')}
              className={`rounded-full px-4 text-[12px] font-medium transition-spring-fast ${analyticsSource === 'scheduled' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}
            >
              Scheduled
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className={`mr-1 text-[11px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
            Date range
          </span>
          {[1, 3, 7, 14, 30].map((days) => {
            const isActive = isDateRangeActive(days);
            return (
              <button
                key={days}
                type="button"
                onClick={() => onDateRangeChange(rangeFromDays(days))}
                className={`h-8 rounded-full px-3 text-[11px] font-medium transition-spring-fast active:scale-95 ${
                  isActive
                    ? theme === 'dark'
                      ? 'bg-white/10 text-dark-text-primary'
                      : 'bg-white text-gray-900 shadow-ios-sm'
                    : theme === 'dark'
                    ? 'bg-white/5 text-dark-text-tertiary hover:bg-white/10'
                    : 'bg-black/5 text-gray-500 hover:bg-black/10'
                }`}
              >
                {days}D
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onDateRangeChange({ start: '', end: '' })}
            className={`h-8 rounded-full px-3 text-[11px] font-medium transition-spring-fast active:scale-95 ${
              isDateRangeActive('all')
                ? theme === 'dark'
                  ? 'bg-white/10 text-dark-text-primary'
                  : 'bg-white text-gray-900 shadow-ios-sm'
                : theme === 'dark'
                ? 'bg-white/5 text-dark-text-tertiary hover:bg-white/10'
                : 'bg-black/5 text-gray-500 hover:bg-black/10'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {analyticsError && <div className={`mb-2 rounded-2xl px-4 py-3 text-[12px] font-medium ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700'}`}>{analyticsError}</div>}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="mb-4 grid grid-cols-1 gap-4 px-3 py-1 sm:grid-cols-2">
          <button type="button" onClick={() => { if (analyticsSource !== 'quiz') return; setDraftQuizSessionKeys(activeQuizSessionKeys); setSessionPickerOpen(true); }} disabled={analyticsSource !== 'quiz'} className={`rounded-2xl border px-4 py-3 text-left shadow-ios-sm transition-spring hover:scale-[1.02] ${theme === 'dark' ? 'border-accent-blue bg-dark-800 hover:bg-dark-750 disabled:border-dark-border-medium disabled:text-dark-text-muted disabled:hover:bg-dark-800 disabled:hover:scale-100' : 'border-dark-800 bg-white hover:bg-nike-grey-100 disabled:border-nike-grey-200 disabled:text-[#9a9a9a] disabled:hover:bg-white disabled:hover:scale-100'}`}>
            <div className="flex items-center justify-between gap-2"><span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-dark-text-muted' : 'text-dark-text-muted'}`}>Sessions</span><span className={`text-[10px] font-black uppercase tracking-[0.12em] ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>Change</span></div>
            <p className={`mt-1 truncate text-sm font-black ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>{sessionCardTitle}</p>
            <p className={`mt-0.5 text-[10px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-grey-mid'}`}>{analyticsSource === 'quiz' ? `${quizSessions.length} available in date range` : 'Active only for Quiz source'}</p>
          </button>
          <button type="button" onClick={() => { setDraftParticipantKeys(activeParticipantKeys); setParticipantPickerOpen(true); }} className={`rounded-2xl border px-4 py-3 text-left shadow-ios-sm transition-spring hover:scale-[1.02] ${theme === 'dark' ? 'border-accent-blue bg-dark-800 hover:bg-dark-750' : 'border-dark-800 bg-white hover:bg-nike-grey-100'}`}>
            <div className="flex items-center justify-between gap-2"><span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-dark-text-muted' : 'text-dark-text-muted'}`}>Participants</span><span className={`text-[10px] font-black uppercase tracking-[0.12em] ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>Change</span></div>
            <p className={`mt-1 truncate text-sm font-black ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>{participantCardTitle}</p>
            <p className={`mt-0.5 text-[10px] font-medium ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-grey-mid'}`}>{participantCardMeta}</p>
          </button>
        </div>

        <div className="mb-6">
          <AnalyticsHeroStats summary={summary} theme={theme} />
        </div>

        {analyticsLoading && summary.attempts === 0 ? (
          <p className={`py-8 text-center text-sm font-semibold ${theme === 'dark' ? 'text-dark-text-muted' : 'text-dark-text-muted'}`}>Loading analytics...</p>
        ) : summary.attempts === 0 ? (
          <div className={`rounded-[24px] border-2 border-dashed p-6 text-center text-sm font-semibold ${theme === 'dark' ? 'border-dark-border-medium bg-dark-800 text-dark-text-muted' : 'border-nike-grey-200 bg-white text-dark-text-muted'}`}>No analytics data for current filters.</div>
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
          questionPool={hardestQuestions.map((question) => ({ ...question, participantKeys: [] }))}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xl p-4" role="dialog" aria-modal="true">
          <div className={`w-full max-w-2xl rounded-[24px] p-6 shadow-ios-xl ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Quiz session scope</p>
                <h3 className={`mt-1 text-xl font-black ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Choose sessions</h3>
                <p className={`mt-1 text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Pilih satu/lebih quiz untuk menghitung soal tersulit hanya dari sesi itu.</p>
              </div>
              <button type="button" onClick={() => setSessionPickerOpen(false)} className={`h-9 rounded-full border px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-spring-fast hover:scale-105 ${theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-primary hover:border-dark-text-primary' : 'border-nike-grey-300 bg-white text-gray-900 hover:border-gray-900'}`}>Close</button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setDraftQuizSessionKeys([])} className={`h-8 rounded-full border px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-spring-fast hover:scale-105 ${theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-primary' : 'border-nike-grey-300 bg-white text-gray-900'}`}>All</button>
              {[1, 2, 5].map((count) => <button key={count} type="button" onClick={() => setDraftQuizSessionKeys(quizSessions.slice(0, count).map((session) => session.key))} className={`h-8 rounded-full border px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-spring-fast hover:scale-105 ${theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-primary' : 'border-nike-grey-300 bg-white text-gray-900'}`}>Latest {count}</button>)}
            </div>
            <div className={`grid max-h-[56vh] gap-2 overflow-y-auto sm:grid-cols-2 ${theme === 'dark' ? 'result-details-scroll-dark' : 'result-details-scroll-light'}`}>
              {quizSessions.map((session) => {
                const active = draftQuizSessionKeys.includes(session.key);
                const topics = [session.mapel, session.bab, session.subBab].filter(Boolean);
                const timeAgo = formatTimeAgo(session.createdAt || session.finishedAt);
                return (
                  <button key={session.key} type="button" onClick={() => toggleDraftSession(session.key)} className={`rounded-[16px] border px-3 py-2 text-left transition-spring hover:scale-[1.01] ${active ? (theme === 'dark' ? 'border-accent-blue bg-accent-blue text-white' : 'border-gray-900 bg-gray-900 text-white') : (theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-primary hover:bg-dark-700' : 'border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100')}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-black">{session.label}</p>
                      <span className={`text-[10px] font-black ${active ? 'text-white/70' : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}>{active ? 'Selected' : 'Select'}</span>
                    </div>
                    <p className={`mt-1 text-[9px] font-semibold ${active ? 'text-white/60' : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400')}`}>
                      {timeAgo || 'No date available'}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-semibold ${active ? 'text-white/70' : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}>{session.attempts} attempts</span>
                      {topics.length > 0 && (
                        <>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${active ? 'bg-white/20 text-white' : (theme === 'dark' ? 'bg-dark-700 text-dark-text-secondary' : 'bg-white text-gray-600')}`}>
                            {formatCategorySelectionLabel(topics[0])}
                          </span>
                          {topics.length > 1 && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${active ? 'bg-white/20 text-white' : (theme === 'dark' ? 'bg-dark-700 text-dark-text-secondary' : 'bg-white text-gray-600')}`}>
                              +{topics.length - 1}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
              {quizSessions.length === 0 && <p className={`rounded-[16px] p-4 text-sm font-semibold ${theme === 'dark' ? 'bg-dark-750 text-dark-text-tertiary' : 'bg-gray-50 text-gray-500'}`}>No quiz sessions in current date/filter scope.</p>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSessionPickerOpen(false)} className={`h-9 rounded-full border px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-spring-fast hover:scale-105 ${theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-primary' : 'border-nike-grey-300 bg-white text-gray-900'}`}>Cancel</button>
              <button type="button" onClick={() => { setSelectedRemedialIds([]); onQuizSessionsChange(draftQuizSessionKeys); setSessionPickerOpen(false); }} className={`h-9 rounded-full px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-spring-fast hover:scale-105 ${theme === 'dark' ? 'bg-accent-blue' : 'bg-gray-900'}`}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {participantPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xl p-4" role="dialog" aria-modal="true">
          <div className={`w-full max-w-xl rounded-[24px] p-6 shadow-ios-xl ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>Participant scope</p>
                <h3 className={`mt-1 text-xl font-black ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Choose participants</h3>
                <p className={`mt-1 text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Pilih satu/lebih peserta. Kosong berarti semua peserta.</p>
              </div>
              <button type="button" onClick={() => setParticipantPickerOpen(false)} className={`h-9 rounded-full border px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-spring-fast hover:scale-105 ${theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-primary hover:border-dark-text-primary' : 'border-nike-grey-300 bg-white text-gray-900 hover:border-gray-900'}`}>Close</button>
            </div>
            <div className={`grid max-h-[60vh] gap-2 overflow-y-auto sm:grid-cols-2 ${theme === 'dark' ? 'result-details-scroll-dark' : 'result-details-scroll-light'}`}>
              <button type="button" onClick={() => setDraftParticipantKeys([])} className={`rounded-[16px] border px-3 py-2 text-left transition-spring hover:scale-[1.01] ${draftParticipantKeys.length === 0 ? (theme === 'dark' ? 'border-accent-blue bg-accent-blue text-white' : 'border-gray-900 bg-gray-900 text-white') : (theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-primary hover:bg-dark-700' : 'border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100')}`}>
                <p className="truncate text-sm font-black">All participants</p>
                <p className={`mt-1 text-[10px] font-semibold ${draftParticipantKeys.length === 0 ? 'text-white/70' : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}>{participants.length} participants included</p>
              </button>
              {participants.map((participant) => {
                const active = draftParticipantKeys.includes(participant.key);
                return (
                  <button key={participant.key} type="button" onClick={() => toggleDraftParticipant(participant.key)} className={`rounded-[16px] border px-3 py-2 text-left transition-spring hover:scale-[1.01] ${active ? (theme === 'dark' ? 'border-accent-blue bg-accent-blue text-white' : 'border-gray-900 bg-gray-900 text-white') : (theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-primary hover:bg-dark-700' : 'border-gray-200 bg-gray-50 text-gray-900 hover:bg-gray-100')}`}>
                    <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-black">{participant.name}</p><span className={`text-[10px] font-black ${active ? 'text-white/70' : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}>{active ? 'Selected' : 'Select'}</span></div>
                    <p className={`mt-1 text-[10px] font-semibold ${active ? 'text-white/70' : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500')}`}>{participant.attempts} attempts</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setParticipantPickerOpen(false)} className={`h-9 rounded-full border px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-spring-fast hover:scale-105 ${theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-primary' : 'border-nike-grey-300 bg-white text-gray-900'}`}>Cancel</button>
              <button type="button" onClick={() => { setSelectedRemedialIds([]); onParticipantsChange(draftParticipantKeys); setParticipantPickerOpen(false); }} className={`h-9 rounded-full px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-spring-fast hover:scale-105 ${theme === 'dark' ? 'bg-accent-blue' : 'bg-gray-900'}`}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {selectedQuestion && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-black/60' : 'bg-black/40'}`} role="dialog" aria-modal="true">
          <div className={`max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[24px] p-4 shadow-2xl ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-dark-text-muted'}`}>
                  Question #{selectedQuestion.questionId}
                </p>
                <h3 className={`mt-1 text-xl font-black ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>
                  Question Detail
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuestion(null)}
                className={`h-9 rounded-full border px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                  theme === 'dark'
                    ? 'border-dark-600 text-dark-text-primary hover:border-dark-text-primary'
                    : 'border-nike-grey-300 text-nike-black hover:border-dark-800'
                }`}
              >
                Close
              </button>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className={`rounded-[14px] border p-2 ${theme === 'dark' ? 'border-dark-600 bg-dark-750' : 'border-nike-grey-200 bg-nike-grey-100'}`}>
                <div className={`text-2xl font-black ${theme === 'dark' ? 'text-accent-red' : 'text-[#FF3B30]'}`}>
                  {selectedQuestion.wrongRate}%
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-dark-text-muted'}`}>
                  Wrong Rate
                </div>
              </div>
              <div className={`rounded-[14px] border p-2 ${theme === 'dark' ? 'border-dark-600 bg-dark-750' : 'border-nike-grey-200 bg-nike-grey-100'}`}>
                <div className={`text-2xl font-black ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>
                  {selectedQuestion.incorrect}/{selectedQuestion.attempts}
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-dark-text-muted'}`}>
                  Incorrect
                </div>
              </div>
              <div className={`rounded-[14px] border p-2 ${theme === 'dark' ? 'border-dark-600 bg-dark-750' : 'border-nike-grey-200 bg-nike-grey-100'}`}>
                <div className={`text-2xl font-black ${theme === 'dark' ? 'text-accent-green' : 'text-status-green'}`}>
                  {selectedQuestion.correct}
                </div>
                <div className={`text-[10px] font-bold uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-dark-text-muted'}`}>
                  Correct
                </div>
              </div>
            </div>
            {selectedQuestion.question ? (
              <div className="space-y-2">
                <div className={`rounded-[24px] border p-3 ${theme === 'dark' ? 'border-dark-600 bg-dark-750' : 'border-nike-grey-200 bg-white'}`}>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {selectedQuestion.question.mapels.map((value) => <TopicBadge key={`m-${value}`} label="M" value={formatCategorySelectionLabel(value)} theme={theme} />)}
                    {selectedQuestion.question.babs.map((value) => <TopicBadge key={`b-${value}`} label="B" value={formatCategorySelectionLabel(value)} theme={theme} />)}
                    {selectedQuestion.question.sub_babs.map((value) => <TopicBadge key={`s-${value}`} label="S" value={formatCategorySelectionLabel(value)} theme={theme} />)}
                  </div>
                  <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>
                    <RichContent html={selectedQuestion.question.question_text} />
                  </div>
                </div>
                {selectedQuestion.question.question_type === 'short_answer' ? (
                  <div className={`rounded-[14px] border p-3 ${theme === 'dark' ? 'border-accent-green/30 bg-accent-green/10' : 'border-status-green bg-mint-soft'}`}>
                    <div className={`mb-1 text-[10px] font-black uppercase tracking-[0.16em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-dark-text-muted'}`}>
                      Correct Answer
                    </div>
                    <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>
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
            ) : <div className={`rounded-[24px] border p-4 text-sm font-semibold ${theme === 'dark' ? 'border-dark-600 bg-dark-750 text-dark-text-tertiary' : 'border-nike-grey-200 bg-nike-grey-100 text-dark-text-muted'}`}>Question data not found. It may have been deleted.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
