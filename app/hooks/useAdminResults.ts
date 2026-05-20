"use client";

import { useCallback, useState } from 'react';
import { type RawQuestion, fetchQuestionsByIds } from '@/lib/questions';
import { supabase } from '@/lib/supabase';
import { fetchResultsPaginatedAction, type ResultFilters } from '@/app/actions/admin/results';
import getAdminAccessToken from '@/app/hooks/getAdminAccessToken';

type ExamResult = {
  id: number;
  name: string;
  score: number;
  total_questions: number;
  mapel: string;
  bab: string;
  sub_bab: string;
  taken_at: string;
  user_answers?: {
    question_id: number;
    user_answer: string;
    is_correct: boolean;
  }[];
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  mode?: string;
};

type LiveSession = {
  session_id: string;
  name: string;
  mapel: string;
  bab: string;
  sub_bab: string;
  mode: string;
  question_count: number;
  question_ids: number[];
  current_index: number;
  user_answers: Record<string, string>;
  lives: number;
  start_time: string;
};


function splitResultCategories(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function hasAnyResultCategory(value: string, selectedValues: string[]) {
  if (selectedValues.length === 0) return true;
  const categories = splitResultCategories(value);
  return selectedValues.some(selected => categories.includes(selected));
}

export default function useAdminResults() {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [loading, setLoading] = useState(false);
  const [resultPage, setResultPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [paginationMeta, setPaginationMeta] = useState<{ total: number; totalPages: number } | null>(null);
  const [statsData, setStatsData] = useState<{ score: number; total_questions: number; duration_seconds?: number }[]>([]);
  const [activeResMapel, setActiveResMapel] = useState<string[]>([]);
  const [activeResbab, setActiveResbab] = useState<string[]>([]);
  const [activeResSubBab, setActiveResSubBab] = useState<string[]>([]);
  const [activeModeFilter, setActiveModeFilter] = useState<string>('all');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [liveSessionPage, setLiveSessionPage] = useState(1);
  const [liveSessionItemsPerPage, setLiveSessionItemsPerPage] = useState(5);
  const [liveSessionPaginationMeta, setLiveSessionPaginationMeta] = useState<{ total: number; totalPages: number } | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [trackingSession, setTrackingSession] = useState<LiveSession | null>(null);
  const [currentTrackedQuestion, setCurrentTrackedQuestion] = useState<RawQuestion | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [viewingResult, setViewingResult] = useState<ExamResult | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<RawQuestion[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchResults = useCallback(async (page = 1, mapels = activeResMapel, babs = activeResbab, subBabs = activeResSubBab, mode = activeModeFilter, pageSize = itemsPerPage) => {
    setLoading(true);
    try {
      const accessToken = await getAdminAccessToken();
      const filters: ResultFilters = {
        mapels: mapels.length > 0 ? mapels : undefined,
        babs: babs.length > 0 ? babs : undefined,
        subBabs: subBabs.length > 0 ? subBabs : undefined,
        mode: mode !== 'all' ? mode : undefined,
      };

      const result = await fetchResultsPaginatedAction(accessToken, filters, page, pageSize);

      setResults(result.results);
      setTotalResults(result.total);
      setResultPage(result.page);
      setPaginationMeta({ total: result.total, totalPages: result.totalPages });
      setStatsData(result.results.map(row => ({
        score: row.score,
        total_questions: row.total_questions,
        duration_seconds: row.duration_seconds
      })));
    } catch (err) {
      console.error('Error fetching results:', err);
      setResults([]);
      setTotalResults(0);
      setPaginationMeta({ total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [activeResMapel, activeResbab, activeResSubBab, activeModeFilter, itemsPerPage]);

  const handleResMapelChange = (mapels: string[]) => {
    setActiveResMapel(mapels);
    setActiveResbab([]);
    setActiveResSubBab([]);
    void fetchResults(1, mapels, [], [], activeModeFilter);
  };

  const handleResbabChange = (babs: string[]) => {
    setActiveResbab(babs);
    setActiveResSubBab([]);
    void fetchResults(1, activeResMapel, babs, [], activeModeFilter);
  };

  const handleResSubBabChange = (subBabs: string[]) => {
    setActiveResSubBab(subBabs);
    void fetchResults(1, activeResMapel, activeResbab, subBabs, activeModeFilter);
  };

  const handleModeFilterChange = (mode: string) => {
    setActiveModeFilter(mode);
    void fetchResults(1, activeResMapel, activeResbab, activeResSubBab, mode);
  };

  const handleItemsPerPageChange = (next: number) => {
    setItemsPerPage(next);
    void fetchResults(1, activeResMapel, activeResbab, activeResSubBab, activeModeFilter, next);
  };

  const handleLiveSessionPageChange = (page: number) => {
    setLiveSessionPage(page);
  };

  const handleLiveSessionItemsPerPageChange = (next: number) => {
    setLiveSessionItemsPerPage(next);
    setLiveSessionPage(1);
    const total = liveSessions.length;
    const totalPages = Math.max(1, Math.ceil(total / next));
    setLiveSessionPaginationMeta({ total, totalPages });
  };

  const handleFetchResultDetail = async (result: ExamResult) => {
    setDetailLoading(true);
    setDetailQuestions([]);

    try {
      // Fetch full result with user_answers from database
      const { data: fullResult, error } = await supabase
        .from('exam_results')
        .select('user_answers')
        .eq('id', result.id)
        .single();

      if (error) throw error;

      // Update viewingResult with user_answers
      setViewingResult({
        ...result,
        user_answers: fullResult?.user_answers || []
      });

      type AnswerRow = { question_id: number };
      const questionIds = (fullResult?.user_answers || []).map(
        (a: AnswerRow) => a.question_id
      );
      if (questionIds.length > 0) {
        const questions = await fetchQuestionsByIds(questionIds);
        setDetailQuestions(questions);
      }
    } catch (err) {
      console.error('Error fetching result details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchLiveSessions = async () => {
    setLiveLoading(true);
    try {
      const { data, error } = await supabase
        .from('exam_logs')
        .select('session_id, name, mapel, bab, sub_bab, mode, question_count, question_ids, current_index, user_answers, lives, start_time, is_finished, expires_at')
        .eq('is_finished', false)
        .gt('expires_at', new Date().toISOString())
        .order('start_time', { ascending: false });

      if (error) throw error;
      const allSessions = data || [];
      setLiveSessions(allSessions);

      const total = allSessions.length;
      const totalPages = Math.max(1, Math.ceil(total / liveSessionItemsPerPage));
      setLiveSessionPaginationMeta({ total, totalPages });

      if (liveSessionPage > totalPages) {
        setLiveSessionPage(totalPages);
      }
    } catch (err) {
      console.error('Error fetching live sessions:', err);
    } finally {
      setLiveLoading(false);
    }
  };

  const handleFetchLiveDetail = async (session: LiveSession) => {
    setTrackingSession(session);
    setIsTrackingModalOpen(true);
    setDetailLoading(true);

    try {
      const currentIndex = Math.max(0, Math.min(session.current_index, session.question_count - 1));
      const hasAnsweredCurrent = session.user_answers[currentIndex.toString()] !== undefined;
      const currentIdxToFetch = hasAnsweredCurrent && currentIndex + 1 < session.question_count
        ? currentIndex + 1
        : currentIndex;

      const currentQuestionId = session.question_ids[currentIdxToFetch] ?? null;

      if (currentQuestionId) {
        const [question] = await fetchQuestionsByIds([currentQuestionId]);
        setCurrentTrackedQuestion(question || null);
      } else {
        setCurrentTrackedQuestion(null);
      }

      const answeredIndices = Object.keys(session.user_answers).map(Number).sort((a, b) => a - b);
      const answeredIds = answeredIndices.map(idx => session.question_ids[idx]).filter(Boolean);

      if (answeredIds.length > 0) {
        const questions = await fetchQuestionsByIds(answeredIds);
        const orderedQuestions = answeredIds.map(id => questions.find(q => q.id === id)).filter(Boolean) as RawQuestion[];
        setDetailQuestions(orderedQuestions);
      } else {
        setDetailQuestions([]);
      }
    } catch (err) {
      console.error('Failed to fetch live tracking details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  return {
    results,
    loading,
    resultPage,
    totalResults,
    itemsPerPage,
    paginationMeta,
    statsData,
    activeResMapel,
    activeResbab,
    activeResSubBab,
    activeModeFilter,
    isLiveMode,
    liveSessions,
    liveLoading,
    liveSessionPage,
    liveSessionItemsPerPage,
    liveSessionPaginationMeta,
    trackingSession,
    currentTrackedQuestion,
    isTrackingModalOpen,
    viewingResult,
    detailQuestions,
    detailLoading,
    setIsLiveMode,
    setIsTrackingModalOpen,
    setViewingResult,
    fetchResults,
    fetchLiveSessions,
    handleItemsPerPageChange,
    handleLiveSessionPageChange,
    handleLiveSessionItemsPerPageChange,
    handleResMapelChange,
    handleResbabChange,
    handleResSubBabChange,
    handleModeFilterChange,
    handleFetchResultDetail,
    handleFetchLiveDetail,
  };
}
