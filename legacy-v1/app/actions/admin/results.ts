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

const MAX_PAGE_SIZE = 200;

function escapeLikeTerm(value: string): string {
  // Reject characters that would break PostgREST `or` syntax or expand the
  // ILIKE pattern beyond a literal substring match.
  return value.replace(/[,()*%\\]/g, ' ').trim();
}

function buildCategoryOrFilter(column: string, values: string[]): string | null {
  const cleaned = values
    .map(escapeLikeTerm)
    .filter((value) => value.length > 0 && value.length <= 120)
    .slice(0, 25);
  if (cleaned.length === 0) return null;
  return cleaned.map((value) => `${column}.ilike.%${value}%`).join(',');
}

export async function fetchResultsPaginatedAction(
  accessToken: string,
  filters: ResultFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedResultsResult> {
  const { supabase } = await requireAdmin(accessToken);

  const safePageSize = Math.min(Math.max(1, Math.floor(pageSize)), MAX_PAGE_SIZE);
  const safePage = Math.max(1, Math.floor(page));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from('exam_results')
    .select(
      'id, name, score, total_questions, mapel, bab, sub_bab, taken_at, duration_seconds, start_time, end_time, mode',
      { count: 'exact' }
    )
    .order('taken_at', { ascending: false });

  if (filters.mode && filters.mode !== 'all') {
    query = query.eq('mode', filters.mode);
  }

  const mapelOr = buildCategoryOrFilter('mapel', filters.mapels || []);
  if (mapelOr) query = query.or(mapelOr);

  const babOr = buildCategoryOrFilter('bab', filters.babs || []);
  if (babOr) query = query.or(babOr);

  const subBabOr = buildCategoryOrFilter('sub_bab', filters.subBabs || []);
  if (subBabOr) query = query.or(subBabOr);

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));

  return {
    results: data ?? [],
    total,
    totalPages,
    page: Math.min(safePage, totalPages),
    pageSize: safePageSize,
  };
}
