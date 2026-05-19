"use server";

import { requireAdmin } from '@/lib/admin-server';

export type ResultFilters = {
  mapels?: string[];
  babs?: string[];
  subBabs?: string[];
  mode?: string;
};

export type PaginatedResultsResult = {
  results: Array<{
    id: number;
    name: string;
    score: number;
    total_questions: number;
    mapel: string;
    bab: string;
    sub_bab: string;
    taken_at: string;
    user_answers?: Array<{
      question_id: number;
      user_answer: string;
      is_correct: boolean;
    }>;
    duration_seconds?: number;
    start_time?: string;
    end_time?: string;
    mode?: string;
  }>;
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

function splitResultCategories(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function hasAnyResultCategory(value: string, selectedValues: string[]) {
  if (selectedValues.length === 0) return true;
  const categories = splitResultCategories(value);
  return selectedValues.some(selected => categories.includes(selected));
}

export async function fetchResultsPaginatedAction(
  accessToken: string,
  filters: ResultFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedResultsResult> {
  const { supabase } = await requireAdmin(accessToken);

  let query = supabase
    .from('exam_results')
    .select('id, name, score, total_questions, mapel, bab, sub_bab, taken_at, duration_seconds, start_time, end_time, mode', { count: 'exact' })
    .order('taken_at', { ascending: false });

  if (filters.mode && filters.mode !== 'all') {
    query = query.eq('mode', filters.mode);
  }

  const { data: allData, error: allError, count: totalCount } = await query;

  if (allError) {
    throw new Error(allError.message);
  }

  const filteredData = (allData || []).filter((row: typeof allData[0]) => {
    const mapelMatch = !filters.mapels || filters.mapels.length === 0 || hasAnyResultCategory(row.mapel || '', filters.mapels);
    const babMatch = !filters.babs || filters.babs.length === 0 || hasAnyResultCategory(row.bab || '', filters.babs);
    const subBabMatch = !filters.subBabs || filters.subBabs.length === 0 || hasAnyResultCategory(row.sub_bab || '', filters.subBabs);
    return mapelMatch && babMatch && subBabMatch;
  });

  const filteredTotal = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize;

  const paginatedData = filteredData.slice(from, to);

  return {
    results: paginatedData,
    total: filteredTotal,
    totalPages,
    page: safePage,
    pageSize,
  };
}
