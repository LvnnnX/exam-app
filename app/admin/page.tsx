"use client";

import React, { useMemo, useState, useEffect } from 'react';
import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify';
import RichContent from '@/app/components/RichContent';
import RichTextEditorField from '@/app/components/RichTextEditorField';
import AdminQuizTab from '@/app/components/AdminQuizTab';
import { type RawQuestion, fetchQuestions, fetchQuestionsByIds, fetchHeadBabs, fetchAllSubBabsAdmin, fetchSubBabsForMultiple, fetchHiddenSubBabs, saveHiddenSubBabs, type HeadBabInfo, type SubBabInfo } from '@/lib/questions';
import { ensureHtmlDocument, stripHtml } from '@/lib/rich-text';
import { supabase } from '@/lib/supabase';

type ExamResult = {
  id: number;
  name: string;
  score: number;
  total_questions: number;
  head_bab: string;
  sub_bab: string;
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
  head_bab: string;
  sub_bab: string;
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
  head_babs: string[];
  sub_babs: string[];
};

const AUTH_VERSION = '3'; // Increment this to force all admins to logout

const EMPTY_DRAFT: QuestionDraft = {
  question_text: '<p></p>',
  option_a: '<p></p>',
  option_b: '<p></p>',
  option_c: '<p></p>',
  option_d: '<p></p>',
  option_e: '<p></p>',
  correct_answer: 'A',
  head_babs: [],
  sub_babs: [],
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const [activeTab, setActiveTab] = useState<'questions' | 'results' | 'settings' | 'quiz'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_active_tab');
      if (saved && ['questions', 'results', 'settings', 'quiz'].includes(saved)) return saved as any;
    }
    return 'questions';
  });

  useEffect(() => {
    localStorage.setItem('admin_active_tab', activeTab);
    
    // Trigger initial fetch for specific tabs
    if (activeTab === 'results') {
      void fetchResults();
      void loadHiddenSubBabs();
    } else if (activeTab === 'settings') {
      void loadAllSubBabsAdmin();
      void loadHiddenSubBabs();
    } else if (activeTab === 'quiz') {
      void loadAllSubBabsAdmin();
      void loadHiddenSubBabs();
    } else {
      void fetchAdminQuestions();
    }
  }, [activeTab]);

  useEffect(() => {
    // Auth Check
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const savedVersion = localStorage.getItem('admin_auth_version');
      
      if (session && savedVersion === AUTH_VERSION) {
        setIsAuthenticated(true);
      } else {
        // If they have a session but wrong/missing version, log them out
        await supabase.auth.signOut();
        localStorage.removeItem('admin_auth_version');
        setIsAuthenticated(false);
      }
    };
    void checkSession();
  }, []);

  const [selectedQuestion, setSelectedQuestion] = useState<RawQuestion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<QuestionDraft>(EMPTY_DRAFT);

  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [adminQuestions, setAdminQuestions] = useState<RawQuestion[]>([]);
  const [activeHeadBabFilter, setActiveHeadBabFilter] = useState<string>('all');
  const [activeSubBabFilter, setActiveSubBabFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Pagination and detailed view state
  const [resultPage, setResultPage] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const ITEMS_PER_PAGE = 20;

  // New state for aggregate statistics across all records
  const [statsData, setStatsData] = useState<{ score: number; total_questions: number }[]>([]);

  const [viewingResult, setViewingResult] = useState<ExamResult | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<RawQuestion[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [allHeadBabs, setAllHeadBabs] = useState<HeadBabInfo[]>([]);
  const [allSubBabsAdmin, setAllSubBabsAdmin] = useState<SubBabInfo[]>([]);
  const [sessionInfo, setSessionInfo] = useState<string | null>(null);
  const [activeResHeadBab, setActiveResHeadBab] = useState<string>('all');
  const [activeResSubBab, setActiveResSubBab] = useState<string>('all');
  const [deletingQuestion, setDeletingQuestion] = useState<RawQuestion | null>(null);
  const [activeModeFilter, setActiveModeFilter] = useState<string>('all');

  // Settings state
  const [hiddenSubBabs, setHiddenSubBabs] = useState<string[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);

  // Add-new-category inline state (used in question form)
  const [newSubBabInput, setNewSubBabInput] = useState('');
  const [newHeadBabInput, setNewHeadBabInput] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

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
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        setIsAuthenticated(false);
        return;
      }

      // Check auth version to force logout of old sessions
      const localAuthVersion = localStorage.getItem('admin_auth_version');

      if (localAuthVersion === AUTH_VERSION) {
        setIsAuthenticated(true);
        setSessionInfo(session.user.id);
        void fetchAdminQuestions();
        void loadAllHeadBabs();
        void loadHiddenSubBabs();
      } else {
        // If they have a session but wrong/missing version, log them out
        await supabase.auth.signOut();
        localStorage.removeItem('admin_auth_version');
        setIsAuthenticated(false);
      }
    }
    void checkSession();

    // Restore active tab
    const savedTab = localStorage.getItem('admin_active_tab') as any;
    if (savedTab && ['questions', 'results', 'settings', 'quiz'].includes(savedTab)) {
      setActiveTab(savedTab);
      // Trigger initial fetch for that tab
      if (savedTab === 'results') {
        void fetchResults();
        void loadHiddenSubBabs();
      } else if (savedTab === 'settings' || savedTab === 'quiz') {
        void loadAllSubBabsAdmin();
        void loadHiddenSubBabs();
      } else {
        void fetchAdminQuestions();
      }
    }
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

  // Filter sub_babs based on selected head_babs in Form
  useEffect(() => {
    if (!isAuthenticated || (!isAdding && !isEditing)) return;

    const syncSubBabs = async () => {
      if (formData.head_babs.length === 0) {
        // If no head_babs selected, show nothing or everything? 
        // User says "langsung load subbab dari head bab tersebut", implies filtered.
        // If empty, maybe show empty list.
        setAllSubBabsAdmin([]);
        return;
      }

      const filtered = await fetchSubBabsForMultiple(formData.head_babs);
      setAllSubBabsAdmin(filtered);
    };

    void syncSubBabs();
  }, [formData.head_babs, isAdding, isEditing, isAuthenticated]);

  const headBabTabs = useMemo(() => {
    const headBabs = Array.from(new Set(adminQuestions.flatMap(q => q.head_babs || []))).sort();
    return ['all', ...headBabs];
  }, [adminQuestions]);

  const subBabTabs = useMemo(() => {
    let list = adminQuestions;
    if (activeHeadBabFilter !== 'all') {
       list = adminQuestions.filter(q => q.head_babs?.includes(activeHeadBabFilter));
    }
    const subBabs = Array.from(new Set(list.flatMap(q => q.sub_babs || []))).sort();
    return ['all', ...subBabs];
  }, [adminQuestions, activeHeadBabFilter]);

  const filteredQuestions = useMemo(() => {
    let list = adminQuestions;
    if (activeHeadBabFilter !== 'all') {
      list = list.filter(q => q.head_babs?.includes(activeHeadBabFilter));
    }
    if (activeSubBabFilter !== 'all') {
      list = list.filter(q => q.sub_babs?.includes(activeSubBabFilter));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(question => {
        const plainText = stripHtml(question.question_text).toLowerCase();
        return plainText.includes(q) || question.head_babs?.some(c => c.toLowerCase().includes(q)) || question.sub_babs?.some(c => c.toLowerCase().includes(q));
      });
    }
    return list;
  }, [activeHeadBabFilter, activeSubBabFilter, adminQuestions, searchQuery]);

  const getCategoryLabel = (category: string) => {
    if (category === 'all') {
      return 'Semua';
    }

    return category
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (match) => match.toUpperCase());
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        localStorage.setItem('admin_auth_version', AUTH_VERSION);
        setIsAuthenticated(true);
        setSessionInfo(data.session.user.id);
        void fetchAdminQuestions();
        void loadAllHeadBabs();
        void loadAllSubBabsAdmin();
        void loadHiddenSubBabs();
      }
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const loadAllHeadBabs = async () => {
    try {
      const hbs = await fetchHeadBabs();
      setAllHeadBabs(hbs);
    } catch (err) {
      console.error('Failed to load head babs list:', err);
    }
  };

  const loadAllSubBabsAdmin = async () => {
    try {
      const sbs = await fetchAllSubBabsAdmin();
      setAllSubBabsAdmin(sbs);
    } catch (err) {
      console.error('Failed to load admin sub_bab list:', err);
    }
  };

  const fetchResults = async (page = 0, headBab = activeResHeadBab, subBab = activeResSubBab, mode = activeModeFilter) => {
    setLoading(true);
    try {
      // 1. Fetch paginated data for the table
      const from = page * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let paginatedQuery = supabase
        .from('exam_results')
        .select('*', { count: 'exact' });

      if (headBab !== 'all') {
        paginatedQuery = paginatedQuery.eq('head_bab', headBab);
      }
      if (subBab !== 'all') {
        paginatedQuery = paginatedQuery.eq('sub_bab', subBab);
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

      if (headBab !== 'all') {
        statsQuery = statsQuery.eq('head_bab', headBab);
      }
      if (subBab !== 'all') {
        statsQuery = statsQuery.eq('sub_bab', subBab);
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

  const handleResHeadBabChange = (headBab: string) => {
    setActiveResHeadBab(headBab);
    // When changing head bab, reset sub bab to all to avoid invalid combinations
    setActiveResSubBab('all');
    void fetchResults(0, headBab, 'all', activeModeFilter);
  };

  const handleResSubBabChange = (subBab: string) => {
    setActiveResSubBab(subBab);
    void fetchResults(0, activeResHeadBab, subBab, activeModeFilter);
  };

  const handleModeFilterChange = (mode: string) => {
    setActiveModeFilter(mode);
    void fetchResults(0, activeResHeadBab, activeResSubBab, mode);
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
      // Logic for "Currently Answering":
      // In Survival, question_ids is populated lazily.
      // The "active" question is the latest one in question_ids that isn't answered,
      // OR if all in question_ids are answered, it's the one at current_index + 1 (which might not exist yet).
      
      const lastQuestionIdx = session.question_ids.length - 1;
      const isLastAnswered = session.user_answers[lastQuestionIdx.toString()] !== undefined;
      
      let currentIdxToFetch = -1;
      if (lastQuestionIdx >= 0 && !isLastAnswered) {
        // User has fetched a question but not answered it yet
        currentIdxToFetch = lastQuestionIdx;
      } else if (session.current_index + 1 < session.question_count) {
        // User has answered everything they fetched, or hasn't started
        currentIdxToFetch = session.current_index + 1;
      }

      const currentQuestionId = currentIdxToFetch >= 0 ? session.question_ids[currentIdxToFetch] : null;
      
      if (currentQuestionId) {
        const [question] = await fetchQuestionsByIds([currentQuestionId]);
        setCurrentTrackedQuestion(question || null);
      } else {
        setCurrentTrackedQuestion(null);
      }

      // History = questions that have an entry in user_answers
      const answeredIndices = Object.keys(session.user_answers).map(Number).sort((a, b) => a - b);
      const answeredIds = answeredIndices.map(idx => session.question_ids[idx]).filter(Boolean);
      
      if (answeredIds.length > 0) {
        const questions = await fetchQuestionsByIds(answeredIds);
        // Map back to maintain order if fetch returns different order
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


  const loadHiddenSubBabs = async () => {
    setSettingsLoading(true);
    try {
      const hidden = await fetchHiddenSubBabs();
      setHiddenSubBabs(hidden);
      setSettingsDirty(false);
    } catch (err) {
      console.error('Failed to load hidden sub_babs:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await saveHiddenSubBabs(hiddenSubBabs);
      setSettingsDirty(false);
      window.alert('Settings saved. Changes will appear to users on next page load.');
    } catch (err) {
      console.error('Failed to save settings:', err);
      window.alert('Failed to save settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const toggleSubBabVisibility = (sb: string) => {
    setHiddenSubBabs(prev => {
      const next = prev.includes(sb) ? prev.filter(s => s !== sb) : [...prev, sb];
      setSettingsDirty(true);
      return next;
    });
  };

  /**
   * Creates a new head_bab slug on-the-fly and adds it to the current question draft.
   */
  const handleAddNewHeadBab = async () => {
    const raw = newHeadBabInput.trim();
    if (!raw) return;

    // Normalise: lowercase, replace spaces with underscores
    const slug = raw.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!slug) return;

    setAddingCategory(true);
    try {
      if (!formData.head_babs.includes(slug)) {
        handleInputChange('head_babs', [...formData.head_babs, slug]);
      }

      if (!allHeadBabs.some(c => c.value === slug)) {
        const label = slug
          .split('_')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        setAllHeadBabs(prev => [...prev, { value: slug, label }]);
      }

      setNewHeadBabInput('');
    } finally {
      setAddingCategory(false);
    }
  };

  /**
   * Creates a new sub_bab slug on-the-fly and adds it to the current question draft.
   */
  const handleAddNewSubBab = async () => {
    const raw = newSubBabInput.trim();
    if (!raw) return;

    // Normalise: lowercase, replace spaces with underscores
    const slug = raw.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!slug) return;

    setAddingCategory(true);
    try {
      if (!formData.sub_babs.includes(slug)) {
        handleInputChange('sub_babs', [...formData.sub_babs, slug]);
      }

      if (!allSubBabsAdmin.some(c => c.value === slug)) {
        const label = slug
          .split('_')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        setAllSubBabsAdmin(prev => [...prev, { value: slug, label }]);
      }

      setNewSubBabInput('');
    } finally {
      setAddingCategory(false);
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

   const handleTabChange = (tab: 'questions' | 'results' | 'settings' | 'quiz') => {
    setActiveTab(tab);
    localStorage.setItem('admin_active_tab', tab);

    if (!isAuthenticated) {
      return;
    }

    if (tab === 'results') {
      void fetchResults();
      void loadHiddenSubBabs();
      return;
    }

    if (tab === 'settings') {
      void loadAllHeadBabs();
      void loadAllSubBabsAdmin();
      void loadHiddenSubBabs();
      return;
    }

    void fetchAdminQuestions();
  };

  const closeModal = () => {
    setSelectedQuestion(null);
    setIsEditing(false);
    setIsAdding(false);
    setFormData(EMPTY_DRAFT);
    void loadAllSubBabsAdmin();
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
      head_babs: formData.head_babs,
      sub_babs: formData.sub_babs,
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

    if (payload.head_babs.length === 0 || payload.sub_babs.length === 0) {
      throw new Error('Please select at least one BAB and Sub-bab for the question.');
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
      await loadAllHeadBabs();
      await loadAllSubBabsAdmin();
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
      head_babs: question.head_babs || [],
      sub_babs: question.sub_babs || [],
    });
    setIsEditing(true);
    setIsAdding(false);
    setSelectedQuestion(question);
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-[#4A90D9] rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Verifying Admin Session...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-xl shadow-slate-200/50 border-2 border-slate-100 text-center">
            <div className="w-20 h-20 bg-[#FF9500]/10 text-[#FF9500] rounded-[24px] flex items-center justify-center mx-auto mb-8 text-3xl shadow-inner">
              🔒
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">Admin Login</h1>
            <p className="text-slate-400 text-sm mb-10 font-medium tracking-tight">Enter your credentials to access the panel.</p>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#4A90D9]/10 focus:border-[#4A90D9] transition-all placeholder:text-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#4A90D9]/10 focus:border-[#4A90D9] transition-all placeholder:text-slate-300"
                  required
                />
              </div>

              {authError && (
                <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl text-red-600 text-xs font-bold animate-shake">
                  ⚠️ {authError}
                </div>
              )}

              <button 
                type="submit"
                disabled={authLoading}
                style={{ background: '#4A90D9' }}
                className="w-full py-4 mt-4 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? 'Verifying...' : 'Sign In to Dashboard'}
              </button>

              <button 
                type="button"
                onClick={() => window.location.href = '/'}
                className="w-full py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors mt-2"
              >
                Return to Home
              </button>
            </form>
          </div>
          
          <p className="text-center mt-8 text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
            OSN SMANDAPURA • SECURE ADMIN ACCESS
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6 md:p-8">
      <header className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">Admin Panel</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Manage questions, results, and live quizzes</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 sm:px-5 sm:py-2.5 bg-white border-2 border-slate-200 text-slate-500 rounded-xl font-semibold text-xs sm:text-sm hover:border-[#FF3B30] hover:text-[#FF3B30] transition-all"
        >
          Logout
        </button>
      </header>

      <div className="grid grid-cols-2 sm:flex gap-2 mb-6 md:mb-8 border-b border-slate-100 pb-4">
        <button
          onClick={() => handleTabChange('questions')}
          style={activeTab === 'questions' ? {background: '#4A90D9'} : {}}
          className={`px-3 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all text-center ${activeTab === 'questions' ? 'text-white shadow-md shadow-blue-200' : 'bg-white text-slate-500 border border-slate-200 hover:border-[#4A90D9] hover:text-[#4A90D9]'}`}
        >
          📝 Questions
        </button>
        <button
          onClick={() => handleTabChange('results')}
          style={activeTab === 'results' ? {background: '#FF9500'} : {}}
          className={`px-3 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all text-center ${activeTab === 'results' ? 'text-white shadow-md shadow-orange-200' : 'bg-white text-slate-500 border border-slate-200 hover:border-[#FF9500] hover:text-[#FF9500]'}`}
        >
          📊 Results
        </button>
        <button
          onClick={() => handleTabChange('quiz')}
          style={activeTab === 'quiz' ? {background: '#34C759'} : {}}
          className={`px-3 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all text-center ${activeTab === 'quiz' ? 'text-white shadow-md shadow-green-200' : 'bg-white text-slate-500 border border-slate-200 hover:border-[#34C759] hover:text-[#34C759]'}`}
        >
          🎮 Quiz
        </button>
        <button
          onClick={() => handleTabChange('settings')}
          style={activeTab === 'settings' ? {background: '#64748B'} : {}}
          className={`sm:ml-auto px-3 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all text-center ${activeTab === 'settings' ? 'text-white shadow-md shadow-slate-200' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400 hover:text-slate-600'}`}
        >
          ⚙️ Settings
        </button>
      </div>

      {activeTab === 'questions' && (
        <div>
          <div className="mb-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <button
              onClick={startAddNew}
              style={{background: '#34C759'}}
              className="px-4 sm:px-5 py-2.5 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-md shadow-green-200 flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none">+</span> Add New Question
            </button>
            <button
              onClick={fetchAdminQuestions}
              className="px-4 sm:px-5 py-2.5 bg-white border-2 border-[#4A90D9]/20 text-[#4A90D9] rounded-xl font-semibold text-sm hover:bg-[#4A90D9]/5 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          <div className="mb-5 flex flex-col sm:flex-row gap-4 w-full sm:max-w-xl">
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase text-slate-400 tracking-widest mb-2">Filter BAB</label>
              <select
                value={activeHeadBabFilter}
                onChange={(e) => setActiveHeadBabFilter(e.target.value)}
                className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 h-11 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/20 focus:border-[#4A90D9] appearance-none cursor-pointer transition-colors"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.25em' }}
              >
                {headBabTabs.map((category) => (
                  <option key={category} value={category}>
                    {getCategoryLabel(category).toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase text-slate-400 tracking-widest mb-2">Filter Sub-bab</label>
              <select
                value={activeSubBabFilter}
                onChange={(e) => setActiveSubBabFilter(e.target.value)}
                className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 h-11 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/20 focus:border-[#4A90D9] appearance-none cursor-pointer transition-colors"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.25em' }}
              >
                {subBabTabs.map((category) => (
                  <option key={category} value={category}>
                    {getCategoryLabel(category).toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-6 flex">
            <div className="relative w-full max-w-md">
              <input
                type="text"
                placeholder="Search questions by text or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 pl-10 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/20 focus:border-[#4A90D9] transition-colors text-sm"
              />
              <svg
                className="absolute left-3 top-3 h-5 w-5 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {questionLoading ? (
            <div className="bg-white rounded-xl p-8 text-slate-400 text-center border-2 border-slate-100">Loading questions...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredQuestions.length === 0 && (
                <div className="col-span-full bg-white rounded-xl p-8 border-2 border-dashed border-slate-200 text-slate-400 text-center">
                  No questions found for the selected topics.
                </div>
              )}

              {filteredQuestions.map((question, index) => {
                const previewText = stripHtml(question.question_text);

                return (
                  <div key={question.id ?? index} className="border-2 border-slate-100 rounded-xl p-5 bg-white hover:border-[#4A90D9]/30 hover:shadow-md hover:shadow-blue-50 transition-all">
                    <div className="font-semibold text-slate-700 mb-2 text-sm leading-relaxed">
                      Q{index + 1}: {previewText.slice(0, 72)}{previewText.length > 72 ? '...' : ''}
                    </div>
                    <div className="text-xs text-slate-400 mb-1">BAB: {question.head_babs?.join(', ').replaceAll('_', ' ')}</div>
                    <div className="text-xs text-slate-400 mb-1">Sub-bab: {question.sub_babs?.join(', ').replaceAll('_', ' ')}</div>
                    <div className="text-xs text-slate-400 mb-4">Correct: <span className="font-bold text-[#34C759]">{question.correct_answer}</span></div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedQuestion(question);
                          setIsEditing(false);
                          setIsAdding(false);
                        }}
                        className="px-3 py-1.5 bg-[#4A90D9]/10 text-[#4A90D9] rounded-lg text-xs font-semibold hover:bg-[#4A90D9]/20 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => startEdit(question)}
                        className="px-3 py-1.5 bg-[#FF9500]/10 text-[#FF9500] rounded-lg text-xs font-semibold hover:bg-[#FF9500]/20 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingQuestion(question)}
                        className="px-3 py-1.5 bg-[#FF3B30]/10 text-[#FF3B30] rounded-lg text-xs font-semibold hover:bg-[#FF3B30]/20 transition-colors cursor-pointer"
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
              <h2 className="text-lg sm:text-xl font-bold text-slate-700">Exam Results</h2>
              <button
                onClick={() => isLiveMode ? fetchLiveSessions() : fetchResults(0)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-white border-2 border-[#FF9500]/20 text-[#FF9500] rounded-xl font-semibold text-xs sm:text-sm hover:bg-[#FF9500]/5 transition-colors"
              >
                ↻ Refresh
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
                  style={isLiveMode ? {background: '#34C759'} : {}}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all flex items-center gap-2 ${isLiveMode
                    ? 'text-white border-transparent shadow-md shadow-green-200'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-[#34C759] hover:text-[#34C759]'
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
                  style={!isLiveMode ? {background: '#FF9500'} : {}}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all flex items-center gap-2 ${!isLiveMode
                    ? 'text-white border-transparent shadow-md shadow-orange-200'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-[#FF9500] hover:text-[#FF9500]'
                    }`}
                >
                  📜 History
                </button>
              </div>

              {/* Row 2: Category selection — dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">BAB</label>
                  <select
                    value={activeResHeadBab}
                    onChange={(e) => handleResHeadBabChange(e.target.value)}
                    className="bg-white border-2 border-slate-200 rounded-xl px-3 h-10 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF9500]/20 focus:border-[#FF9500] appearance-none cursor-pointer pr-8 transition-colors"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.1em' }}
                  >
                    {headBabTabs.map((cat) => (
                      <option key={cat} value={cat}>
                        {getCategoryLabel(cat)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap sm:ml-2">Sub-bab</label>
                  <select
                    value={activeResSubBab}
                    onChange={(e) => handleResSubBabChange(e.target.value)}
                    className="bg-white border-2 border-slate-200 rounded-xl px-3 h-10 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF9500]/20 focus:border-[#FF9500] appearance-none cursor-pointer pr-8 transition-colors"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.1em' }}
                  >
                    {subBabTabs.map((cat) => (
                      <option key={cat} value={cat}>
                        {getCategoryLabel(cat)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Mode selection */}
              <div className="flex flex-wrap gap-2">
                {['all', 'exam', 'survival'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleModeFilterChange(mode)}
                    style={activeModeFilter === mode ? {background: mode === 'survival' ? '#FF3B30' : '#4A90D9'} : {}}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${activeModeFilter === mode
                      ? 'text-white border-transparent shadow-md ' + (mode === 'survival' ? 'shadow-red-200' : 'shadow-blue-200')
                      : 'bg-white border-slate-200 text-slate-500 hover:border-[#4A90D9] hover:text-[#4A90D9]'
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
              <div className="bg-white rounded-xl p-5 border-2 border-slate-100 hover:border-[#FF9500]/30 transition-colors">
                <div className="text-2xl font-bold" style={{color: '#FF9500'}}>{statsData.length}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Attempts</div>
              </div>
              <div className="bg-white rounded-xl p-5 border-2 border-slate-100 hover:border-[#34C759]/30 transition-colors">
                <div className="text-2xl font-bold" style={{color: '#34C759'}}>
                  {Math.round(statsData.reduce((sum, row) => sum + row.score, 0) / statsData.length * 10) / 10}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Average Score</div>
              </div>
              <div className="bg-white rounded-xl p-5 border-2 border-slate-100 hover:border-[#4A90D9]/30 transition-colors">
                <div className="text-2xl font-bold" style={{color: '#4A90D9'}}>
                  {statsData.reduce((sum, row) => sum + row.total_questions, 0)}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Questions Answered</div>
              </div>
              <div className="bg-white rounded-xl p-5 border-2 border-slate-100 hover:border-[#AF52DE]/30 transition-colors">
                <div className="text-2xl font-bold" style={{color: '#AF52DE'}}>
                  {statsData.length > 0 ? Math.round(statsData.filter((row) => (row.score / row.total_questions) >= 0.7).length / statsData.length * 100) : 0}%
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pass Rate (70%+)</div>
              </div>
            </div>
          )}

          {isLiveMode ? (
            liveLoading ? (
              <p className="text-slate-400 text-center py-8">Fetching active sessions...</p>
            ) : liveSessions.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border-2 border-dashed border-slate-200">
                <p className="text-slate-400">No active users found. Real-time tracking is empty.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-slate-100">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">User Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Mode</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Topik</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Answered</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Lives</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Progress</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started At</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {liveSessions
                        .filter(s => (activeResHeadBab === 'all' || s.head_bab === activeResHeadBab) && (activeResSubBab === 'all' || s.sub_bab === activeResSubBab) && (activeModeFilter === 'all' || s.mode === activeModeFilter))
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
                                <span className="capitalize">{session.head_bab?.replaceAll('_', ' ')}, {session.sub_bab?.replaceAll('_', ' ')}</span>
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                {new Date(session.start_time).toLocaleTimeString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => handleFetchLiveDetail(session)}
                                  className="text-[#4A90D9] hover:text-blue-800 bg-[#4A90D9]/10 px-3 py-1.5 rounded-lg text-xs font-semibold"
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
              <p className="text-slate-400 text-center py-8">Loading results...</p>
            ) : results.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border-2 border-dashed border-slate-200">
                <p className="text-slate-400">No exam results yet. Users need to complete the exam first.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-slate-100">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Mode</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Topik</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Score</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Percentage</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Start Time</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">End Time</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {results.map((result) => (
                        <tr key={result.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-700">{result.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${result.mode === 'survival' ? 'bg-[#FF3B30]/10 text-[#FF3B30]' : 'bg-[#4A90D9]/10 text-[#4A90D9]'}`}>
                              {result.mode === 'survival' ? '⚔️ Survival' : '📝 Exam'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="capitalize">{result.head_bab?.replaceAll('_', ' ')}, {result.sub_bab?.replaceAll('_', ' ')}</span>
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
                {totalResults > ITEMS_PER_PAGE && (() => {
                  const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE);
                  return (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                      <div className="flex-1 flex justify-between sm:hidden">
                        <button
                          onClick={() => fetchResults(resultPage - 1)}
                          disabled={resultPage === 0}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => fetchResults(resultPage + 1)}
                          disabled={resultPage + 1 >= totalPages}
                          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-700">
                            Showing <span className="font-medium">{resultPage * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min((resultPage + 1) * ITEMS_PER_PAGE, totalResults)}</span> of{' '}
                            <span className="font-medium">{totalResults}</span> results
                          </p>
                        </div>
                        <div>
                          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                            <button
                              onClick={() => fetchResults(resultPage - 1)}
                              disabled={resultPage === 0}
                              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <span className="sr-only">Previous</span>
                              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            {[...Array(totalPages)].map((_, i) => (
                              <button
                                key={i}
                                onClick={() => fetchResults(i)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  resultPage === i
                                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                {i + 1}
                              </button>
                            ))}
                            <button
                              onClick={() => fetchResults(resultPage + 1)}
                              disabled={resultPage + 1 >= totalPages}
                              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <span className="sr-only">Next</span>
                              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )
          )}


        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">Sub-bab Visibility</h2>
              <p className="text-sm text-gray-500 mt-1">
                Hidden sub-babs are removed from the user-facing exam frontend. Admin panel is unaffected.
              </p>
            </div>

            {settingsLoading ? (
              <div className="p-6 text-gray-400 text-sm animate-pulse">Loading settings...</div>
            ) : (
              <div className="p-6 space-y-3">
                {allSubBabsAdmin.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No sub-babs found. Add questions first.</p>
                )}
                {allSubBabsAdmin.map((cat) => {
                  const isHidden = hiddenSubBabs.includes(cat.value);
                  return (
                    <div key={cat.value} className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                      <div>
                        <p className="font-semibold text-gray-800 capitalize">{cat.label}</p>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">{cat.value}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold uppercase ${
                          isHidden ? 'text-gray-400' : 'text-indigo-600'
                        }`}>
                          {isHidden ? 'Hidden' : 'Visible'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSubBabVisibility(cat.value)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            isHidden ? 'bg-gray-300' : 'bg-indigo-600'
                          }`}
                          title={isHidden ? 'Hidden from users — click to show' : 'Visible to users — click to hide'}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              isHidden ? 'translate-x-1' : 'translate-x-6'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
              {settingsDirty && (
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">● Unsaved changes</span>
              )}
              {!settingsDirty && <span />}
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={settingsSaving || !settingsDirty}
                className="px-6 h-10 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settingsSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(selectedQuestion || isAdding || isEditing) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-[9999]">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:col-span-2">
                      {/* Bab (Multi Select) */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-tight">
                          Bab
                          <span className="ml-2 text-[10px] font-normal text-gray-400 capitalize">(Multi-select)</span>
                        </label>
                        <div className="relative group">
                          <div className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 min-h-[48px] text-sm flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all max-h-[120px] overflow-y-auto">
                            {formData.head_babs.length === 0 ? (
                              <span className="text-gray-400 py-1.5">Pilih Bab...</span>
                            ) : (
                              formData.head_babs.map(val => {
                                const info = allHeadBabs.find(h => h.value === val);
                                return (
                                  <span key={val} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-100">
                                    {info?.label || val}
                                    <button 
                                      type="button"
                                      onClick={() => handleInputChange('head_babs', formData.head_babs.filter(v => v !== val))}
                                      className="hover:text-indigo-900 ml-1"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })
                            )}
                          </div>
                          
                          {/* Dropdown list for Bab multi-select */}
                          <div className="mt-2 p-2 border border-gray-100 bg-gray-50 rounded-xl grid grid-cols-1 gap-1 max-h-[160px] overflow-y-auto shadow-inner">
                            {allHeadBabs.length === 0 ? (
                              <p className="text-xs text-gray-400 italic p-2 text-center">Loading Bab...</p>
                            ) : (
                              allHeadBabs.map((cat) => {
                                const isSelected = formData.head_babs.includes(cat.value);
                                return (
                                  <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => {
                                      const next = isSelected
                                        ? formData.head_babs.filter((c) => c !== cat.value)
                                        : [...formData.head_babs, cat.value];
                                      handleInputChange('head_babs', next);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-between ${
                                      isSelected
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
                                    }`}
                                  >
                                    <span>{cat.label}</span>
                                    {isSelected && <span>✓</span>}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                        
                        {/* Add New Bab inline */}
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={newHeadBabInput}
                            onChange={(e) => setNewHeadBabInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddNewHeadBab(); } }}
                            placeholder="Add new bab..."
                            className="flex-1 px-3 h-8 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                          <button
                            type="button"
                            onClick={() => void handleAddNewHeadBab()}
                            disabled={addingCategory || !newHeadBabInput.trim()}
                            className="px-3 h-8 rounded-lg bg-green-50 text-green-700 text-[10px] font-bold uppercase hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            + New
                          </button>
                        </div>
                      </div>

                      {/* Sub-bab (Multi Select) */}
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700 uppercase tracking-tight">
                          Sub-bab
                          <span className="ml-2 text-[10px] font-normal text-gray-400 capitalize">(Multi-select)</span>
                        </label>
                        <div className="relative group">
                          <div className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 min-h-[48px] text-sm flex flex-wrap gap-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all max-h-[120px] overflow-y-auto">
                            {formData.sub_babs.length === 0 ? (
                              <span className="text-gray-400 py-1.5">Pilih Sub-bab...</span>
                            ) : (
                              formData.sub_babs.map(val => {
                                const info = allSubBabsAdmin.find(s => s.value === val);
                                return (
                                  <span key={val} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-100">
                                    {info?.label || val}
                                    <button 
                                      type="button"
                                      onClick={() => handleInputChange('sub_babs', formData.sub_babs.filter(v => v !== val))}
                                      className="hover:text-indigo-900 ml-1"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })
                            )}
                          </div>
                          
                          {/* Dropdown list for multi-select */}
                          <div className="mt-2 p-2 border border-gray-100 bg-gray-50 rounded-xl grid grid-cols-1 gap-1 max-h-[160px] overflow-y-auto shadow-inner">
                            {allSubBabsAdmin.length === 0 ? (
                              <p className="text-xs text-gray-400 italic p-2 text-center">Pilih Bab dulu untuk melihat Sub-bab</p>
                            ) : (
                              allSubBabsAdmin.map((cat) => {
                                const isSelected = formData.sub_babs.includes(cat.value);
                                return (
                                  <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => {
                                      const next = isSelected
                                        ? formData.sub_babs.filter((c) => c !== cat.value)
                                        : [...formData.sub_babs, cat.value];
                                      handleInputChange('sub_babs', next);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-between ${
                                      isSelected
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
                                    }`}
                                  >
                                    <span>{cat.label}</span>
                                    {isSelected && <span>✓</span>}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Add New Sub-bab inline - only if Bab is selected */}
                        {formData.head_babs.length > 0 && (
                          <div className="flex gap-2 pt-1">
                            <input
                              type="text"
                              value={newSubBabInput}
                              onChange={(e) => setNewSubBabInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddNewSubBab(); } }}
                              placeholder="Add new sub-bab..."
                              className="flex-1 px-3 h-8 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                            <button
                              type="button"
                              onClick={() => void handleAddNewSubBab()}
                              disabled={addingCategory || !newSubBabInput.trim()}
                              className="px-3 h-8 rounded-lg bg-green-50 text-green-700 text-[10px] font-bold uppercase hover:bg-green-100 transition-colors disabled:opacity-50"
                            >
                              + New
                            </button>
                          </div>
                        )}
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
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Topik</p>
                        <p className="font-bold text-gray-900 capitalize">
                          {selectedQuestion.head_babs?.join(', ').replace(/_/g, ' ')} — {selectedQuestion.sub_babs?.join(', ').replace(/_/g, ' ')}
                        </p>
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
                  <p className="text-2xl font-black text-gray-900">
                    {(() => {
                      const lastIdx = trackingSession.question_ids.length - 1;
                      const isLastAns = trackingSession.user_answers[lastIdx.toString()] !== undefined;
                      const activeIdx = (lastIdx >= 0 && !isLastAns) ? lastIdx : trackingSession.current_index + 1;
                      return Math.min(activeIdx + 1, trackingSession.question_count);
                    })()}
                    <span className="text-sm text-gray-300"> / {trackingSession.question_count}</span>
                  </p>
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
                    {trackingSession.question_ids.slice(0, trackingSession.current_index + 1).map((qId, idx) => {
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
                  • {viewingResult.head_bab}, {viewingResult.sub_bab} • {new Date(viewingResult.taken_at).toLocaleDateString()}
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

      {activeTab === 'quiz' && (
        <AdminQuizTab headBabs={allHeadBabs.map((hb) => hb.value)} subBabs={allSubBabsAdmin.filter(c => !hiddenSubBabs.includes(c.value))} />
      )}
    </div>
  );
}
