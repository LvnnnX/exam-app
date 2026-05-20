"use server";

import { type RawQuestion } from '@/lib/questions';
import { assertQuestionDeleteAllowed, hasPermission, requireAdmin, requirePermission } from '@/lib/admin-server';
import { isSafeCategorySlug, normalizeCategorySlug } from '@/lib/categories';

type QuestionPayload = Omit<RawQuestion, 'id'>;
type CategoryField = 'mapels' | 'babs' | 'sub_babs';

function assertCategoryList(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error(`Invalid ${label}`);
  }

  if (value.some((item) => typeof item !== 'string' || !isSafeCategorySlug(normalizeCategorySlug(item)))) {
    throw new Error(`Invalid ${label}`);
  }
}

function assertQuestionPayload(payload: QuestionPayload) {
  if (typeof payload.question_text !== 'string' || payload.question_text.trim().length === 0 || payload.question_text.length > 10000) {
    throw new Error('Invalid question payload');
  }

  assertCategoryList(payload.mapels, 'MAPEL');
  assertCategoryList(payload.babs, 'BAB');
  if (Array.isArray(payload.sub_babs) && payload.sub_babs.length > 0) assertCategoryList(payload.sub_babs, 'Sub-bab');

  if (payload.question_type !== 'multiple_choice' && payload.question_type !== 'short_answer') {
    throw new Error('Invalid question type');
  }

  if (payload.question_type === 'multiple_choice' && !['A', 'B', 'C', 'D', 'E'].includes(String(payload.correct_answer).toUpperCase())) {
    throw new Error('Invalid correct answer');
  }
}

export async function createQuestionAction(accessToken: string, payload: QuestionPayload) {
  assertQuestionPayload(payload);
  const { supabase, user } = await requirePermission(accessToken, 'question:create');
  const { error } = await supabase.from('questions').insert([{ ...payload, created_by: user.id }]);
  if (error) throw new Error(error.message);
}

export async function updateQuestionAction(accessToken: string, id: number, payload: QuestionPayload) {
  if (!Number.isInteger(id)) throw new Error('Invalid question id');
  assertQuestionPayload(payload);
  const { supabase, admin } = await requireAdmin(accessToken);
  const { data: question, error: fetchError } = await supabase.from('questions').select('created_by').eq('id', id).single();
  if (fetchError) throw new Error(fetchError.message);
  const createdBy = question?.created_by as string | null | undefined;
  const allowed = hasPermission(admin, 'question:update:any') || (createdBy === admin.userId && hasPermission(admin, 'question:update:own'));
  if (!allowed) throw new Error('Forbidden');
  const { error } = await supabase.from('questions').update(payload).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteQuestionAction(accessToken: string, id: number) {
  if (!Number.isInteger(id)) throw new Error('Invalid question id');
  const { supabase, admin } = await requireAdmin(accessToken);
  const { data: question, error: fetchError } = await supabase.from('questions').select('created_by').eq('id', id).single();
  if (fetchError) throw new Error(fetchError.message);
  assertQuestionDeleteAllowed(admin, question?.created_by as string | null | undefined);
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateQuestionsVisibilityAction(accessToken: string, ids: number[], isHidden: boolean) {
  const safeIds = ids.filter(Number.isInteger);
  if (safeIds.length === 0) throw new Error('No question ids selected');
  const { supabase, admin } = await requireAdmin(accessToken);
  const { data: questions, error: fetchError } = await supabase.from('questions').select('id, created_by').in('id', safeIds);
  if (fetchError) throw new Error(fetchError.message);

  const editableIds = (questions || [])
    .filter((question) => hasPermission(admin, 'question:update:any') || (question.created_by === admin.userId && hasPermission(admin, 'question:update:own')))
    .map((question) => question.id);
  if (editableIds.length !== safeIds.length) throw new Error('Forbidden');

  const { error } = await supabase.from('questions').update({ is_hidden: isHidden }).in('id', editableIds);
  if (error) throw new Error(error.message);
}

export async function removeQuestionCategoryAction(accessToken: string, id: number, field: CategoryField, values: string[]) {
  if (!Number.isInteger(id)) throw new Error('Invalid question id');
  if (!['mapels', 'babs', 'sub_babs'].includes(field)) throw new Error('Invalid category field');
  const { supabase } = await requirePermission(accessToken, 'topic:delete');
  const { error } = await supabase.from('questions').update({ [field]: values }).eq('id', id);
  if (error) throw new Error(error.message);
}

export type MapelCount = {
  mapel: string;
  count: number;
};

export async function fetchQuestionCountsByMapelAction(accessToken: string): Promise<MapelCount[]> {
  const { supabase } = await requireAdmin(accessToken);

  const { data: questions, error } = await supabase
    .from('questions')
    .select('mapels');

  if (error) throw new Error(error.message);

  const mapelCounts = new Map<string, number>();

  questions?.forEach((question) => {
    const mapels = question.mapels as string[] | null;
    if (mapels && Array.isArray(mapels)) {
      mapels.forEach((mapel) => {
        mapelCounts.set(mapel, (mapelCounts.get(mapel) || 0) + 1);
      });
    }
  });

  return Array.from(mapelCounts.entries())
    .map(([mapel, count]) => ({ mapel, count }))
    .sort((a, b) => a.mapel.localeCompare(b.mapel));
}

export type QuestionFilters = {
  mapels?: string[];
  babs?: string[];
  subBabs?: string[];
  questionType?: 'all' | 'multiple_choice' | 'short_answer';
  visibility?: 'all' | 'visible' | 'hidden';
  searchQuery?: string;
  sortOrder?: 'asc' | 'desc';
};

export type PaginatedQuestionsResult = {
  questions: RawQuestion[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function fetchQuestionsPaginatedAction(
  accessToken: string,
  filters: QuestionFilters,
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedQuestionsResult> {
  const { supabase } = await requireAdmin(accessToken);

  let query = supabase.from('questions').select('*', { count: 'exact' });

  if (filters.mapels && filters.mapels.length > 0) {
    query = query.overlaps('mapels', filters.mapels);
  }

  if (filters.babs && filters.babs.length > 0) {
    query = query.overlaps('babs', filters.babs);
  }

  if (filters.subBabs && filters.subBabs.length > 0) {
    query = query.overlaps('sub_babs', filters.subBabs);
  }

  if (filters.questionType && filters.questionType !== 'all') {
    query = query.eq('question_type', filters.questionType);
  }

  if (filters.visibility === 'visible') {
    query = query.eq('is_hidden', false);
  } else if (filters.visibility === 'hidden') {
    query = query.eq('is_hidden', true);
  }

  if (filters.searchQuery && filters.searchQuery.trim()) {
    // PostgREST `or` filters are evaluated as a comma-separated list, so any
    // raw comma, parenthesis, or wildcard in user input changes the query
    // structure. Strip those characters and bound the length before injecting.
    const safeTerm = filters.searchQuery
      .trim()
      .replace(/[,()*%\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 200);
    if (safeTerm) {
      const pattern = `%${safeTerm}%`;
      query = query.or(
        [
          `question_text.ilike.${pattern}`,
          `option_a.ilike.${pattern}`,
          `option_b.ilike.${pattern}`,
          `option_c.ilike.${pattern}`,
          `option_d.ilike.${pattern}`,
          `option_e.ilike.${pattern}`,
          `short_answer.ilike.${pattern}`,
        ].join(',')
      );
    }
  }

  const sortColumn = 'created_at';
  const sortAscending = filters.sortOrder === 'asc';
  query = query.order(sortColumn, { ascending: sortAscending });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: questions, error, count } = await query;

  if (error) throw new Error(error.message);

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Fetch usernames for all unique created_by IDs
  const uniqueCreatorIds = [...new Set((questions || []).map((q: any) => q.created_by).filter(Boolean))];
  let usernameMap: Record<string, string> = {};

  if (uniqueCreatorIds.length > 0) {
    // Try multiple table/field combinations to find usernames
    try {
      // Try 1: admin_profiles table (primary)
      const { data: adminProfiles, error: profileError } = await supabase
        .from('admin_profiles')
        .select('user_id, username')
        .in('user_id', uniqueCreatorIds);

      if (adminProfiles && adminProfiles.length > 0) {
        usernameMap = Object.fromEntries(
          adminProfiles.map((u: any) => [u.user_id, u.username])
        );
      } else if (profileError) {
        // Try 2: admin_users table with user_id field
        const { data: adminUsers, error: adminError } = await supabase
          .from('admin_users')
          .select('user_id, username')
          .in('user_id', uniqueCreatorIds);

        if (adminUsers && adminUsers.length > 0) {
          usernameMap = Object.fromEntries(
            adminUsers.map((u: any) => [u.user_id, u.username])
          );
        } else if (adminError) {
          // Try 3: profiles table with id field
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', uniqueCreatorIds);

          if (profiles && profiles.length > 0) {
            usernameMap = Object.fromEntries(
              profiles.map((u: any) => [u.id, u.username])
            );
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch usernames:', err);
    }
  }

  const transformedQuestions = (questions || []).map((q: any) => ({
    ...q,
    creator_username: q.created_by ? usernameMap[q.created_by] || null : null,
  })) as RawQuestion[];

  return {
    questions: transformedQuestions,
    total,
    page,
    pageSize,
    totalPages,
  };
}
