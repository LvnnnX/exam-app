"use client";

import { useCallback, useState } from 'react';
import { type RawQuestion, fetchQuestionsByIds } from '@/lib/questions';
import { supabase } from '@/lib/supabase';

export type AnalyticsSource = 'exam' | 'quiz';

export type AnalyticsDateRange = {
  start: string;
  end: string;
};

type AnalyticsAnswer = {
  question_id: number;
  user_answer: string;
  is_correct: boolean;
};

type AnalyticsResultRow = {
  id: number | string;
  participantKey: string;
  participantName: string;
  score: number;
  total_questions: number;
  mapel: string | null;
  bab: string | null;
  sub_bab: string | null;
  taken_at: string;
  user_answers: AnalyticsAnswer[] | null;
  duration_seconds?: number | null;
  mode?: string | null;
  sessionKey?: string;
  sessionLabel?: string;
};

type QuizSessionRow = {
  id: number;
  quiz_code?: string | null;
  mapel: string | null;
  bab: string | null;
  sub_bab: string | null;
  question_count: number | null;
  created_at: string | null;
  finished_at?: string | null;
  quiz_mode?: string | null;
};

type QuizPlayerRow = {
  id: number;
  kuis_id: number;
  name?: string | null;
  score: number | null;
  total_time?: number | null;
  finished_at?: string | null;
};

type QuizAnswerRow = {
  player_id: number;
  question_id: number;
  user_answer: string;
  is_correct: boolean;
};

type AnalyticsSummary = {
  attempts: number;
  avgScore: number;
  passRate: number;
  avgDurationSeconds: number | null;
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

type QuestionStat = {
  questionId: number;
  attempts: number;
  incorrect: number;
  correct: number;
  wrongRate: number;
  question?: RawQuestion;
};

type TrendPoint = {
  key: string;
  label: string;
  attempts: number;
  avgScore: number;
};

type TopicTrendPoint = {
  key: string;
  label: string;
  topic: string;
  attempts: number;
  correct: number;
  wrong: number;
  accuracy: number;
};

type StudentWeaknessTopic = {
  topic: string;
  attempts: number;
  correct: number;
  wrong: number;
  accuracy: number;
};

type StudentWeakness = {
  key: string;
  name: string;
  attempts: number;
  avgScore: number;
  totalQuestionsAnswered: number;
  totalQuestionsWrong: number;
  weakestTopics: StudentWeaknessTopic[];
};

type AnalyticsParticipant = {
  key: string;
  name: string;
  attempts: number;
  avgScore: number;
  totalQuestionsAnswered: number;
  totalQuestionsWrong: number;
};

type AnalyticsQuizSession = {
  key: string;
  quizCode: string;
  label: string;
  mapel: string | null;
  bab: string | null;
  subBab: string | null;
  createdAt: string | null;
  finishedAt: string | null;
  attempts: number;
};

type RemedialQuestionCandidate = QuestionStat & {
  participantKeys: string[];
  participantNames: string[];
};

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

function getDefaultDateRange(): AnalyticsDateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 29);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

const emptyAnalyticsData: AnalyticsData = {
  summary: {
    attempts: 0,
    avgScore: 0,
    passRate: 0,
    avgDurationSeconds: null,
  },
  hardestTopics: [],
  hardestQuestions: [],
  scoreTrend: [],
  topicTrend: [],
  studentWeaknesses: [],
  participants: [],
  quizSessions: [],
  remedialCandidates: [],
};

function splitResultCategories(value: string | null | undefined) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function hasAnyResultCategory(value: string | null | undefined, selectedValues: string[]) {
  if (selectedValues.length === 0) return true;
  const categories = splitResultCategories(value);
  return selectedValues.some((selected) => categories.includes(selected));
}

function safePercent(score: number, total: number) {
  if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0) return null;
  return score / total;
}

function dayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toISOString().slice(0, 10);
}

function dayLabel(key: string) {
  if (key === 'Unknown') return key;
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function startIso(value: string) {
  return value ? `${value}T00:00:00.000` : null;
}

function endIso(value: string) {
  return value ? `${value}T23:59:59.999` : null;
}

function primaryTopic(row: AnalyticsResultRow) {
  return splitResultCategories(row.sub_bab)[0]
    || splitResultCategories(row.bab)[0]
    || splitResultCategories(row.mapel)[0]
    || 'Uncategorized';
}

function normalizeExamRow(row: AnalyticsResultRow & { name?: string | null }): AnalyticsResultRow {
  const name = row.name?.trim() || 'Unknown participant';
  return {
    ...row,
    participantKey: `exam:${name.toLowerCase() || row.id}`,
    participantName: name,
  };
}

async function fetchExamRows(mapels: string[], babs: string[], subBabs: string[], mode: string, dateRange: AnalyticsDateRange) {
  let query = supabase
    .from('exam_results')
    .select('id, name, score, total_questions, mapel, bab, sub_bab, taken_at, user_answers, duration_seconds, mode')
    .order('taken_at', { ascending: true })
    .limit(1000); // Reduced from 5000 to 1000 for better performance

  if (mode !== 'all') {
    query = query.eq('mode', mode);
  }

  const start = startIso(dateRange.start);
  const end = endIso(dateRange.end);
  if (start) query = query.gte('taken_at', start);
  if (end) query = query.lte('taken_at', end);

  const { data, error } = await query;
  if (error) throw error;

  return ((data || []) as (AnalyticsResultRow & { name?: string | null })[])
    .map(normalizeExamRow)
    .filter((row) => (
      hasAnyResultCategory(row.mapel, mapels) &&
      hasAnyResultCategory(row.bab, babs) &&
      hasAnyResultCategory(row.sub_bab, subBabs)
    ));
}

async function fetchQuizRows(mapels: string[], babs: string[], subBabs: string[], mode: string, dateRange: AnalyticsDateRange, quizSessionKeys: string[] = []) {
  let sessionQuery = supabase
    .from('kuis_logs')
    .select('id, quiz_code, mapel, bab, sub_bab, question_count, created_at, finished_at, quiz_mode')
    .eq('status', 'finished')
    .limit(1000); // Reduced from 5000 to 1000 for better performance

  if (mode !== 'all' && mode !== 'exam' && mode !== 'survival') {
    sessionQuery = sessionQuery.eq('quiz_mode', mode);
  }

  const start = startIso(dateRange.start);
  const end = endIso(dateRange.end);
  if (start) sessionQuery = sessionQuery.gte('finished_at', start);
  if (end) sessionQuery = sessionQuery.lte('finished_at', end);

  const { data: sessionsData, error: sessionsError } = await sessionQuery;
  if (sessionsError) throw sessionsError;

  const sessions = ((sessionsData || []) as QuizSessionRow[]).filter((session) => (
    hasAnyResultCategory(session.mapel, mapels) &&
    hasAnyResultCategory(session.bab, babs) &&
    hasAnyResultCategory(session.sub_bab, subBabs)
  ));

  const selectedSessionKeys = new Set(quizSessionKeys);
  const scopedSessions = selectedSessionKeys.size === 0 ? sessions : sessions.filter((session) => selectedSessionKeys.has(String(session.id)));
  const sessionIds = scopedSessions.map((session) => session.id);
  if (sessions.length === 0) return [];

  let players: QuizPlayerRow[] = [];
  if (sessionIds.length > 0) {
    const { data: playersData, error: playersError } = await supabase
      .from('public_players')
      .select('id, kuis_id, name, score, total_time, finished_at')
      .in('kuis_id', sessionIds);
    if (playersError) throw playersError;
    players = (playersData || []) as QuizPlayerRow[];
  }
  const playerIds = players.map((player) => player.id);
  const answersByPlayer = new Map<number, AnalyticsAnswer[]>();

  if (playerIds.length > 0) {
    const { data: answersData, error: answersError } = await supabase
      .from('kuis_results')
      .select('player_id, question_id, user_answer, is_correct')
      .in('player_id', playerIds);
    if (answersError) throw answersError;

    for (const answer of (answersData || []) as QuizAnswerRow[]) {
      const current = answersByPlayer.get(answer.player_id) || [];
      current.push({
        question_id: answer.question_id,
        user_answer: answer.user_answer,
        is_correct: answer.is_correct,
      });
      answersByPlayer.set(answer.player_id, current);
    }
  }

  const sessionOptionRows = sessions.map((session): AnalyticsResultRow => ({
    id: `quiz-session-${session.id}`,
    participantKey: '__session_option__',
    participantName: '__session_option__',
    score: 0,
    total_questions: 0,
    mapel: session.mapel,
    bab: session.bab,
    sub_bab: session.sub_bab,
    taken_at: session.finished_at || session.created_at || new Date(0).toISOString(),
    user_answers: [],
    duration_seconds: null,
    mode: session.quiz_mode || null,
    sessionKey: String(session.id),
    sessionLabel: session.quiz_code ? `Quiz ${session.quiz_code}` : `Quiz ${session.id}`,
  }));

  const sessionsById = new Map(scopedSessions.map((session) => [session.id, session]));
  const playerRows = players.map((player): AnalyticsResultRow | null => {
    const session = sessionsById.get(player.kuis_id);
    if (!session) return null;
    const name = player.name?.trim() || `Player #${player.id}`;

    return {
      id: `quiz-${player.id}`,
      participantKey: `quiz:${player.id}`,
      participantName: name,
      score: Number(player.score || 0),
      total_questions: Number(session.question_count || 0),
      mapel: session.mapel,
      bab: session.bab,
      sub_bab: session.sub_bab,
      taken_at: player.finished_at || session.finished_at || session.created_at || new Date(0).toISOString(),
      user_answers: answersByPlayer.get(player.id) || [],
      duration_seconds: player.total_time ?? null,
      mode: session.quiz_mode || null,
      sessionKey: String(session.id),
      sessionLabel: session.quiz_code ? `Quiz ${session.quiz_code}` : `Quiz ${session.id}`,
    };
  }).filter((row): row is AnalyticsResultRow => row !== null);

  return [...sessionOptionRows, ...playerRows];
}

async function fetchSummaryViaRPC(
  dateRange: AnalyticsDateRange,
  mode: string,
  mapels: string[],
  babs: string[],
  subBabs: string[]
): Promise<AnalyticsSummary | null> {
  try {
    const start = startIso(dateRange.start);
    const end = endIso(dateRange.end);

    if (!start || !end) return null;

    const { data, error } = await supabase.rpc('get_analytics_summary_filtered', {
      p_start_date: start,
      p_end_date: end,
      p_mode: mode,
      p_mapels: mapels.length > 0 ? mapels : null,
      p_babs: babs.length > 0 ? babs : null,
      p_sub_babs: subBabs.length > 0 ? subBabs : null,
    });

    if (error) {
      console.warn('RPC summary failed, falling back to client-side calculation:', error);
      return null;
    }

    return data as AnalyticsSummary;
  } catch (err) {
    console.warn('RPC summary error, falling back to client-side calculation:', err);
    return null;
  }
}

async function buildAnalyticsData(
  rows: AnalyticsResultRow[],
  participantKey = 'all',
  rpcSummary: AnalyticsSummary | null = null
): Promise<AnalyticsData> {
  const answerRows = rows.filter((row) => row.participantKey !== '__session_option__');
  const scopedRows = participantKey === 'all' ? answerRows : answerRows.filter((row) => row.participantKey === participantKey);
  const scoredRows = scopedRows
    .map((row) => ({ row, pct: safePercent(row.score, row.total_questions) }))
    .filter((item): item is { row: AnalyticsResultRow; pct: number } => item.pct !== null);

  const durations = scopedRows
    .map((row) => row.duration_seconds)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  // Use RPC summary if available and participantKey is 'all', otherwise calculate client-side
  const summary: AnalyticsSummary = (rpcSummary && participantKey === 'all')
    ? rpcSummary
    : {
        attempts: scopedRows.length,
        avgScore: scoredRows.length > 0 ? Math.round(scoredRows.reduce((sum, item) => sum + item.pct, 0) / scoredRows.length * 100) : 0,
        passRate: scoredRows.length > 0 ? Math.round(scoredRows.filter((item) => item.pct >= 0.7).length / scoredRows.length * 100) : 0,
        avgDurationSeconds: durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
      };

  const participantOptionsMap = new Map<string, { key: string; name: string; attempts: number; totalPct: number; totalQuestionsAnswered: number; totalQuestionsWrong: number }>();
  for (const row of answerRows) {
    const pct = safePercent(row.score, row.total_questions);
    const current = participantOptionsMap.get(row.participantKey) || { key: row.participantKey, name: row.participantName, attempts: 0, totalPct: 0, totalQuestionsAnswered: 0, totalQuestionsWrong: 0 };
    current.attempts += 1;
    current.totalPct += pct ?? 0;
    current.totalQuestionsAnswered += row.total_questions;
    current.totalQuestionsWrong += Math.max(0, row.total_questions - row.score);
    participantOptionsMap.set(row.participantKey, current);
  }
  const participants = Array.from(participantOptionsMap.values())
    .map((participant) => ({
      key: participant.key,
      name: participant.name,
      attempts: participant.attempts,
      avgScore: participant.attempts > 0 ? Math.round(participant.totalPct / participant.attempts * 100) : 0,
      totalQuestionsAnswered: participant.totalQuestionsAnswered,
      totalQuestionsWrong: participant.totalQuestionsWrong,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const quizSessionMap = new Map<string, AnalyticsQuizSession>();
  for (const row of rows) {
    if (!row.sessionKey) continue;
    const current = quizSessionMap.get(row.sessionKey) || {
      key: row.sessionKey,
      quizCode: row.sessionLabel?.replace(/^Quiz\s+/, '') || row.sessionKey,
      label: row.sessionLabel || `Quiz ${row.sessionKey}`,
      mapel: row.mapel,
      bab: row.bab,
      subBab: row.sub_bab,
      createdAt: null,
      finishedAt: row.taken_at,
      attempts: 0,
    };
    if (row.participantKey !== '__session_option__') current.attempts += 1;
    if (!current.finishedAt || row.taken_at > current.finishedAt) current.finishedAt = row.taken_at;
    quizSessionMap.set(row.sessionKey, current);
  }
  const quizSessions = Array.from(quizSessionMap.values())
    .sort((a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')) || a.label.localeCompare(b.label));

  const topicMap = new Map<string, TopicStat>();
  for (const item of scoredRows) {
    const mapels = splitResultCategories(item.row.mapel);
    const babs = splitResultCategories(item.row.bab);
    const subBabs = splitResultCategories(item.row.sub_bab);
    const mapel = mapels[0] || '-';
    const bab = babs[0] || '-';
    const subBab = subBabs[0] || '-';
    const key = `${mapel}|${bab}|${subBab}`;
    const current = topicMap.get(key) || {
      key,
      mapel,
      bab,
      subBab,
      attempts: 0,
      answered: 0,
      correct: 0,
      accuracy: 0,
      wrongRate: 0,
    };

    current.attempts += 1;
    current.answered += item.row.total_questions;
    current.correct += item.row.score;
    current.accuracy = current.answered > 0 ? Math.round(current.correct / current.answered * 100) : 0;
    current.wrongRate = 100 - current.accuracy;
    topicMap.set(key, current);
  }

  const hardestTopics = Array.from(topicMap.values())
    .filter((topic) => topic.answered > 0)
    .sort((a, b) => b.wrongRate - a.wrongRate || b.attempts - a.attempts)
    .slice(0, 5);

  const questionMap = new Map<number, Omit<QuestionStat, 'question'>>();
  const missedByQuestion = new Map<number, Map<string, string>>();
  for (const row of scopedRows) {
    const answers = Array.isArray(row.user_answers) ? row.user_answers : [];
    for (const answer of answers) {
      if (!Number.isInteger(answer.question_id)) continue;
      const current = questionMap.get(answer.question_id) || {
        questionId: answer.question_id,
        attempts: 0,
        incorrect: 0,
        correct: 0,
        wrongRate: 0,
      };
      current.attempts += 1;
      if (answer.is_correct) current.correct += 1;
      else {
        current.incorrect += 1;
        const missed = missedByQuestion.get(answer.question_id) || new Map<string, string>();
        missed.set(row.participantKey, row.participantName);
        missedByQuestion.set(answer.question_id, missed);
      }
      current.wrongRate = current.attempts > 0 ? Math.round(current.incorrect / current.attempts * 100) : 0;
      questionMap.set(answer.question_id, current);
    }
  }

  const rankedQuestionStats = Array.from(questionMap.values())
    .sort((a, b) => b.wrongRate - a.wrongRate || b.incorrect - a.incorrect || b.attempts - a.attempts);
  const topQuestionStats = rankedQuestionStats; // Show all questions, not just top 5
  const remedialStats = rankedQuestionStats.filter((item) => item.incorrect > 0).slice(0, 20);
  const questionIds = Array.from(new Set([...topQuestionStats, ...remedialStats].map((item) => item.questionId)));
  const questions = questionIds.length > 0 ? await fetchQuestionsByIds(questionIds) : [];
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const hardestQuestions = topQuestionStats.map((item) => ({ ...item, question: questionsById.get(item.questionId) }));
  const remedialCandidates = remedialStats
    .map((item) => {
      const missed = missedByQuestion.get(item.questionId) || new Map<string, string>();
      return {
        ...item,
        question: questionsById.get(item.questionId),
        participantKeys: Array.from(missed.keys()),
        participantNames: Array.from(missed.values()),
      };
    })
    .filter((item) => item.question && !item.question.is_hidden);

  const trendMap = new Map<string, { attempts: number; totalPct: number }>();
  for (const item of scoredRows) {
    const key = dayKey(item.row.taken_at);
    const current = trendMap.get(key) || { attempts: 0, totalPct: 0 };
    current.attempts += 1;
    current.totalPct += item.pct;
    trendMap.set(key, current);
  }

  const scoreTrend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([key, value]) => ({
      key,
      label: dayLabel(key),
      attempts: value.attempts,
      avgScore: Math.round(value.totalPct / value.attempts * 100),
    }));

  const topicTrendMap = new Map<string, { key: string; label: string; topic: string; attempts: number; correct: number; wrong: number }>();
  for (const item of scoredRows) {
    const date = dayKey(item.row.taken_at);
    const topic = primaryTopic(item.row);
    const key = `${date}|${topic}`;
    const current = topicTrendMap.get(key) || { key, label: dayLabel(date), topic, attempts: 0, correct: 0, wrong: 0 };
    current.attempts += 1;
    current.correct += item.row.score;
    current.wrong += Math.max(0, item.row.total_questions - item.row.score);
    topicTrendMap.set(key, current);
  }

  const topicTrend = Array.from(topicTrendMap.values())
    .map((item) => ({
      ...item,
      accuracy: item.correct + item.wrong > 0 ? Math.round(item.correct / (item.correct + item.wrong) * 100) : 0,
    }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.accuracy - b.accuracy || b.attempts - a.attempts)
    .slice(-8);

  // Fetch all questions answered by participants for accurate topic-based weakness analysis
  const allAnsweredQuestionIds = new Set<number>();
  for (const item of scoredRows) {
    const answers = Array.isArray(item.row.user_answers) ? item.row.user_answers : [];
    for (const answer of answers) {
      if (Number.isInteger(answer.question_id)) {
        allAnsweredQuestionIds.add(answer.question_id);
      }
    }
  }
  const allAnsweredQuestions = allAnsweredQuestionIds.size > 0 ? await fetchQuestionsByIds(Array.from(allAnsweredQuestionIds)) : [];
  const allQuestionsById = new Map(allAnsweredQuestions.map((q) => [q.id, q]));

  // Helper function to get topic from question data
  function getQuestionTopic(question: RawQuestion): string {
    const subBab = question.sub_babs?.[0];
    const bab = question.babs?.[0];
    const mapel = question.mapels?.[0];
    return subBab || bab || mapel || 'Uncategorized';
  }

  const participantMap = new Map<string, {
    key: string;
    name: string;
    attempts: number;
    totalPct: number;
    topics: Map<string, StudentWeaknessTopic>;
  }>();
  for (const item of scoredRows) {
    const participant = participantMap.get(item.row.participantKey) || {
      key: item.row.participantKey,
      name: item.row.participantName,
      attempts: 0,
      totalPct: 0,
      topics: new Map<string, StudentWeaknessTopic>(),
    };
    participant.attempts += 1;
    participant.totalPct += item.pct;

    // Iterate through user_answers to get accurate topic-based statistics from actual questions
    const answers = Array.isArray(item.row.user_answers) ? item.row.user_answers : [];
    for (const answer of answers) {
      const question = allQuestionsById.get(answer.question_id);
      if (!question) continue;

      // Get topic from question's actual mapel/bab/sub_bab
      const topic = getQuestionTopic(question);
      const topicRow = participant.topics.get(topic) || { topic, attempts: 0, correct: 0, wrong: 0, accuracy: 0 };
      topicRow.attempts += 1;
      if (answer.is_correct) {
        topicRow.correct += 1;
      } else {
        topicRow.wrong += 1;
      }
      topicRow.accuracy = topicRow.correct + topicRow.wrong > 0 ? Math.round(topicRow.correct / (topicRow.correct + topicRow.wrong) * 100) : 0;
      participant.topics.set(topic, topicRow);
    }

    participantMap.set(item.row.participantKey, participant);
  }

  const studentWeaknesses = Array.from(participantMap.values())
    .map((participant) => {
      // Calculate totals from ALL topics (not just weakest 3)
      const allTopics = Array.from(participant.topics.values());
      const totalQuestionsAnswered = allTopics.reduce((sum, topic) => sum + topic.correct + topic.wrong, 0);
      const totalQuestionsWrong = allTopics.reduce((sum, topic) => sum + topic.wrong, 0);

      const weakestTopics = allTopics
        .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong || b.attempts - a.attempts)
        .slice(0, 3);
      return {
        key: participant.key,
        name: participant.name,
        attempts: participant.attempts,
        avgScore: Math.round(participant.totalPct / participant.attempts * 100),
        totalQuestionsAnswered,
        totalQuestionsWrong,
        weakestTopics,
      };
    })
    .filter((participant) => participant.weakestTopics.length > 0)
    .sort((a, b) => a.avgScore - b.avgScore || b.attempts - a.attempts);

  return {
    summary,
    hardestTopics,
    hardestQuestions,
    scoreTrend,
    topicTrend,
    studentWeaknesses,
    participants,
    quizSessions,
    remedialCandidates,
  };
}

export default function useAdminAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>(emptyAnalyticsData);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsSource, setAnalyticsSource] = useState<AnalyticsSource>('exam');
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>(() => getDefaultDateRange());
  const [activeParticipantKey, setActiveParticipantKey] = useState('all');
  const [activeQuizSessionKeys, setActiveQuizSessionKeys] = useState<string[]>([]);

  const fetchAnalytics = useCallback(async (
    mapels: string[] = [],
    babs: string[] = [],
    subBabs: string[] = [],
    mode = 'all',
    source: AnalyticsSource = analyticsSource,
    range: AnalyticsDateRange = dateRange,
    participantKey = activeParticipantKey,
    quizSessionKeys: string[] = activeQuizSessionKeys,
  ) => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const rows = source === 'quiz'
        ? await fetchQuizRows(mapels, babs, subBabs, mode, range, quizSessionKeys)
        : await fetchExamRows(mapels, babs, subBabs, mode, range);

      // Use RPC for summary calculation when possible (exam source + no participant filter)
      let rpcSummary: AnalyticsSummary | null = null;
      if (source === 'exam' && participantKey === 'all') {
        rpcSummary = await fetchSummaryViaRPC(range, mode, mapels, babs, subBabs);
      }

      setAnalyticsData(await buildAnalyticsData(rows, participantKey, rpcSummary));
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setAnalyticsError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      setAnalyticsData(emptyAnalyticsData);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [activeParticipantKey, activeQuizSessionKeys, analyticsSource, dateRange]);

  const changeAnalyticsSource = useCallback((source: AnalyticsSource, mapels: string[] = [], babs: string[] = [], subBabs: string[] = [], mode = 'all') => {
    setAnalyticsSource(source);
    setActiveParticipantKey('all');
    void fetchAnalytics(mapels, babs, subBabs, mode, source, dateRange, 'all', activeQuizSessionKeys);
  }, [activeQuizSessionKeys, dateRange, fetchAnalytics]);

  const changeDateRange = useCallback((range: AnalyticsDateRange, mapels: string[] = [], babs: string[] = [], subBabs: string[] = [], mode = 'all') => {
    setDateRange(range);
    void fetchAnalytics(mapels, babs, subBabs, mode, analyticsSource, range, activeParticipantKey, activeQuizSessionKeys);
  }, [activeParticipantKey, activeQuizSessionKeys, analyticsSource, fetchAnalytics]);

  const changeParticipant = useCallback((participantKey: string, mapels: string[] = [], babs: string[] = [], subBabs: string[] = [], mode = 'all') => {
    setActiveParticipantKey(participantKey);
    void fetchAnalytics(mapels, babs, subBabs, mode, analyticsSource, dateRange, participantKey, activeQuizSessionKeys);
  }, [activeQuizSessionKeys, analyticsSource, dateRange, fetchAnalytics]);

  const changeQuizSessions = useCallback((quizSessionKeys: string[], mapels: string[] = [], babs: string[] = [], subBabs: string[] = [], mode = 'all') => {
    setActiveQuizSessionKeys(quizSessionKeys);
    void fetchAnalytics(mapels, babs, subBabs, mode, analyticsSource, dateRange, activeParticipantKey, quizSessionKeys);
  }, [activeParticipantKey, analyticsSource, dateRange, fetchAnalytics]);

  return {
    analyticsData,
    analyticsLoading,
    analyticsError,
    analyticsSource,
    dateRange,
    activeParticipantKey,
    activeQuizSessionKeys,
    fetchAnalytics,
    changeAnalyticsSource,
    changeDateRange,
    changeParticipant,
    changeQuizSessions,
  };
}
