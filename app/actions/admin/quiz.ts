"use server";

import { requirePermission } from '@/lib/admin-server';
import { QUIZ_CODE_LENGTH, type KuisLog, type KuisStatus } from '@/lib/quiz';
import { isSafeCategorySlug, normalizeCategorySlug } from '@/lib/categories';

const QUIZ_CODE_ALPHABET = '0123456789';

type CreateQuizSessionInput = {
  mapel: string | string[];
  bab: string | string[];
  subBabs: string[];
  questionCount: number;
  durationMinutes: number;
  scheduledAt?: string;
  percentages?: Record<string, number>;
  quizMode?: 'strict' | 'standard';
  allowJoinMidGame?: boolean;
  selectedQuestionIds?: number[];
};

type QuizStatusUpdates = Partial<Pick<KuisLog, 'status' | 'started_at' | 'finished_at' | 'paused_at' | 'expires_at' | 'scheduled_at'>>;

function generateQuizCode(length = QUIZ_CODE_LENGTH): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomBytes, (byte) => QUIZ_CODE_ALPHABET[byte % QUIZ_CODE_ALPHABET.length]).join('');
}

function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function asList(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function normalizeQuizCategoryList(value: string | string[], allLabel: string): string[] {
  return asList(value)
    .map((item) => String(item).trim())
    .filter(Boolean)
    .filter((item) => item.length <= 200)
    .slice(0, 50);
}

function assertQuizInput(input: CreateQuizSessionInput) {
  const fixedQuestionCount = input.selectedQuestionIds?.length || 0;
  const validQuestionCount = fixedQuestionCount > 0
    ? fixedQuestionCount <= Math.max(...ALLOWED_QUIZ_COUNTS)
    : ALLOWED_QUIZ_COUNTS.has(input.questionCount);

  if (!validQuestionCount || !ALLOWED_QUIZ_DURATIONS.has(input.durationMinutes)) {
    throw new Error('Invalid quiz size or duration');
  }

  if (input.quizMode && input.quizMode !== 'strict' && input.quizMode !== 'standard') {
    throw new Error('Invalid quiz mode');
  }

  if (input.scheduledAt && Number.isNaN(new Date(input.scheduledAt).getTime())) {
    throw new Error('Invalid schedule');
  }
}

const ALLOWED_QUIZ_COUNTS = new Set([5, 10, 20, 25, 30, 40, 50, 100]);
const ALLOWED_QUIZ_DURATIONS = new Set([1, 30, 60, 90, 120, 150, 180]);
const ALLOWED_STATUSES = new Set<KuisStatus>(['waiting', 'active', 'paused', 'finished']);

function isValidId(value: string): boolean {
  return /^[0-9a-f-]{8,80}$/i.test(value);
}

async function buildSelectedQuestionIds(supabase: Awaited<ReturnType<typeof requirePermission>>['supabase'], ids: number[]) {
  const selectedIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0))).slice(0, 100);
  if (selectedIds.length === 0) throw new Error('No valid remedial questions selected');

  const { data, error } = await supabase
    .from('questions')
    .select('id')
    .in('id', selectedIds)
    .eq('is_hidden', false);
  if (error) throw new Error(error.message);

  const validIds = new Set((data || []).map((question) => question.id as number));
  if (validIds.size !== selectedIds.length) throw new Error('Some selected questions are hidden or unavailable');

  return selectedIds.filter((id) => validIds.has(id));
}

async function buildQuestionIds(supabase: Awaited<ReturnType<typeof requirePermission>>['supabase'], input: CreateQuizSessionInput) {
  const questionIds: number[] = [];
  const isAllSubBabs = input.subBabs.length === 0 || input.subBabs.includes('Semua Sub-bab');
  let targetSubBabs = input.subBabs;
  let activePercentages = input.percentages;

  if (!activePercentages) {
    if (isAllSubBabs) {
      let query = supabase.from('public_categories').select('sub_babs');
      const filteredMapels = asList(input.mapel).filter((m) => m !== 'None' && m !== 'Semua MAPEL');
      if (filteredMapels.length > 0) query = query.overlaps('mapels', filteredMapels);
      const filteredBabs = asList(input.bab).filter((b) => b !== 'None' && b !== 'Semua BAB');
      if (filteredBabs.length > 0) query = query.overlaps('babs', filteredBabs);

      const { data } = await query;
      if (data) {
        const allSubs = new Set<string>();
        data.forEach((row) => row.sub_babs?.forEach((subBab: string) => allSubs.add(subBab)));
        targetSubBabs = Array.from(allSubs);
      }
    }

    if (targetSubBabs.length > 0) {
      activePercentages = {};
      const equal = 100 / targetSubBabs.length;
      targetSubBabs.forEach((subBab) => {
        activePercentages![subBab] = equal;
      });
    }
  }

  if (activePercentages && targetSubBabs.length > 0) {
    const pool = new Set<number>();

    for (const subBab of targetSubBabs) {
      let query = supabase.from('questions').select('id').eq('is_hidden', false);
      const filteredMapels = asList(input.mapel).filter((m) => m !== 'None' && m !== 'Semua MAPEL');
      if (filteredMapels.length > 0) query = query.overlaps('mapels', filteredMapels);
      const filteredBabs = asList(input.bab).filter((b) => b !== 'None' && b !== 'Semua BAB');
      if (filteredBabs.length > 0) query = query.overlaps('babs', filteredBabs);
      query = query.contains('sub_babs', [subBab]);

      const { data } = await query;
      if (!data) continue;

      const ids = data.map((question) => question.id as number);
      ids.forEach((id) => pool.add(id));
      const count = Math.round(input.questionCount * ((activePercentages[subBab] || 0) / 100));
      const availableIds = ids.filter((id) => !questionIds.includes(id));
      questionIds.push(...shuffle(availableIds).slice(0, count));
    }

    if (questionIds.length < input.questionCount) {
      const remainingNeeded = input.questionCount - questionIds.length;
      const unusedPool = Array.from(pool).filter((id) => !questionIds.includes(id));
      questionIds.push(...shuffle(unusedPool).slice(0, remainingNeeded));
    }

    return shuffle(questionIds.slice(0, input.questionCount));
  }

  let query = supabase.from('questions').select('id').eq('is_hidden', false);
  const filteredMapels = asList(input.mapel).filter((m) => m !== 'None' && m !== 'Semua MAPEL');
  if (filteredMapels.length > 0) query = query.overlaps('mapels', filteredMapels);
  const filteredBabs = asList(input.bab).filter((b) => b !== 'None' && b !== 'Semua BAB');
  if (filteredBabs.length > 0) query = query.overlaps('babs', filteredBabs);

  const { data, error } = await query;
  if (error || !data) throw new Error(error?.message || 'Failed to fetch questions for quiz');

  return shuffle(data.map((question) => question.id as number)).slice(0, input.questionCount);
}

export async function createQuizSessionAction(accessToken: string, input: CreateQuizSessionInput): Promise<KuisLog | null> {
  console.log('[DEBUG] RAW INPUT received by server action:', JSON.stringify(input, null, 2));
  assertQuizInput(input);
  const safeInput: CreateQuizSessionInput = {
    ...input,
    mapel: normalizeQuizCategoryList(input.mapel, 'Semua MAPEL'),
    bab: normalizeQuizCategoryList(input.bab, 'Semua BAB'),
    subBabs: normalizeQuizCategoryList(input.subBabs, 'Semua Sub-bab'),
  };
  const { supabase } = await requirePermission(accessToken, 'quiz:manage:any');
  const questionIds = safeInput.selectedQuestionIds?.length
    ? await buildSelectedQuestionIds(supabase, safeInput.selectedQuestionIds)
    : await buildQuestionIds(supabase, safeInput);
  if (questionIds.length === 0) return null;

  const isAllMapels = safeInput.mapel.length === 0 || safeInput.mapel.includes('Semua MAPEL');
  const isAllBabs = safeInput.bab.length === 0 || safeInput.bab.includes('Semua BAB');
  const isAllSubBabs = safeInput.subBabs.length === 0 || safeInput.subBabs.includes('Semua Sub-bab');

  const insertData: Record<string, unknown> = {
    quiz_code: generateQuizCode(),
    mapel: isAllMapels ? 'Semua MAPEL' : asList(safeInput.mapel).join(', '),
    bab: isAllBabs ? 'Semua BAB' : asList(safeInput.bab).join(', '),
    sub_bab: isAllSubBabs ? 'Semua Sub-bab' : safeInput.subBabs.join(', '),
    question_count: questionIds.length,
    duration_minutes: safeInput.durationMinutes,
    status: 'waiting',
    question_ids: questionIds,
    quiz_mode: safeInput.quizMode || 'strict',
    allow_join_mid_game: safeInput.allowJoinMidGame ?? true,
  };
  if (safeInput.scheduledAt) insertData.scheduled_at = safeInput.scheduledAt;

  const { data, error } = await supabase.from('kuis_logs').insert([insertData]).select().single();
  if (error) throw new Error(error.message);
  return data as KuisLog;
}

export async function updateQuizScheduleAction(accessToken: string, id: string, scheduledAt: string | null): Promise<boolean> {
  if (!isValidId(id) || (scheduledAt !== null && Number.isNaN(new Date(scheduledAt).getTime()))) throw new Error('Invalid quiz schedule');
  const { supabase } = await requirePermission(accessToken, 'quiz:manage:any');
  const { error } = await supabase.from('kuis_logs').update({ scheduled_at: scheduledAt }).eq('id', id).eq('status', 'waiting');
  if (error) throw new Error(error.message);
  return true;
}

export async function updateQuizStatusAction(accessToken: string, id: string, status: KuisStatus): Promise<KuisLog | null> {
  if (!isValidId(id) || !ALLOWED_STATUSES.has(status)) throw new Error('Invalid quiz status');
  const { supabase } = await requirePermission(accessToken, 'quiz:manage:any');
  const { data: current } = await supabase.from('kuis_logs').select('*').eq('id', id).single();
  if (!current) return null;

  const updates: QuizStatusUpdates = { status };
  const now = new Date().toISOString();

  if (status === 'active') {
    if (current.status === 'waiting') {
      updates.started_at = now;
      updates.expires_at = new Date(Date.now() + current.duration_minutes * 60000).toISOString();
    } else if (current.status === 'paused' && current.paused_at && current.started_at) {
      const pauseDuration = Date.now() - new Date(current.paused_at).getTime();
      updates.started_at = new Date(new Date(current.started_at).getTime() + pauseDuration).toISOString();
      if (current.expires_at) {
        updates.expires_at = new Date(new Date(current.expires_at).getTime() + pauseDuration).toISOString();
      }
      updates.paused_at = undefined;
    }
  } else if (status === 'paused') {
    updates.paused_at = now;
  } else if (status === 'finished') {
    updates.finished_at = now;
  }

  const { data, error } = await supabase.from('kuis_logs').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data as KuisLog;
}

export async function deleteQuizSessionAction(accessToken: string, id: string): Promise<boolean> {
  if (!isValidId(id)) throw new Error('Invalid quiz id');
  const { supabase } = await requirePermission(accessToken, 'quiz:manage:any');
  const { error } = await supabase.from('kuis_logs').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}
