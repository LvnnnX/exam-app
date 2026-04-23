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

const ADMIN_PIN = '123456'; //gonna be in env

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
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

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

  // Check for existing session on mount
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
        setSessionInfo(session.user.id);
        void fetchAdminQuestions();
        void loadAllCategories();
      }
    }
    void checkSession();
  }, []);

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
    const categoriesFromData = Object.keys(questionsByCategory).sort();
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

  const handlePinSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pinInput === ADMIN_PIN) {
      try {
        // Authenticate with Supabase to get a valid JWT for RLS
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;

        setIsAuthenticated(true);
        setSessionInfo(data.session?.user.id || 'anonymous');
        setPinError('');

        if (activeTab === 'results') {
          void fetchResults();
        } else {
          void fetchAdminQuestions();
          void loadAllCategories();
        }
      } catch (err: any) {
        console.error('Auth failed:', err.message);
        setPinError(`Auth Failed: ${err.message}`);
      }
      return;
    }

    setPinError('Invalid PIN');
    setPinInput('');
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

    const missingContent = [
      payload.question_text,
      payload.option_a,
      payload.option_b,
      payload.option_c,
      payload.option_d,
      payload.option_e,
    ].some((entry) => stripHtml(entry).length === 0);

    if (missingContent) {
      throw new Error('Please fill in the question and all answer options before saving.');
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
          <form onSubmit={handlePinSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Enter PIN</label>
              <input
                type="password"
                value={pinInput}
                onChange={(event) => setPinInput(event.target.value)}
                placeholder="Enter your PIN"
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                maxLength={6}
              />
              {pinError && <p className="text-red-500 text-sm mt-1">{pinError}</p>}
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
          onClick={() => setIsAuthenticated(false)}
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

          <div className="mb-5 flex flex-wrap gap-2">
            {categoryTabs.map((category) => {
              const isActive = activeCategoryFilter === category;
              const count = category === 'all'
                ? adminQuestions.length
                : (questionsByCategory[category]?.length ?? 0);

              return (
                <button
                  key={category}
                  onClick={() => setActiveCategoryFilter(category)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm transition-colors ${isActive
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400 hover:text-indigo-700'
                    }`}
                >
                  <span>{getCategoryLabel(category)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
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
                onClick={() => fetchResults(0)}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
              >
                Refresh
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {categoryTabs.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleResCategoryChange(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${activeResCategory === cat
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400'
                    }`}
                >
                  {getCategoryLabel(cat)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {['all', 'exam', 'survival'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeFilterChange(mode)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${activeModeFilter === mode
                    ? mode === 'survival' ? 'bg-red-600 border-red-600 text-white shadow-sm' : 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400'
                    }`}
                >
                  {mode === 'all' ? 'All Modes' : mode === 'exam' ? '📝 Exam' : '⚔️ Survival'}
                </button>
              ))}
            </div>
          </div>

          {statsData.length > 0 && (
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


          {loading ? (
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
                      <label className="block text-sm font-medium text-gray-700">Question Categories</label>
                      <div className="border border-gray-200 rounded-lg p-3 max-h-[150px] overflow-y-auto bg-white space-y-2">
                        {allCategories.map((cat) => (
                          <label key={cat.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.categories?.includes(cat.value)}
                              onChange={(e) => {
                                const newCats = e.target.checked
                                  ? [...(formData.categories || []), cat.value]
                                  : (formData.categories || []).filter(c => c !== cat.value);
                                handleInputChange('categories', newCats);
                              }}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {cat.label}
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="new-category-input"
                          placeholder="Type new category..."
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-nike-black"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim().toLowerCase().replace(/\s+/g, '_');
                              if (val && !(formData.categories || []).includes(val)) {
                                handleInputChange('categories', [...(formData.categories || []), val]);
                                if (!allCategories.some(c => c.value === val)) {
                                  const label = val.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                  setAllCategories(prev => [...prev, { value: val, label }]);
                                }
                                e.currentTarget.value = '';
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            const input = document.getElementById('new-category-input') as HTMLInputElement;
                            if (input) {
                              const val = input.value.trim().toLowerCase().replace(/\s+/g, '_');
                              if (val && !(formData.categories || []).includes(val)) {
                                handleInputChange('categories', [...(formData.categories || []), val]);
                                if (!allCategories.some(c => c.value === val)) {
                                  const label = val.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                  setAllCategories(prev => [...prev, { value: val, label }]);
                                }
                                input.value = '';
                              }
                            }
                          }}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200"
                        >
                          Add
                        </button>
                      </div>
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
                          className={`p-4 rounded-xl border-2 transition-all ${selectedQuestion.correct_answer.toLowerCase() === label
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-100 bg-white'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-inherit">
                            <span className="font-bold uppercase text-gray-400 text-sm">Option {label}</span>
                            {selectedQuestion.correct_answer.toLowerCase() === label && (
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
                        <p className="font-bold text-gray-900 capitalize">{selectedQuestion.categories?.join(', ').replaceAll('_', ' ')}</p>
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

      {/* Result Details Modal */}
      {viewingResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">Exam Breakdown: {viewingResult.name}</h2>
                <p className="text-sm text-gray-500">{new Date(viewingResult.taken_at).toLocaleString()} • {viewingResult.category}</p>
              </div>
              <button
                onClick={() => setViewingResult(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              {detailLoading ? (
                <div className="py-12 text-center text-gray-500">Loading full session data...</div>
              ) : (
                <div className="space-y-6">
                  {viewingResult.user_answers.map((answer, idx) => {
                    const question = detailQuestions.find(q => q.id === answer.question_id);

                    return (
                      <div key={idx} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                          <span className="font-bold text-gray-700">Question {idx + 1}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${answer.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {answer.is_correct ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>
                        <div className="p-4 space-y-4">
                          {question ? (
                            <>
                              <RichContent html={question.question_text} className="font-medium text-gray-900" />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                <div className={`p-3 rounded-lg border ${answer.is_correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                  <p className="text-xs font-bold text-gray-500 uppercase mb-1">User Selected {['A', 'B', 'C', 'D', 'E'].includes(answer.user_answer) ? `(${answer.user_answer})` : ''}</p>
                                  {answer.user_answer === 'skipped' ? (
                                    <p className="text-sm font-medium text-gray-500 italic">Skipped</p>
                                  ) : (
                                    <RichContent
                                      html={['A', 'B', 'C', 'D', 'E'].includes(answer.user_answer) ? (question[`option_${answer.user_answer.toLowerCase()}` as keyof RawQuestion] as string || answer.user_answer) : answer.user_answer}
                                      className="text-gray-900 font-medium"
                                    />
                                  )}
                                </div>
                                {!answer.is_correct && (
                                  <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Correct Answer ({question.correct_answer})</p>
                                    <RichContent
                                      html={question[`option_${question.correct_answer.toLowerCase()}` as keyof RawQuestion] as string}
                                      className="text-gray-900 font-medium"
                                    />
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <p className="text-gray-400 italic">Question data no longer available in database.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-between items-center bg-white rounded-b-xl">
              <div className="text-sm font-bold text-gray-700 uppercase">
                Final Score: <span className={viewingResult.score / viewingResult.total_questions >= 0.7 ? 'text-green-600' : 'text-red-600'}>{viewingResult.score} / {viewingResult.total_questions}</span>
              </div>
              <button
                onClick={() => setViewingResult(null)}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
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
