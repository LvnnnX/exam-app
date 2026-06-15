import { supabase } from './supabase';
import { ensureHtmlDocument } from './rich-text';
import { isSafeCategorySlug, normalizeCategorySlug } from './categories';
import { getCache, setCache, CACHE_TTL } from './cache';

const getUA = () => typeof window !== 'undefined' ? window.navigator.userAgent : 'server';

export type BabInfo = {
  value: string;
  label: string;
};

export type SubBabInfo = {
  value: string;
  label: string;
};

// Available question counts
export const QUESTION_COUNTS = [5, 10, 20, 25, 30, 40, 50, 100] as const;
export type QuestionCount = typeof QUESTION_COUNTS[number];

// Raw question shape from Supabase (also used as fallback)
export type QuestionType = 'multiple_choice' | 'short_answer';

export type RawQuestion = {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_answer: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  question_type: QuestionType;
  short_answer: string;
  is_hidden: boolean;
  created_by?: string | null;
  creator_username?: string | null;
  updated_at?: string | null;
  mapels: string[];
  babs: string[];
  sub_babs: string[];
};

export type PublicQuestion = Omit<RawQuestion, 'correct_answer' | 'is_hidden' | 'short_answer'>;

// A single shuffled option for rendering
export type ShuffledOption = {
  label: string;   // display label: 'A', 'B', 'C', 'D', 'E'
  text: string;     // the option text
};

// A fully prepared question with shuffled options
export type ShuffledQuestion = {
  id: number;
  question_text: string;
  question_type: QuestionType;
  options: ShuffledOption[];   // 5 options in shuffled order
  correct_label: string;       // the new label (A-E) pointing to the correct answer
};


type SessionStateRpcRow = {
  is_finished?: boolean;
  name?: string;
  question_count: number;
  mapel?: string;
  bab?: string;
  sub_bab?: string;
  mode?: string;
  lives?: number;
  current_index: number;
  user_answers?: Record<string, string | null>;
};

type SaveSessionAnswerRpcResult = {
  error?: string;
  success?: boolean;
  is_correct?: boolean;
};

type SessionRecapEntry = Record<string, unknown>;

type SubmitSessionExamRpcRow = {
  score: number;
  recap: SessionRecapEntry[];
  total_attempted: number;
};

type CategoryRow = {
  mapels?: string[] | string | null;
  mapel?: string[] | string | null;
  babs?: string[] | string | null;
  sub_babs?: string[] | string | null;
};

function toStringArray(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === null || value === undefined || value === '') return [];
  return [String(value)];
}

const ANSWER_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

function normalizeCorrectAnswer(value: string): string {
  const candidate = (value ?? '').toUpperCase();
  return ANSWER_LABELS.includes(candidate as typeof ANSWER_LABELS[number]) ? candidate : 'A';
}

function normalizeQuestionType(value: string | null | undefined): QuestionType {
  return value === 'short_answer' ? 'short_answer' : 'multiple_choice';
}

export function normalizeRawQuestion(raw: RawQuestion): RawQuestion {
  const hasShortAnswer = raw.short_answer !== null && raw.short_answer !== undefined && String(raw.short_answer).trim() !== '';

  return {
    ...raw,
    question_text: ensureHtmlDocument(String(raw.question_text ?? '')),
    option_a: ensureHtmlDocument(String(raw.option_a ?? '')),
    option_b: ensureHtmlDocument(String(raw.option_b ?? '')),
    option_c: ensureHtmlDocument(String(raw.option_c ?? '')),
    option_d: ensureHtmlDocument(String(raw.option_d ?? '')),
    option_e: ensureHtmlDocument(String(raw.option_e ?? '')),
    correct_answer: normalizeCorrectAnswer(raw.correct_answer),
    question_type: hasShortAnswer ? 'short_answer' : 'multiple_choice',
    short_answer: String(raw.short_answer ?? ''),
    is_hidden: Boolean(raw.is_hidden),
  };
}

export function normalizePublicQuestion(raw: PublicQuestion): PublicQuestion {
  return {
    ...raw,
    question_text: ensureHtmlDocument(String(raw.question_text ?? '')),
    option_a: ensureHtmlDocument(String(raw.option_a ?? '')),
    option_b: ensureHtmlDocument(String(raw.option_b ?? '')),
    option_c: ensureHtmlDocument(String(raw.option_c ?? '')),
    option_d: ensureHtmlDocument(String(raw.option_d ?? '')),
    option_e: ensureHtmlDocument(String(raw.option_e ?? '')),
    question_type: normalizeQuestionType(raw.question_type),
  };
}

export type VisibilitySettings = {
  hidden_mapels: string[];
  admin_only_mapels: string[];
  hidden_babs: string[];
  admin_only_babs: string[];
  hidden_sub_babs: string[];
  admin_only_sub_babs: string[];
};

/**
 * Fetches all visibility settings from the app_settings table.
 * Cached for 10 minutes to reduce bandwidth.
 */
export async function fetchVisibilitySettings(): Promise<VisibilitySettings> {
  // Try cache first
  const cacheKey = 'visibility_settings';
  const cached = getCache<VisibilitySettings>(cacheKey, { ttl: CACHE_TTL.SETTINGS });
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('hidden_mapels, admin_only_mapels, hidden_babs, admin_only_babs, hidden_sub_babs, admin_only_sub_babs')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;

    const result = {
      hidden_mapels: (data?.hidden_mapels as string[]) || [],
      admin_only_mapels: (data?.admin_only_mapels as string[]) || [],
      hidden_babs: (data?.hidden_babs as string[]) || [],
      admin_only_babs: (data?.admin_only_babs as string[]) || [],
      hidden_sub_babs: (data?.hidden_sub_babs as string[]) || [],
      admin_only_sub_babs: (data?.admin_only_sub_babs as string[]) || [],
    };

    // Cache the result
    setCache(cacheKey, result, { ttl: CACHE_TTL.SETTINGS });
    return result;
  } catch {
    console.warn('Using default visibility settings due to fetch error');
    return {
      hidden_mapels: [],
      admin_only_mapels: [],
      hidden_babs: [],
      admin_only_babs: [],
      hidden_sub_babs: [],
      admin_only_sub_babs: [],
    };
  }
}

export async function fetchMapels(): Promise<BabInfo[]> {
  // Try cache first
  const cacheKey = 'mapels_public';
  const cached = getCache<BabInfo[]>(cacheKey, { ttl: CACHE_TTL.CATEGORIES });
  if (cached) return cached;

  try {
    const [mapelsResult, visibility] = await Promise.all([
      supabase.from('public_categories').select('mapels'),
      fetchVisibilitySettings(),
    ]);

    const { data, error } = mapelsResult;
    if (error) return [];
    if (!data || data.length === 0) return [];

    const rawMapels = data.flatMap((q) => {
      const row = q as CategoryRow;
      return toStringArray(row.mapels);
    }).filter(Boolean);

    const seen = new Map<string, string>();
    for (const raw of rawMapels) {
      const slug = normalizeCategorySlug(String(raw));
      if (slug && !seen.has(slug)) {
        seen.set(slug, String(raw));
      }
    }

    const result = Array.from(seen.entries())
      .filter(([slug]) => !visibility.hidden_mapels.includes(slug) && !visibility.admin_only_mapels.includes(slug))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_slug, raw]) => ({ value: raw, label: raw }));

    // Cache the result
    setCache(cacheKey, result, { ttl: CACHE_TTL.CATEGORIES });
    return result;
  } catch {
    return [];
  }
}

export async function fetchAllMapelsAdmin(): Promise<BabInfo[]> {
  const [categoryResult, questionResult] = await Promise.all([
    supabase.from('public_categories').select('*'),
    supabase.from('questions').select('mapels'),
  ]);

  if (categoryResult.error && questionResult.error) {
    console.error('Failed to fetch all mapels:', categoryResult.error.message);
    return [];
  }

  const categoryMapels = (categoryResult.data || []).flatMap((q) => {
    const row = q as CategoryRow;
    return toStringArray(row.mapels ?? row.mapel);
  });
  const questionMapels = (questionResult.data || []).flatMap((q) => toStringArray((q as CategoryRow).mapels));
  const rawMapels = [...categoryMapels, ...questionMapels].filter(Boolean);

  const seen = new Map<string, string>();
  for (const raw of rawMapels) {
    const value = String(raw);
    if (value && !seen.has(value)) {
      seen.set(value, value);
    }
  }

  return Array.from(seen.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_slug, raw]) => ({ value: raw, label: raw }));
}

export async function fetchbabs(mapel?: string): Promise<BabInfo[]> {
  let query = supabase.from('public_categories').select('*');
  
  if (mapel && mapel !== 'Semua Mapel' && mapel !== 'None') {
    query = query.contains('mapels', [mapel]);
  }

  const [babsResult, visibility] = await Promise.all([
    query,
    fetchVisibilitySettings(),
  ]);

  const { data, error } = babsResult;
  if (error || !data) return [];

  const rawBabs = data.flatMap((q) => {
    const row = q as CategoryRow;
    return toStringArray(row.babs);
  }).filter(Boolean);

  const seen = new Map<string, string>();
  for (const raw of rawBabs) {
    const slug = normalizeCategorySlug(String(raw));
    if (slug && !seen.has(slug)) {
      seen.set(slug, String(raw));
    }
  }

  return Array.from(seen.entries())
    .filter(([slug]) => !visibility.hidden_babs.includes(slug) && !visibility.admin_only_babs.includes(slug))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_slug, raw]) => ({ value: raw, label: raw }));
}

export async function fetchBabsAdmin(mapel?: string | string[]): Promise<BabInfo[]> {
  // Server-side DISTINCT unnest via RPC (idx_questions_mapels_gin backs the overlap filter).
  // Replaces the prior full-table scan + JS dedupe.
  const selectedMapels = (Array.isArray(mapel) ? mapel : mapel ? [mapel] : [])
    .filter(m => m !== 'Semua MAPEL' && m !== 'None')
    .filter(Boolean);

  const { data, error } = await supabase.rpc('get_distinct_babs', {
    p_mapels: selectedMapels.length > 0 ? selectedMapels : null,
  });

  if (error || !data) {
    if (error) console.error('get_distinct_babs failed:', error.message);
    return [];
  }

  const seen = new Map<string, string>();
  for (const row of data as { value: string }[]) {
    const raw = String(row.value);
    const slug = normalizeCategorySlug(raw);
    if (slug && !seen.has(slug)) seen.set(slug, raw);
  }

  return Array.from(seen.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_slug, raw]) => ({ value: raw, label: raw }));
}

export async function fetchAllBabsAdmin(): Promise<BabInfo[]> {
  const { data, error } = await supabase.from('public_categories').select('*');

  if (error || !data) return [];

  const rawBabs = data.flatMap((q) => {
    const row = q as CategoryRow;
    return toStringArray(row.babs);
  }).filter(Boolean);

  const seen = new Map<string, string>();
  for (const raw of rawBabs) {
    const slug = normalizeCategorySlug(String(raw));
    if (slug && !seen.has(slug)) {
      seen.set(slug, String(raw));
    }
  }

  return Array.from(seen.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_slug, raw]) => ({ value: raw, label: raw }));
}

export async function fetchSubBabsAdmin(bab?: string | string[]): Promise<SubBabInfo[]> {
  // Server-side DISTINCT unnest via RPC (idx_questions_babs_gin backs the overlap filter).
  // Replaces the prior full-table scan + JS dedupe.
  const selectedBabs = (Array.isArray(bab) ? bab : bab ? [bab] : [])
    .filter(b => b !== 'Semua BAB' && b !== 'None')
    .filter(Boolean);

  const { data, error } = await supabase.rpc('get_distinct_sub_babs', {
    p_babs: selectedBabs.length > 0 ? selectedBabs : null,
  });

  if (error || !data) {
    if (error) console.error('get_distinct_sub_babs failed:', error.message);
    return [];
  }

  const seen = new Map<string, string>();
  for (const row of data as { value: string }[]) {
    const raw = String(row.value);
    const slug = normalizeCategorySlug(raw);
    if (slug && !seen.has(slug)) seen.set(slug, raw);
  }

  return Array.from(seen.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_slug, raw]) => ({ value: raw, label: raw }));
}

/** 
 * Returns sub_babs belonging to ANY of the provided babs.
 */
export async function fetchSubBabsForMultiple(babs: string[]): Promise<SubBabInfo[]> {
  if (!babs || babs.length === 0) return [];

  // Use raw bab values directly for the query (case-sensitive match in DB)
  const [subBabsResult, visibility] = await Promise.all([
    supabase
      .from('public_categories')
      .select('sub_babs')
      .or(babs.map((hb) => `babs.cs.{${hb}}`).join(',')),
    fetchVisibilitySettings(),
  ]);

  const { data, error } = subBabsResult;

  if (error) {
    console.error('Failed to fetch sub babs for multiple BABs:', error.message);
    return [];
  }

  // Defensive: ensure none of the requested babs are restricted
  const visibleBabs = babs.filter(b => {
    const slug = normalizeCategorySlug(b);
    return !visibility.hidden_babs.includes(slug) && !visibility.admin_only_babs.includes(slug);
  });

  if (visibleBabs.length === 0) return [];

  const rawSubBabs = data.flatMap((q) => q.sub_babs || []).filter(Boolean);
  const seen = new Map<string, string>();
  for (const raw of rawSubBabs) {
    const slug = normalizeCategorySlug(raw);
    if (isSafeCategorySlug(slug) && !seen.has(slug)) {
      seen.set(slug, raw);
    }
  }

  return Array.from(seen.entries())
    .filter(([slug]) => !visibility.hidden_sub_babs.includes(slug) && !visibility.admin_only_sub_babs.includes(slug))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_slug, raw]) => ({ value: raw, label: raw }));
}

/** Returns ALL sub_babs from the questions table with zero filtering.
 *  Used by the admin Settings page to allow toggling every sub_bab. */
export async function fetchAllSubBabsAdmin(): Promise<SubBabInfo[]> {
  const { data, error } = await supabase.from('public_categories').select('sub_babs');

  if (error) {
    console.error('Failed to fetch all sub_babs (admin):', error.message);
    return [];
  }

  const rawSubBabs = data.flatMap((q) => q.sub_babs || []).filter(Boolean);
  const seen = new Map<string, string>();
  for (const raw of rawSubBabs) {
    const slug = normalizeCategorySlug(raw);
    if (isSafeCategorySlug(slug) && !seen.has(slug)) {
      seen.set(slug, raw);
    }
  }

  return Array.from(seen.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_slug, raw]) => ({ value: raw, label: raw }));
}

export async function fetchQuestions(mapel?: string, bab?: string, subBab?: string): Promise<RawQuestion[]> {
  let query = supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, question_type, short_answer, is_hidden, created_by, mapels, babs, sub_babs');

  if (mapel && mapel !== 'Semua Mapel' && mapel !== 'None') {
    query = query.contains('mapels', [mapel]);
  }

  if (bab && bab !== 'Semua BAB' && bab !== 'None') {
    query = query.contains('babs', [bab]);
  }

  if (subBab && subBab !== 'Semua Sub-bab') {
    query = query.contains('sub_babs', [subBab]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Supabase fetch failed:', error.message);
    throw new Error(`Failed to fetch questions: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // If empty DB, return an empty array rather than failing silently with mock data.
    return [];
  }

  return (data as RawQuestion[]).map(normalizeRawQuestion);
}

import { startExamSessionAction } from '@/app/actions/exam';

export async function startExamSessionViaRpc(name: string, mapels: string[], babs: string[], subBabs: string[], mode: string, count: number, timeLimitMinutes: number): Promise<{ sessionId: string; total: number; expiresAt: string }> {
  try {
    const data = await startExamSessionAction(
      name,
      mapels,
      babs,
      subBabs,
      mode,
      count,
      timeLimitMinutes,
      getUA()
    );

    return {
      sessionId: data.session_id,
      total: data.question_count,
      expiresAt: data.expires_at
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('start_exam_session action failed:', message);
    throw new Error(`Failed to start exam session: ${message}`);
  }
}

export async function getSessionStateViaRpc(sessionId: string): Promise<SessionStateRpcRow | null> {
  const { data, error } = await supabase.rpc('get_session_state', {
    p_session_id: sessionId
  }).single();

  if (error) {
    console.error('get_session_state rpc failed:', error.message);
    return null;
  }

  return data as SessionStateRpcRow;
}

export async function getSessionQuestionViaRpc(sessionId: string, index: number): Promise<ShuffledQuestion | null> {
  const { data, error } = await supabase.rpc('get_session_question', {
    p_session_id: sessionId,
    p_index: index
  }).single();

  if (error) {
    console.error('get_session_question rpc failed:', error.message);
    return null;
  }

  if (!data) return null;

  return shuffleOptions(data as PublicQuestion);
}

export async function saveSessionAnswerViaRpc(sessionId: string, index: number, answerText: string): Promise<SaveSessionAnswerRpcResult> {
  const { data, error } = await supabase.rpc('save_session_answer', {
    p_session_id: sessionId,
    p_index: index,
    p_answer_text: answerText,
    p_user_agent: getUA()
  });

  if (error) {
    console.error('save_session_answer rpc failed:', error.message);
    throw new Error(error.message);
  }

  return data as SaveSessionAnswerRpcResult;
}

export async function submitSessionExamViaRpc(
  sessionId: string,
  endTime: string
): Promise<{ score: number, recap: SessionRecapEntry[], total_attempted: number }> {
  const { data, error } = await supabase.rpc('submit_session_exam', {
    p_session_id: sessionId,
    p_end_time: endTime
  }).single();

  if (error) {
    console.error('submit_session_exam rpc failed:', error.message);
    throw new Error(`Failed to submit exam: ${error.message}`);
  }

  return data as SubmitSessionExamRpcRow;
}

// ==================== Fetch specific questions by IDs ====================

export async function fetchQuestionsByIds(ids: number[]): Promise<RawQuestion[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, question_type, short_answer, is_hidden, created_by, mapels, babs, sub_babs')
    .in('id', ids);

  if (error) {
    console.error('Failed to fetch specific questions:', error.message);
    throw new Error(`Failed to fetch questions: ${error.message}`);
  }

  return (data as RawQuestion[]).map(normalizeRawQuestion);
}

// ==================== Fisher-Yates Shuffle ====================

function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ==================== Shuffle Options per Question ====================

const LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

export function shuffleOptions(raw: PublicQuestion): ShuffledQuestion {
  const normalized = normalizePublicQuestion(raw);

  if (normalized.question_type === 'short_answer') {
    return {
      id: normalized.id,
      question_text: normalized.question_text,
      question_type: normalized.question_type,
      options: [],
      correct_label: 'HIDDEN',
    };
  }

  const originalOptions = [
    { text: normalized.option_a },
    { text: normalized.option_b },
    { text: normalized.option_c },
    { text: normalized.option_d },
    { text: normalized.option_e },
  ];

  const shuffledOpts = fisherYatesShuffle(originalOptions);

  const options: ShuffledOption[] = shuffledOpts.map((opt, idx) => {
    return { label: LABELS[idx], text: opt.text };
  });

  return {
    id: normalized.id,
    question_text: normalized.question_text,
    question_type: normalized.question_type,
    options,
    correct_label: 'HIDDEN',
  };
}


