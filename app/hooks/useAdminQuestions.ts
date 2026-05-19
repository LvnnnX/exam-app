"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify';
import { type RawQuestion, type BabInfo, type SubBabInfo, fetchQuestions, fetchBabsAdmin, fetchSubBabsAdmin } from '@/lib/questions';
import { ensureHtmlDocument, stripHtml } from '@/lib/rich-text';
import { createQuestionAction, deleteQuestionAction, updateQuestionAction, updateQuestionsVisibilityAction, fetchQuestionCountsByMapelAction, fetchQuestionsPaginatedAction, type MapelCount, type QuestionFilters, type PaginatedQuestionsResult } from '@/app/actions/admin/questions';
import { type ToastMessage } from '@/app/components/Toast';

type QuestionDraft = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_answer: string;
  question_type: 'multiple_choice' | 'short_answer';
  short_answer: string;
  is_hidden: boolean;
  mapels: string[];
  babs: string[];
  sub_babs: string[];
};

type UseAdminQuestionsArgs = {
  getAdminAccessToken: () => Promise<string>;
  loadAllBabsAdmin: () => Promise<void>;
  loadAllSubBabsAdmin: () => Promise<void>;
  allMapels: BabInfo[];
  setAllMapels: Dispatch<SetStateAction<BabInfo[]>>;
  allbabs: BabInfo[];
  setAllbabs: Dispatch<SetStateAction<BabInfo[]>>;
  allSubBabsAdmin: SubBabInfo[];
  setAllSubBabsAdmin: Dispatch<SetStateAction<SubBabInfo[]>>;
};

const EMPTY_DRAFT: QuestionDraft = {
  question_text: '<p></p>',
  option_a: '<p></p>',
  option_b: '<p></p>',
  option_c: '<p></p>',
  option_d: '<p></p>',
  option_e: '<p></p>',
  correct_answer: 'A',
  question_type: 'multiple_choice',
  short_answer: '',
  is_hidden: false,
  mapels: [],
  babs: [],
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

export default function useAdminQuestions({
  getAdminAccessToken,
  loadAllBabsAdmin,
  loadAllSubBabsAdmin,
  allMapels,
  setAllMapels,
  allbabs,
  setAllbabs,
  allSubBabsAdmin,
  setAllSubBabsAdmin,
}: UseAdminQuestionsArgs) {
  const [selectedQuestion, setSelectedQuestion] = useState<RawQuestion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<QuestionDraft>(EMPTY_DRAFT);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [adminQuestions, setAdminQuestions] = useState<RawQuestion[]>([]);
  const [activeMapelFilter, setActiveMapelFilter] = useState<string[]>([]);
  const [activebabFilter, setActivebabFilter] = useState<string[]>([]);
  const [activeSubBabFilter, setActiveSubBabFilter] = useState<string[]>([]);
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | 'multiple_choice' | 'short_answer'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchVisibilityModalOpen, setBatchVisibilityModalOpen] = useState(false);
  const [batchVisibilityTarget, setBatchVisibilityTarget] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState<RawQuestion | null>(null);
  const [newMapelInput, setNewMapelInput] = useState('');
  const [newSubBabInput, setNewSubBabInput] = useState('');
  const [newbabInput, setNewbabInput] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [paginationMeta, setPaginationMeta] = useState<{ total: number; totalPages: number } | null>(null);
  const [mapelCounts, setMapelCounts] = useState<MapelCount[]>([]);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'error') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fetchAdminQuestions = useCallback(async () => {
    setQuestionLoading(true);
    try {
      const questionRows = await fetchQuestions();
      setAdminQuestions(questionRows);
    } catch (err) {
      console.error('Error fetching questions:', err);
    } finally {
      setQuestionLoading(false);
    }
  }, []);

  const fetchQuestionsPaginated = useCallback(async (
    filters: QuestionFilters,
    page: number = 1,
    pageSize: number = 50
  ) => {
    setQuestionLoading(true);
    try {
      const accessToken = await getAdminAccessToken();
      const result = await fetchQuestionsPaginatedAction(accessToken, filters, page, pageSize);
      setAdminQuestions(result.questions);
      setPaginationMeta({ total: result.total, totalPages: result.totalPages });
    } catch (err) {
      console.error('Error fetching paginated questions:', err);
      showToast('Gagal memuat soal', 'error');
    } finally {
      setQuestionLoading(false);
    }
  }, [getAdminAccessToken, showToast]);

  const fetchMapelCounts = useCallback(async () => {
    try {
      const accessToken = await getAdminAccessToken();
      const counts = await fetchQuestionCountsByMapelAction(accessToken);
      setMapelCounts(counts);
    } catch (err) {
      console.error('Error fetching mapel counts:', err);
      showToast('Gagal memuat data MAPEL', 'error');
    }
  }, [getAdminAccessToken, showToast]);

  useEffect(() => {
    if (!isAdding && !isEditing) return;

    const syncBabs = async () => {
      if (formData.mapels.length === 0) {
        setAllbabs([]);
        return;
      }

      const promises = formData.mapels.map(m => fetchBabsAdmin(m));
      const results = await Promise.all(promises);
      const merged = results.flat();
      const unique = merged.filter((v, i, a) => a.findIndex(t => t.value === v.value) === i);
      setAllbabs(unique);
    };

    void syncBabs();
  }, [formData.mapels, isAdding, isEditing, setAllbabs]);

  useEffect(() => {
    if (!isAdding && !isEditing) return;

    const syncSubBabs = async () => {
      if (formData.babs.length === 0) {
        setAllSubBabsAdmin([]);
        return;
      }

      const filtered = await fetchSubBabsAdmin(formData.babs);
      setAllSubBabsAdmin(filtered);
    };

    void syncSubBabs();
  }, [formData.babs, isAdding, isEditing, setAllSubBabsAdmin]);

  const handleMapelFilterChange = (mapels: string[]) => {
    setActiveMapelFilter(mapels);
    setActivebabFilter([]);
    setActiveSubBabFilter([]);
    void fetchAdminQuestions();
  };

  const handleBabFilterChange = (babs: string[]) => {
    setActivebabFilter(babs);
    setActiveSubBabFilter([]);
    void fetchAdminQuestions();
  };

  const closeModal = () => {
    setSelectedQuestion(null);
    setIsEditing(false);
    setIsAdding(false);
    setFormData(EMPTY_DRAFT);
    void loadAllSubBabsAdmin();
  };

  const handleInputChange = (field: keyof QuestionDraft, value: string | string[] | boolean) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const buildQuestionPayload = () => {
    const questionType = formData.question_type || 'multiple_choice';
    const normalizedShortAnswer = stripHtml(String(formData.short_answer ?? '')).trim();
    const payload: Omit<RawQuestion, 'id'> = {
      question_text: sanitizeRichHtml(formData.question_text),
      option_a: sanitizeRichHtml(formData.option_a),
      option_b: sanitizeRichHtml(formData.option_b),
      option_c: sanitizeRichHtml(formData.option_c),
      option_d: sanitizeRichHtml(formData.option_d),
      option_e: sanitizeRichHtml(formData.option_e),
      correct_answer: questionType === 'short_answer' ? 'A' : formData.correct_answer.toUpperCase(),
      question_type: questionType,
      short_answer: questionType === 'short_answer' ? normalizedShortAnswer : '',
      is_hidden: formData.is_hidden,
      mapels: formData.mapels,
      babs: formData.babs,
      sub_babs: formData.sub_babs,
    };

    const hasMedia = (html: string) => /<(img|iframe)[^>]*>/i.test(html);

    if (questionType === 'multiple_choice') {
      const missingOptions = [
        payload.option_a,
        payload.option_b,
        payload.option_c,
        payload.option_d,
        payload.option_e,
      ].some((entry) => stripHtml(entry).length === 0 && !hasMedia(entry));

      if (missingOptions) {
        throw new Error('Please fill in all answer options before saving.');
      }
    } else if (!normalizedShortAnswer) {
      throw new Error('Please provide the short answer before saving.');
    }

    if (payload.mapels.length === 0 || payload.babs.length === 0 || payload.sub_babs.length === 0) {
      throw new Error('Please select at least one MAPEL, BAB, and Sub-bab for the question.');
    }

    return payload;
  };

  const handleSave = async () => {
    // Early validation for question_text
    const hasMedia = (html: string) => /<(img|iframe)[^>]*>/i.test(html);
    const missingQuestion = stripHtml(formData.question_text).length === 0 && !hasMedia(formData.question_text);

    if (missingQuestion) {
      showToast('Silakan isi teks pertanyaan sebelum menyimpan.', 'error');
      return;
    }

    setSavingQuestion(true);

    try {
      const payload = buildQuestionPayload();

      const accessToken = await getAdminAccessToken();
      if (isAdding) {
        await createQuestionAction(accessToken, payload);
      } else if (isEditing && selectedQuestion?.id) {
        await updateQuestionAction(accessToken, selectedQuestion.id, payload);
      }

      await fetchAdminQuestions();
      if (payload.mapels.length > 0) {
        setAllMapels(prev => {
          const next = new Map(prev.map(item => [item.value, item]));
          payload.mapels.forEach((value) => next.set(value, { value, label: value }));
          return Array.from(next.values()).sort((a, b) => a.label.localeCompare(b.label));
        });
      }
      await loadAllBabsAdmin();
      await loadAllSubBabsAdmin();
      closeModal();
    } catch (err) {
      console.error('Error saving question:', err);
      const message = err instanceof Error ? err.message : 'Failed to save question.';
      showToast(message, 'error');
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
      await deleteQuestionAction(await getAdminAccessToken(), deletingQuestion.id);

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

  const handleBatchVisibilityToggle = async (isHidden: boolean) => {
    if (selectedQuestionIds.length === 0) return;

    setBatchProcessing(true);
    try {
      await updateQuestionsVisibilityAction(await getAdminAccessToken(), selectedQuestionIds, isHidden);

      await fetchAdminQuestions();
      setSelectedQuestionIds([]);
    } catch (err) {
      console.error('Error batch updating visibility:', err);
      window.alert('Gagal mengubah visibilitas soal secara massal.');
    } finally {
      setBatchProcessing(false);
      setBatchVisibilityModalOpen(false);
    }
  };

  const startAddNew = (prefilledMapel?: string | null) => {
    setFormData({
      ...EMPTY_DRAFT,
      mapels: prefilledMapel ? [prefilledMapel] : []
    });
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
      question_type: question.question_type === 'short_answer' ? 'short_answer' : 'multiple_choice',
      short_answer: question.short_answer || '',
      is_hidden: Boolean(question.is_hidden),
      mapels: question.mapels || [],
      babs: question.babs || [],
      sub_babs: question.sub_babs || [],
    });
    setIsEditing(true);
    setIsAdding(false);
    setSelectedQuestion(question);
  };

  const onToggleQuestionVisibility = async (question: RawQuestion) => {
    const newHidden = !question.is_hidden;
    await updateQuestionsVisibilityAction(await getAdminAccessToken(), [question.id], newHidden);
    await fetchAdminQuestions();
  };

  const onViewQuestion = (question: RawQuestion) => {
    setSelectedQuestion(question);
    setIsEditing(false);
    setIsAdding(false);
  };

  const handleAddNewMapel = async () => {
    const value = newMapelInput.trim();
    if (!value) return;

    setAddingCategory(true);
    try {
      if (!formData.mapels.includes(value)) {
        handleInputChange('mapels', [...formData.mapels, value]);
      }

      if (!allMapels.some(c => c.value === value)) {
        setAllMapels(prev => [...prev, { value, label: value }]);
      }

      setNewMapelInput('');
    } finally {
      setAddingCategory(false);
    }
  };

  const handleAddNewbab = async () => {
    const value = newbabInput.trim();
    if (!value) return;

    setAddingCategory(true);
    try {
      if (!formData.babs.includes(value)) {
        handleInputChange('babs', [...formData.babs, value]);
      }

      if (!allbabs.some(c => c.value === value)) {
        setAllbabs(prev => [...prev, { value, label: value }]);
      }

      setNewbabInput('');
    } finally {
      setAddingCategory(false);
    }
  };

  const handleAddNewSubBab = async () => {
    const value = newSubBabInput.trim();
    if (!value) return;

    setAddingCategory(true);
    try {
      if (!formData.sub_babs.includes(value)) {
        handleInputChange('sub_babs', [...formData.sub_babs, value]);
      }

      if (!allSubBabsAdmin.some(c => c.value === value)) {
        setAllSubBabsAdmin(prev => [...prev, { value, label: value }]);
      }

      setNewSubBabInput('');
    } finally {
      setAddingCategory(false);
    }
  };

  return {
    selectedQuestion,
    isEditing,
    isAdding,
    formData,
    questionLoading,
    savingQuestion,
    adminQuestions,
    activeMapelFilter,
    activebabFilter,
    activeSubBabFilter,
    questionTypeFilter,
    visibilityFilter,
    sortOrder,
    searchQuery,
    selectedQuestionIds,
    batchProcessing,
    batchVisibilityModalOpen,
    batchVisibilityTarget,
    deletingQuestion,
    newMapelInput,
    newSubBabInput,
    newbabInput,
    addingCategory,
    paginationMeta,
    mapelCounts,
    setQuestionTypeFilter,
    setVisibilityFilter,
    setSearchQuery,
    setSortOrder,
    setSelectedQuestionIds,
    setBatchVisibilityModalOpen,
    setBatchVisibilityTarget,
    setDeletingQuestion,
    setNewMapelInput,
    setNewSubBabInput,
    setNewbabInput,
    setAddingCategory,
    setActiveSubBabFilter,
    fetchAdminQuestions,
    fetchQuestionsPaginated,
    fetchMapelCounts,
    handleMapelFilterChange,
    handleBabFilterChange,
    closeModal,
    handleInputChange,
    handleSave,
    confirmDelete,
    handleBatchVisibilityToggle,
    startAddNew,
    startEdit,
    onToggleQuestionVisibility,
    onViewQuestion,
    handleAddNewMapel,
    handleAddNewbab,
    handleAddNewSubBab,
    toasts,
    showToast,
    dismissToast,
  };
}
