"use client";

import { useCallback, useMemo } from 'react';
import { type RawQuestion, type BabInfo, type SubBabInfo } from '@/lib/questions';
import { categorySlugToLabel, normalizeCategorySlug } from '@/lib/categories';
import { stripHtml } from '@/lib/rich-text';

type UseAdminQuestionDerivedArgs = {
  allMapels: BabInfo[];
  allbabs: BabInfo[];
  allSubBabsAdmin: SubBabInfo[];
  hiddenMapels: string[];
  hiddenBabs: string[];
  hiddenSubBabs: string[];
  adminQuestions: RawQuestion[];
  activeMapelFilter: string[];
  activebabFilter: string[];
  activeSubBabFilter: string[];
  activeResMapel: string[];
  activeResbab: string[];
  questionTypeFilter: 'all' | 'multiple_choice' | 'short_answer';
  visibilityFilter: 'all' | 'visible' | 'hidden';
  searchQuery: string;
  sortOrder: 'asc' | 'desc';
};

export default function useAdminQuestionDerived({
  allMapels,
  allbabs,
  allSubBabsAdmin,
  hiddenMapels,
  hiddenBabs,
  hiddenSubBabs,
  adminQuestions,
  activeMapelFilter,
  activebabFilter,
  activeSubBabFilter,
  activeResMapel,
  activeResbab,
  questionTypeFilter,
  visibilityFilter,
  searchQuery,
  sortOrder,
}: UseAdminQuestionDerivedArgs) {
  const filteredMapelsForForm = useMemo(() => {
    return allMapels.filter(m => !hiddenMapels.includes(normalizeCategorySlug(m.value)));
  }, [allMapels, hiddenMapels]);

  const filteredBabsForForm = useMemo(() => {
    return allbabs.filter(b => !hiddenBabs.includes(normalizeCategorySlug(b.value)));
  }, [allbabs, hiddenBabs]);

  const filteredSubBabsForForm = useMemo(() => {
    return allSubBabsAdmin.filter(s => !hiddenSubBabs.includes(normalizeCategorySlug(s.value)));
  }, [allSubBabsAdmin, hiddenSubBabs]);

  const mapelTabs = useMemo(() => {
    const mapels = Array.from(new Set(adminQuestions.flatMap(q => q.mapels || []))).sort();
    return mapels.map(m => ({ label: categorySlugToLabel(m) || m.toUpperCase(), value: m }));
  }, [adminQuestions]);

  const buildBabTabs = useCallback((mapels: string[]) => {
    if (mapels.length === 0) return [];
    const list = adminQuestions.filter(q => q.mapels?.some(m => mapels.includes(m)));
    const babs = Array.from(new Set(list.flatMap(q => q.babs || []))).sort();
    return babs.map(b => ({ label: categorySlugToLabel(b) || b.toUpperCase(), value: b }));
  }, [adminQuestions]);

  const buildSubBabTabs = useCallback((mapels: string[], babs: string[]) => {
    if (babs.length === 0) return [];
    let list = adminQuestions.filter(q => q.babs?.some(b => babs.includes(b)));
    if (mapels.length > 0) {
      list = list.filter(q => q.mapels?.some(m => mapels.includes(m)));
    }
    const subBabs = Array.from(new Set(list.flatMap(q => q.sub_babs || []))).sort();
    return subBabs.map(sb => ({ label: categorySlugToLabel(sb) || sb.toUpperCase(), value: sb }));
  }, [adminQuestions]);

  const babTabs = useMemo(() => buildBabTabs(activeMapelFilter), [activeMapelFilter, buildBabTabs]);
  const subBabTabs = useMemo(() => buildSubBabTabs(activeMapelFilter, activebabFilter), [activeMapelFilter, activebabFilter, buildSubBabTabs]);
  const resBabTabs = useMemo(() => buildBabTabs(activeResMapel), [activeResMapel, buildBabTabs]);
  const resSubBabTabs = useMemo(() => buildSubBabTabs(activeResMapel, activeResbab), [activeResMapel, activeResbab, buildSubBabTabs]);

  const filteredQuestions = useMemo(() => {
    let list = adminQuestions;
    if (activeMapelFilter.length > 0) {
      list = list.filter(q => q.mapels?.some(m => activeMapelFilter.includes(m)));
    }
    if (activebabFilter.length > 0) {
      list = list.filter(q => q.babs?.some(b => activebabFilter.includes(b)));
    }
    if (activeSubBabFilter.length > 0) {
      list = list.filter(q => q.sub_babs?.some(sb => activeSubBabFilter.includes(sb)));
    }
    if (questionTypeFilter !== 'all') {
      list = list.filter(q => q.question_type === questionTypeFilter);
    }
    if (visibilityFilter !== 'all') {
      const shouldBeHidden = visibilityFilter === 'hidden';
      list = list.filter(q => Boolean(q.is_hidden) === shouldBeHidden);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(question => {
        const plainText = stripHtml(question.question_text).toLowerCase();
        return plainText.includes(q) ||
          question.id.toString().includes(q) ||
          question.mapels?.some(c => c.toLowerCase().includes(q)) ||
          question.babs?.some(c => c.toLowerCase().includes(q)) ||
          question.sub_babs?.some(c => c.toLowerCase().includes(q));
      });
    }

    list = [...list].sort((a, b) => {
      return sortOrder === 'asc' ? a.id - b.id : b.id - a.id;
    });

    return list;
  }, [activeMapelFilter, activebabFilter, activeSubBabFilter, visibilityFilter, questionTypeFilter, adminQuestions, searchQuery, sortOrder]);

  return {
    filteredMapelsForForm,
    filteredBabsForForm,
    filteredSubBabsForForm,
    mapelTabs,
    babTabs,
    subBabTabs,
    resBabTabs,
    resSubBabTabs,
    filteredQuestions,
  };
}
