"use client";

import React, { useMemo, useState, useEffect } from 'react';
import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify';
import RichContent from '@/app/components/RichContent';
import RichTextEditorField from '@/app/components/RichTextEditorField';
import { type RawQuestion, fetchQuestions, fetchQuestionsByIds, fetchCategories, type CategoryInfo } from '@/lib/questions';
import { ensureHtmlDocument, stripHtml } from '@/lib/rich-text';
import { supabase } from '@/lib/supabase';

type ExamResult = {
  id: number;
  name: string;
  score: number;
  total_questions: number;
  category: string;
  taken_at: string;
  user_answers: {
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
  category: string;
  mode: string;
  question_count: number;
  question_ids: number[];
  current_index: number;
  user_answers: Record<string, string>;
  lives: number;
  start_time: string;
};

type QuestionDraft = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_answer: string;
  categories: string[];
};

// Authentication is now strictly server-side via Supabase.
// Using a static email for the single admin account.
const ADMIN_EMAIL = 'admin@exam.local';
const AUTH_VERSION = '3'; // Increment this to force all admins to logout

const EMPTY_DRAFT: QuestionDraft = {
  question_text: '<p></p>',
  option_a: '<p></p>',
  option_b: '<p></p>',
  option_c: '<p></p>',
  option_d: '<p></p>',
  option_e: '<p></p>',
  correct_answer: 'A',
  categories: [],
};

const SANITIZE_OPTIONS: DomPurifyConfig = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'data-language', 'data-type', 'data-latex'],
};

function sanitizeRichHtml(value: string): string {
  return String(DOMPurify.sanitize(ensureHtmlDocument(value), SANITIZE_OPTIONS));
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [activeTab, setActiveTab] = useState<'questions' | 'results'>('questions');
  const [selectedQuestion, setSelectedQuestion] = useState<RawQuestion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<QuestionDraft>(EMPTY_DRAFT);

  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [adminQuestions, setAdminQuestions] = useState<RawQuestion[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination and detailed view state
  const [resultPage, setResultPage] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const ITEMS_PER_PAGE = 20;

  // New state for aggregate statistics across all records
  const [statsData, setStatsData] = useState<{ score: number; total_questions: number }[]>([]);

  const [viewingResult, setViewingResult] = useState<ExamResult | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<RawQuestion[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [allCategories, setAllCategories] = useState<CategoryInfo[]>([]);
  const [sessionInfo, setSessionInfo] = useState<string | null>(null);
  const [activeResCategory, setActiveResCategory] = useState<string>('all');
  const [deletingQuestion, setDeletingQuestion] = useState<RawQuestion | null>(null);
  const [activeModeFilter, setActiveModeFilter] = useState<string>('all');

  // Live Tracking state
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [trackingSession, setTrackingSession] = useState<LiveSession | null>(null);
  const [currentTrackedQuestion, setCurrentTrackedQuestion] = useState<RawQuestion | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();

      // Check auth version to force logout of old sessions
      const localAuthVersion = localStorage.getItem('admin_auth_version');

      if (session && localAuthVersion === AUTH_VERSION) {
        setIsAuthenticated(true);
        setSessionInfo(session.user.id);
        void fetchAdminQuestions();
        void loadAllCategories();
      } else if (session) {
        // If they have a session but wrong/missing version, log them out
        await supabase.auth.signOut();
        localStorage.removeItem('admin_auth_version');
      }
    }
    void checkSession();
  }, []);

  // Live User Polling: Refresh data every 2 minutes when in Live Mode
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isAuthenticated && isLiveMode) {
      interval = setInterval(() => {
        void fetchLiveSessions();
      }, 120000); // 2 minutes
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated, isLiveMode]);

  const questionsByCategory = useMemo(() => {
    return adminQuestions.reduce<Record<string, RawQuestion[]>>((accumulator, question) => {
      const keys = question.categories && question.categories.length > 0 ? question.categories : ['uncategorized'];
      keys.forEach(key => {
        if (!accumulator[key]) {
          accumulator[key] = [];
        }
        accumulator[key].push(question);
      });
      return accumulator;
    }, {});
  }, [adminQuestions]);

  const categoryTabs = useMemo(() => {
    // Collect all unique categories from the fetched data and sort them alphabetically
    // Exclude 'bonus' from the admin view as it's used for internal metrics
    const categoriesFromData = Object.keys(questionsByCategory)
      .filter(cat => cat !== 'bonus')
      .sort();
    return ['all', ...categoriesFromData];
  }, [questionsByCategory]);

  const filteredQuestions = useMemo(() => {
    let list = adminQuestions;
    if (activeCategoryFilter !== 'all') {
      list = questionsByCategory[activeCategoryFilter] || [];
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(question => {
        const plainText = stripHtml(question.question_text).toLowerCase();
        return plainText.includes(q) || question.categories?.some(c => c.toLowerCase().includes(q));
      });
    }
    return list;
  }, [activeCategoryFilter, adminQuestions, questionsByCategory, searchQuery]);

  const getCategoryLabel = (category: string) => {
    if (category === 'all') {
      return 'All Categories';
    }


    return category
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      // Authenticate securely via Supabase Auth (No more anonymous loopholes)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: passwordInput,
      });

      if (error) throw error;

      setIsAuthenticated(true);
      setSessionInfo(data.session?.user.id || 'admin');
      setPasswordError('');
      localStorage.setItem('admin_auth_version', AUTH_VERSION);

      if (activeTab === 'results') {
        void fetchResults();
      } else {
        void fetchAdminQuestions();
        void loadAllCategories();
      }
    } catch (err: any) {
      console.error('Auth failed:', err.message);
      setPasswordError('Invalid password or auth error.');
      setPasswordInput('');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout failed:', err);
    }
    setIsAuthenticated(false);
    setSessionInfo(null);
    localStorage.removeItem('admin_auth_version');
  };

  const loadAllCategories = async () => {
    try {
      const cats = await fetchCategories();
      setAllCategories(cats);
    } catch (err) {
      console.error('Failed to load category list:', err);
    }
  };

  const fetchResults = async (page = 0, category = activeResCategory, mode = activeModeFilter) => {
    setLoading(true);
    try {
      // 1. Fetch paginated data for the table
      const from = page * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let paginatedQuery = supabase
        .from('exam_results')
        .select('*', { count: 'exact' });

      if (category !== 'all') {
        paginatedQuery = paginatedQuery.eq('category', category);
      }
      if (mode !== 'all') {
        paginatedQuery = paginatedQuery.eq('mode', mode);
      }

      const { data, error, count } = await paginatedQuery
        .order('taken_at', { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      setResults(data || []);
      setTotalResults(count || 0);
      setResultPage(page);

      // 2. Fetch aggregate data for all matching records (Minimal columns for performance)
      let statsQuery = supabase
        .from('exam_results')
        .select('score, total_questions');

      if (category !== 'all') {
        statsQuery = statsQuery.eq('category', category);
      }
      if (mode !== 'all') {
        statsQuery = statsQuery.eq('mode', mode);
      }

      const { data: statRows, error: statError } = await statsQuery;
      if (statError) {
        throw statError;
      }

      setStatsData(statRows || []);
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResCategoryChange = (category: string) => {
    setActiveResCategory(category);
    void fetchResults(0, category, activeModeFilter);
  };

  const handleModeFilterChange = (mode: string) => {
    setActiveModeFilter(mode);
    void fetchResults(0, activeResCategory, mode);
  };

  const handleFetchResultDetail = async (result: ExamResult) => {
    setViewingResult(result);
    setDetailLoading(true);
    setDetailQuestions([]);

    try {
      // Extract unique question IDs from the user answers
      const questionIds = result.user_answers.map((a) => a.question_id);
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
        .select('*')
        .eq('is_finished', false)
        .gt('expires_at', new Date().toISOString())
        .order('start_time', { ascending: false });

      if (error) throw error;
      setLiveSessions(data || []);
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
      // Fetch only the specific question the user is currently answering
      const currentQuestionId = session.question_ids[session.current_index];
      if (currentQuestionId) {
        const [question] = await fetchQuestionsByIds([currentQuestionId]);
        setCurrentTrackedQuestion(question || null);
      } else {
        setCurrentTrackedQuestion(null);
      }

      // Also fetch all answered questions for the history list
      const answeredIds = session.question_ids.slice(0, session.current_index);
      if (answeredIds.length > 0) {
        const questions = await fetchQuestionsByIds(answeredIds);
        setDetailQuestions(questions);
      } else {
        setDetailQuestions([]);
      }
    } catch (err) {
      console.error('Failed to fetch live tracking details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchAdminQuestions = async () => {
    setQuestionLoading(true);
    try {
      const questionRows = await fetchQuestions();
      setAdminQuestions(questionRows);
    } catch (err) {
      console.error('Error fetching questions:', err);
      // Removed fallback pool. Error state can just be empty or handled visually.
    } finally {
      setQuestionLoading(false);
    }
  };

  const handleTabChange = (tab: 'questions' | 'results') => {
    setActiveTab(tab);

    if (!isAuthenticated) {
      return;
    }

    if (tab === 'results') {
      void fetchResults();
      return;
    }

    void fetchAdminQuestions();
  };

  const closeModal = () => {
    setSelectedQuestion(null);
    setIsEditing(false);
    setIsAdding(false);
    setFormData(EMPTY_DRAFT);
  };

  const handleInputChange = (field: keyof QuestionDraft, value: string | string[]) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const buildQuestionPayload = () => {
    const payload: Omit<RawQuestion, 'id'> = {
      question_text: sanitizeRichHtml(formData.question_text),
      option_a: sanitizeRichHtml(formData.option_a),
      option_b: sanitizeRichHtml(formData.option_b),
      option_c: sanitizeRichHtml(formData.option_c),
      option_d: sanitizeRichHtml(formData.option_d),
      option_e: sanitizeRichHtml(formData.option_e),
      correct_answer: formData.correct_answer.toUpperCase(),
      categories: formData.categories,
    };

    const hasMedia = (html: string) => /<(img|iframe)[^>]*>/i.test(html);

    const missingContent = [
      payload.question_text,
      payload.option_a,
      payload.option_b,
      payload.option_c,
      payload.option_d,
      payload.option_e,
    ].some((entry) => stripHtml(entry).length === 0 && !hasMedia(entry));

    if (missingContent) {
      throw new Error('Please fill in the question and all answer options before saving.');
    }

    if (payload.categories.length === 0) {
      throw new Error('Please select at least one category for the question.');
    }

    return payload;
  };

  const handleSave = async () => {
    setSavingQuestion(true);

    try {
      const payload = buildQuestionPayload();

      if (isAdding) {
        const { error } = await supabase.from('questions').insert([payload]);
        if (error) {
          console.error("Supabase Insert Error:", error);
          throw new Error(`Database Error: ${error.message} (Code: ${error.code})`);
        }
      } else if (isEditing && selectedQuestion?.id) {
        const { error } = await supabase
          .from('questions')
          .update(payload)
          .eq('id', selectedQuestion.id);

        if (error) {
          console.error("Supabase Update Error:", error);
          throw new Error(`Database Error: ${error.message} (Code: ${error.code})`);
        }
      }

      await fetchAdminQuestions();
      await loadAllCategories();
      closeModal();
    } catch (err) {
      console.error('Error saving question:', err);
      const message = err instanceof Error ? err.message : 'Failed to save question.';
      window.alert(message);
    } finally {
      setSavingQuestion(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingQuestion?.id) {
      setDeletingQuestion(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', deletingQuestion.id);

      if (error) {
        throw error;
      }

      await fetchAdminQuestions();
      if (selectedQuestion?.id === deletingQuestion.id) {
        closeModal();
      }
    } catch (err) {
      console.error('Error deleting question:', err);
    } finally {
      setDeletingQuestion(null);
    }
  };

  const startAddNew = () => {
    setFormData(EMPTY_DRAFT);
    setIsAdding(true);
    setIsEditing(false);
    setSelectedQuestion(null);
  };

  const startEdit = (question: RawQuestion) => {
    setFormData({
      question_text: ensureHtmlDocument(question.question_text),
      option_a: ensureHtmlDocument(question.option_a),
      option_b: ensureHtmlDocument(question.option_b),
      option_c: ensureHtmlDocument(question.option_c),
      option_d: ensureHtmlDocument(question.option_d),
      option_e: ensureHtmlDocument(question.option_e),
      correct_answer: question.correct_answer,
      categories: question.categories || [],
    });
    setIsEditing(true);
    setIsAdding(false);
    setSelectedQuestion(question);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Admin Login</h1>
          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Enter Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="Enter admin password"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {passwordError && <p className="text-red-500 text-sm mt-1">{passwordError}</p>}
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-600">Manage questions and view exam results</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          Logout
        </button>
      </header>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => handleTabChange('questions')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'questions' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
        >
          Questions
        </button>
        <button
          onClick={() => handleTabChange('results')}
          className={`px-4 py-2 rounded-lg ${activeTab === 'results' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
        >
          Results Dashboard
        </button>
      </div>

      {activeTab === 'questions' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <button
              onClick={startAddNew}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              + Add New Question
            </button>
            <button
              onClick={fetchAdminQuestions}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
            >
              Refresh Questions
            </button>
          </div>

          <div className="mb-5 max-w-xs">
            <label className="block text-xs font-black uppercase text-gray-400 tracking-widest mb-2">Filter Category</label>
            <select
              value={activeCategoryFilter}
              onChange={(e) => setActiveCategoryFilter(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.25em' }}
            >
              <option value="all">ALL CATEGORIES</option>
              {Object.keys(questionsByCategory).filter(c => c !== 'all').map((category) => (
                <option key={category} value={category}>
                  {getCategoryLabel(category).toUpperCase()} ({questionsByCategory[category]?.length ?? 0})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6 flex">
            <div className="relative w-full max-w-md">
              <input
                type="text"
                placeholder="Search questions by text or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {questionLoading ? (
            <div className="bg-white rounded-lg p-6 text-gray-500">Loading questions...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQuestions.length === 0 && (
                <div className="col-span-full bg-white rounded-lg p-6 border text-gray-500">
                  No questions found for {getCategoryLabel(activeCategoryFilter)}.
                </div>
              )}

              {filteredQuestions.map((question, index) => {
                const previewText = stripHtml(question.question_text);

                return (
                  <div key={question.id ?? index} className="border rounded-lg p-4 bg-white shadow-sm">
                    <div className="font-semibold text-gray-800 mb-2">
                      Q{index + 1}: {previewText.slice(0, 72)}{previewText.length > 72 ? '...' : ''}
                    </div>
                    <div className="text-sm text-gray-500 mb-1">Categories: {question.categories?.join(', ').replaceAll('_', ' ')}</div>
                    <div className="text-sm text-gray-500 mb-3">Correct: {question.correct_answer}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedQuestion(question);
                          setIsEditing(false);
                          setIsAdding(false);
                        }}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        View
                      </button>
                      <button
                        onClick={() => startEdit(question)}
                        className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingQuestion(question)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'results' && (
        <div>
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Exam Results</h2>
              <button
                onClick={() => isLiveMode ? fetchLiveSessions() : fetchResults(0)}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
              >
                Refresh
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Row 1: View Mode */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setIsLiveMode(true);
                    void fetchLiveSessions();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 ${isLiveMode
                    ? 'bg-nike-green border-nike-green text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-nike-green'
                    }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Live User
                </button>
                <button
                  onClick={() => setIsLiveMode(false)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 ${!isLiveMode
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400'
                    }`}
                >
                  📜 History
                </button>
              </div>

              {/* Row 2: Category selection */}
              <div className="flex flex-wrap gap-2">
                {categoryTabs.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleResCategoryChange(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${activeResCategory === cat
                      ? 'bg-gray-800 border-gray-800 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                  >
                    {getCategoryLabel(cat)}
                  </button>
                ))}
              </div>

              {/* Row 3: Mode selection */}
              <div className="flex flex-wrap gap-2">
                {['all', 'exam', 'survival'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleModeFilterChange(mode)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${activeModeFilter === mode
                      ? mode === 'survival' ? 'bg-red-600 border-red-600 text-white shadow-sm' : 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400'
                      }`}
                  >
                    {mode === 'all' ? 'All Modes' : mode === 'exam' ? '📝 Exam' : '⚔️ Survival'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!isLiveMode && statsData.length > 0 && (
            <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-bold text-indigo-600">{statsData.length}</div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Attempts</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(statsData.reduce((sum, row) => sum + row.score, 0) / statsData.length * 10) / 10}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Average Score</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-bold text-blue-600">
                  {statsData.reduce((sum, row) => sum + row.total_questions, 0)}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Questions Answered</div>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                <div className="text-2xl font-bold text-purple-600">
                  {statsData.length > 0 ? Math.round(statsData.filter((row) => (row.score / row.total_questions) >= 0.7).length / statsData.length * 100) : 0}%
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pass Rate (70%+)</div>
              </div>
            </div>
          )}

          {isLiveMode ? (
            liveLoading ? (
              <p>Fetching active sessions...</p>
            ) : liveSessions.length === 0 ? (
              <div className="bg-white rounded-lg p-6 text-center border">
                <p className="text-gray-500">No active users found. Real-time tracking is empty.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Answered</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lives</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started At</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {liveSessions
                        .filter(s => (activeResCategory === 'all' || s.category === activeResCategory) && (activeModeFilter === 'all' || s.mode === activeModeFilter))
                        .map((session) => {
                          const answeredCount = Object.keys(session.user_answers).length;
                          const progress = Math.round((answeredCount / session.question_count) * 100);

                          return (
                            <tr key={session.session_id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{session.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${session.mode === 'survival' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                  {session.mode === 'survival' ? '⚔️ Survival' : '📝 Exam'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className="capitalize">{session.category?.replaceAll('_', ' ')}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                                {session.mode === 'survival' ? answeredCount : `${answeredCount} / ${session.question_count}`}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {session.mode === 'survival' ? (
                                  <div className="flex gap-0.5">
                                    {Array.from({ length: Number(session.lives || 0) }).map((_, i) => (
                                      <span key={i} className="text-red-500">❤️</span>
                                    ))}
                                    {Array.from({ length: Math.max(0, 3 - Number(session.lives || 0)) }).map((_, i) => (
                                      <span key={i} className="text-gray-300">🖤</span>
                                    ))}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {session.mode === 'survival' ? (
                                  <span className="text-green-600 font-bold uppercase text-[10px] tracking-wider animate-pulse">On Going</span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-indigo-600 h-full transition-all" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-500">{progress}%</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(session.start_time).toLocaleTimeString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleFetchLiveDetail(session)}
                                  className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded"
                                >
                                  Track Live Progress
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : (
            loading ? (
              <p>Loading results...</p>
            ) : results.length === 0 ? (
              <div className="bg-white rounded-lg p-6 text-center">
                <p className="text-gray-500">No exam results yet. Users need to complete the exam first.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Percentage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Time</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {results.map((result) => (
                        <tr key={result.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{result.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${result.mode === 'survival' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                              {result.mode === 'survival' ? '⚔️ Survival' : '📝 Exam'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="capitalize">{result.category?.replaceAll('_', ' ')}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {result.score} / {result.total_questions}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded ${(result.score / result.total_questions) >= 0.7 ? 'bg-green-100 text-green-800' :
                              (result.score / result.total_questions) >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                              {Math.round((result.score / result.total_questions) * 100)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(result.taken_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {result.start_time ? new Date(result.start_time).toLocaleTimeString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {result.end_time ? new Date(result.end_time).toLocaleTimeString() : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {result.duration_seconds != null ? `${Math.floor(result.duration_seconds / 60)}m ${result.duration_seconds % 60}s` : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleFetchResultDetail(result)}
                              className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalResults > ITEMS_PER_PAGE && (
                  <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Showing <span className="font-medium">{resultPage * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min((resultPage + 1) * ITEMS_PER_PAGE, totalResults)}</span> of <span className="font-medium">{totalResults}</span> results
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchResults(resultPage - 1)}
                        disabled={resultPage === 0}
                        className="px-3 py-1 border rounded bg-white text-sm disabled:opacity-50 hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => fetchResults(resultPage + 1)}
                        disabled={(resultPage + 1) * ITEMS_PER_PAGE >= totalResults}
                        className="px-3 py-1 border rounded bg-white text-sm disabled:opacity-50 hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          )}


        </div>
      )}

      {(selectedQuestion || isAdding || isEditing) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[9999]" onClick={closeModal}>
          <div
            className="bg-white rounded-[20px] shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-xl font-bold">
                {isAdding ? 'Add New Question' : isEditing ? 'Edit Question' : 'Question Details'}
              </h2>
              <button
                onClick={closeModal}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-xl"
                title="Close"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/30">
              {(isAdding || isEditing) ? (
                <div className="space-y-6">
                  <RichTextEditorField
                    label="Question Text"
                    value={formData.question_text}
                    onChange={(value) => handleInputChange('question_text', value)}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <RichTextEditorField
                      label="Option A"
                      value={formData.option_a}
                      onChange={(value) => handleInputChange('option_a', value)}
                    />
                    <RichTextEditorField
                      label="Option B"
                      value={formData.option_b}
                      onChange={(value) => handleInputChange('option_b', value)}
                    />
                    <RichTextEditorField
                      label="Option C"
                      value={formData.option_c}
                      onChange={(value) => handleInputChange('option_c', value)}
                    />
                    <RichTextEditorField
                      label="Option D"
                      value={formData.option_d}
                      onChange={(value) => handleInputChange('option_d', value)}
                    />
                    <RichTextEditorField
                      label="Option E"
                      value={formData.option_e}
                      onChange={(value) => handleInputChange('option_e', value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Question Category</label>
                      <select
                        value={formData.categories?.[0] || 'none'}
                        onChange={(e) => handleInputChange('categories', e.target.value === 'none' ? [] : [e.target.value])}
                        className="w-full bg-white border border-gray-300 rounded-lg px-4 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.25em' }}
                      >
                        <option value="none">NONE / SELECT CATEGORY</option>
                        {allCategories.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700">Correct Answer</label>
                      <select
                        value={formData.correct_answer}
                        onChange={(event) => handleInputChange('correct_answer', event.target.value)}
                        className="w-full px-4 h-[48px] border-2 border-gray-200 rounded-lg focus:outline-none focus:border-nike-black transition-all font-medium appearance-none bg-white"
                      >
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                        <option value="C">Option C</option>
                        <option value="D">Option D</option>
                        <option value="E">Option E</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                selectedQuestion && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Question Prompt</h3>
                      <div className="p-4 sm:p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
                        <RichContent html={selectedQuestion.question_text} className="text-lg text-gray-900" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {(['a', 'b', 'c', 'd', 'e'] as const).map((label) => (
                        <div
                          key={label}
                          className={`p-4 rounded-xl border-2 transition-all ${selectedQuestion.correct_answer?.toLowerCase() === label
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-100 bg-white'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-inherit">
                            <span className="font-bold uppercase text-gray-400 text-sm">Option {label}</span>
                            {selectedQuestion.correct_answer?.toLowerCase() === label && (
                              <span className="bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Correct</span>
                            )}
                          </div>
                          <RichContent
                            html={(selectedQuestion as any)[`option_${label}`]}
                            className="text-gray-900 font-medium"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 bg-white rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Categories</p>
                        <p className="font-bold text-gray-900 capitalize">{selectedQuestion.categories?.join(', ').replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t bg-white flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0 z-10">
              <button
                onClick={closeModal}
                className="w-full sm:w-auto px-8 h-[48px] rounded-[24px] border border-gray-300 text-gray-700 font-bold uppercase text-xs tracking-widest hover:bg-gray-50 transition-colors"
              >
                {isAdding || isEditing ? 'Cancel' : 'Close Details'}
              </button>
              {(isAdding || isEditing) && (
                <button
                  onClick={handleSave}
                  disabled={savingQuestion}
                  className="w-full sm:w-auto px-10 h-[48px] rounded-[24px] bg-nike-black text-nike-white font-bold uppercase text-xs tracking-widest hover:bg-nike-grey-500 transition-colors disabled:opacity-50"
                >
                  {savingQuestion ? 'Syncing...' : (isAdding ? 'Create Question' : 'Save Changes')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Track Live Progress Modal */}
      {isTrackingModalOpen && trackingSession && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[10000]" onClick={() => setIsTrackingModalOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-nike-green/10 flex items-center justify-center">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Live Progress Tracking</h2>
                  <>
                    <span className="text-sm font-black uppercase tracking-widest">
                      {trackingSession.name}
                    </span>
                  </>
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest"> • {trackingSession.mode}</span>
                </div>
              </div>
              <button onClick={() => setIsTrackingModalOpen(false)} className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all">×</button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <div className="mb-10">
                <h3 className="text-xs font-black text-nike-green uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-nike-green animate-pulse"></span>
                  Currently Answering
                </h3>
                {detailLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-20 bg-gray-100 rounded-2xl w-full"></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-12 bg-gray-100 rounded-xl"></div>
                      <div className="h-12 bg-gray-100 rounded-xl"></div>
                    </div>
                  </div>
                ) : currentTrackedQuestion ? (
                  <div className="space-y-6">
                    <div className="p-6 bg-nike-grey-100 rounded-2xl border border-gray-200">
                      <RichContent html={currentTrackedQuestion.question_text} className="text-xl font-bold text-gray-900 leading-tight" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(['a', 'b', 'c', 'd', 'e'] as const).map((label) => (
                        <div key={label} className={`p-4 rounded-xl border-2 transition-all ${currentTrackedQuestion.correct_answer.toLowerCase() === label ? 'border-nike-green bg-green-50' : 'border-gray-100 bg-white'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black uppercase text-gray-400">Option {label}</span>
                            {currentTrackedQuestion.correct_answer.toLowerCase() === label && <span className="text-[10px] font-black uppercase text-nike-green">Correct Answer</span>}
                          </div>
                          <RichContent html={(currentTrackedQuestion as any)[`option_${label}`]} className="text-sm font-medium text-gray-800" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                    <p className="text-gray-400 font-bold uppercase text-sm tracking-widest">Awaiting Question Synchronisation...</p>
                  </div>
                )}
              </div>

              {/* Progress Stats */}
              <div className="grid grid-cols-3 gap-6 py-8 border-y border-gray-100">
                <div className="text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Index</p>
                  <p className="text-2xl font-black text-gray-900">{trackingSession.current_index + 1} <span className="text-sm text-gray-300">/ {trackingSession.question_count}</span></p>
                </div>
                <div className="text-center border-x border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Answered</p>
                  <p className="text-2xl font-black text-gray-900">{Object.keys(trackingSession.user_answers).length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Status</p>
                  <p className="text-2xl font-black text-nike-green animate-pulse">ACTIVE</p>
                </div>
              </div>

              {/* Session History */}
              <div className="mt-10 space-y-8">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-300"></span>
                  Session History
                </h3>

                {detailLoading ? (
                  <div className="text-center py-10 text-gray-400 font-bold uppercase text-xs tracking-widest">Loading history...</div>
                ) : detailQuestions.length === 0 ? (
                  <div className="text-center py-10 text-gray-300 font-bold uppercase text-[10px] tracking-widest border border-dashed rounded-2xl">No history yet</div>
                ) : (
                  <div className="space-y-6">
                    {trackingSession.question_ids.slice(0, trackingSession.current_index).map((qId, idx) => {
                      const question = detailQuestions.find(q => q.id === qId);
                      const userAnswerText = trackingSession.user_answers[idx.toString()];

                      if (!question) return null;

                      const correctOptionText = (question as any)[`option_${question.correct_answer.toLowerCase()}`];
                      const isCorrect = stripHtml(userAnswerText || '').trim() === stripHtml(correctOptionText || '').trim();
                      const isSkipped = userAnswerText === 'skipped' || !userAnswerText;

                      return (
                        <div key={qId} className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                          <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-white/50">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Question {idx + 1}</span>
                            {!isSkipped && (
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {isCorrect ? 'Correct' : 'Incorrect'}
                              </span>
                            )}
                            {isSkipped && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Skipped</span>}
                          </div>
                          <div className="p-5 space-y-4">
                            <RichContent html={question.question_text} className="text-sm font-bold text-gray-900" />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className={`p-3 rounded-xl border-2 ${isCorrect ? 'border-green-100 bg-green-50/30' : isSkipped ? 'border-gray-100 bg-white' : 'border-red-100 bg-red-50/30'}`}>
                                <p className="text-[9px] font-black text-gray-400 uppercase mb-1">User Answer</p>
                                <RichContent html={userAnswerText || 'No answer recorded'} className={`text-sm font-medium ${isCorrect ? 'text-green-800' : isSkipped ? 'text-gray-400 italic' : 'text-red-800'}`} />
                              </div>

                              {!isCorrect && !isSkipped && (
                                <div className="p-3 rounded-xl border-2 border-nike-green/20 bg-green-50/50">
                                  <p className="text-[9px] font-black text-nike-green uppercase mb-1">Correct Answer ({question.correct_answer})</p>
                                  <RichContent html={correctOptionText} className="text-sm font-medium text-nike-green" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 border-t flex justify-end">
              <button onClick={() => setIsTrackingModalOpen(false)} className="px-10 h-12 rounded-full bg-nike-black text-white font-black uppercase text-[10px] tracking-widest hover:bg-nike-grey-500 transition-all shadow-lg shadow-nike-black/20">Close Monitoring</button>
            </div>
          </div>
        </div>
      )}
      {/* Result Details Modal */}
      {viewingResult && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-[10000]" onClick={() => setViewingResult(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Exam Breakdown</h2>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                  <>
                    <span className="font-black text-nike-black">{viewingResult.name} </span>
                  </>
                  • {viewingResult.category} • {new Date(viewingResult.taken_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setViewingResult(null)} className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all">×</button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              {detailLoading ? (
                <div className="text-center py-20 text-gray-400 font-bold uppercase text-xs tracking-widest animate-pulse">Loading result history...</div>
              ) : (
                <div className="space-y-8">
                  {viewingResult.user_answers.map((answer, idx) => {
                    const question = detailQuestions.find(q => q.id === answer.question_id);
                    if (!question) return null;

                    const correctOptionText = (question as any)[`option_${question.correct_answer.toLowerCase()}`];

                    return (
                      <div key={idx} className="bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-white/50">
                          <span className="text-[10px] font-black uppercase">Question {idx + 1}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${answer.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {answer.is_correct ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>
                        <div className="p-5 space-y-4">
                          <RichContent html={question.question_text} className="text-sm font-bold text-gray-900" />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className={`p-3 rounded-xl border-2 ${answer.is_correct ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30'}`}>
                              <p className="text-[9px] font-black text-gray-400 uppercase mb-1">User Answer</p>
                              <RichContent html={answer.user_answer} className={`text-sm font-medium ${answer.is_correct ? 'text-green-800' : 'text-red-800'}`} />
                            </div>

                            {!answer.is_correct && (
                              <div className="p-3 rounded-xl border-2 border-nike-green/20 bg-green-50/50">
                                <p className="text-[9px] font-black text-nike-green uppercase mb-1">Correct Answer ({question.correct_answer})</p>
                                <RichContent html={correctOptionText} className="text-sm font-medium text-nike-green" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 border-t flex justify-between items-center">
              <div className="text-sm font-black uppercase tracking-tight text-gray-900">
                Final Score: <span className={viewingResult.score / viewingResult.total_questions >= 0.7 ? 'text-nike-green' : 'text-nike-red'}>{viewingResult.score} / {viewingResult.total_questions}</span>
              </div>
              <button onClick={() => setViewingResult(null)} className="px-10 h-12 rounded-full bg-nike-black text-white font-black uppercase text-[10px] tracking-widest hover:bg-nike-grey-500 transition-all shadow-lg shadow-nike-black/20">Close Details</button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deletingQuestion && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Question?</h3>
            <p className="text-sm text-gray-600 mb-1">This action cannot be undone.</p>
            <p className="text-sm text-gray-500 mb-6 truncate">
              &ldquo;{stripHtml(deletingQuestion.question_text).slice(0, 80)}&rdquo;
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingQuestion(null)}
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
