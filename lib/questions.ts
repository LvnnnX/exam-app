import { supabase } from './supabase';
import { ensureHtmlDocument } from './rich-text';
import { categorySlugToLabel, isSafeCategorySlug, normalizeCategorySlug } from './categories';

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

type StartExamSessionRpcRow = {
  session_id: string;
  question_count: number;
  expires_at: string;
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

const ANSWER_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

function normalizeCorrectAnswer(value: string): string {
  const candidate = (value ?? '').toUpperCase();
  return ANSWER_LABELS.includes(candidate as typeof ANSWER_LABELS[number]) ? candidate : 'A';
}

function normalizeQuestionType(value: string | null | undefined): QuestionType {
  return value === 'short_answer' ? 'short_answer' : 'multiple_choice';
}

function normalizeRawQuestion(raw: RawQuestion): RawQuestion {
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
 */
export async function fetchVisibilitySettings(): Promise<VisibilitySettings> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('hidden_mapels, admin_only_mapels, hidden_babs, admin_only_babs, hidden_sub_babs, admin_only_sub_babs')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;

    return {
      hidden_mapels: (data?.hidden_mapels as string[]) || [],
      admin_only_mapels: (data?.admin_only_mapels as string[]) || [],
      hidden_babs: (data?.hidden_babs as string[]) || [],
      admin_only_babs: (data?.admin_only_babs as string[]) || [],
      hidden_sub_babs: (data?.hidden_sub_babs as string[]) || [],
      admin_only_sub_babs: (data?.admin_only_sub_babs as string[]) || [],
    };
  } catch (err) {
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

/**
 * Persists the visibility settings to the app_settings table.
 */
export async function saveVisibilitySettings(settings: VisibilitySettings): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, ...settings }, { onConflict: 'id' });

  if (error) {
    console.error('Failed to save visibility settings:', error.message);
    throw new Error(`Failed to save settings: ${error.message}`);
  }
}

export async function fetchMapels(): Promise<BabInfo[]> {
  try {
    const [mapelsResult, visibility] = await Promise.all([
      supabase.from('public_categories').select('*'),
      fetchVisibilitySettings(),
    ]);

    const { data, error } = mapelsResult;
    if (error) return [];
    if (!data || data.length === 0) return [];

    const rawMapels = data.flatMap((q: any) => {
      const val = q.mapels || [];
      return Array.isArray(val) ? val : [val];
    }).filter(Boolean);
    
    const seen = new Map<string, string>();
    for (const raw of rawMapels) {
      const slug = normalizeCategorySlug(String(raw));
      if (slug && !seen.has(slug)) {
        seen.set(slug, String(raw));
      }
    }

    return Array.from(seen.entries())
      .filter(([slug]) => !visibility.hidden_mapels.includes(slug) && !visibility.admin_only_mapels.includes(slug))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slug, raw]) => ({ value: raw, label: categorySlugToLabel(slug) }));
  } catch (err) {
    return [];
  }
}

export async function fetchMapelsAdmin(): Promise<BabInfo[]> {
  const [mapelsResult, visibility] = await Promise.all([
    supabase.from('public_categories').select('*'),
    fetchVisibilitySettings(),
  ]);

  const { data, error } = mapelsResult;

  if (error) {
    console.error('Failed to fetch mapels admin:', error.message);
    return [];
  }

  const rawMapels = data.flatMap((q: any) => {
    const val = q.mapels || q.mapel || [];
    return Array.isArray(val) ? val : [val];
  }).filter(Boolean);
  
  const seen = new Map<string, string>();
  for (const raw of rawMapels) {
    const slug = normalizeCategorySlug(raw);
    if (slug && !seen.has(slug)) {
      seen.set(slug, raw);
    }
  }

  return Array.from(seen.entries())
    .filter(([slug]) => !visibility.hidden_mapels.includes(slug))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, raw]) => ({ value: raw, label: categorySlugToLabel(slug) }));
}

export async function fetchAllMapelsAdmin(): Promise<BabInfo[]> {
  const { data, error } = await supabase.from('public_categories').select('*');

  if (error) {
    console.error('Failed to fetch all mapels:', error.message);
    return [];
  }

  const rawMapels = data.flatMap((q: any) => {
    const val = q.mapels || q.mapel || [];
    return Array.isArray(val) ? val : [val];
  }).filter(Boolean);
  
  const seen = new Map<string, string>();
  for (const raw of rawMapels) {
    const slug = normalizeCategorySlug(raw);
    if (slug && !seen.has(slug)) {
      seen.set(slug, raw);
    }
  }

  return Array.from(seen.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, raw]) => ({ value: raw, label: categorySlugToLabel(slug) }));
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

  const rawBabs = data.flatMap((q: any) => {
    const val = q.babs || [];
    return Array.isArray(val) ? val : [val];
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
    .map(([slug, raw]) => ({ value: raw, label: categorySlugToLabel(slug) }));
}

export async function fetchBabsAdmin(mapel?: string | string[]): Promise<BabInfo[]> {
  let query = supabase.from('public_categories').select('*');

  if (mapel) {
    const mapels = Array.isArray(mapel) ? mapel : [mapel];
    const filteredMapels = mapels.filter(m => m !== 'Semua MAPEL' && m !== 'None');
    if (filteredMapels.length > 0) {
      query = query.overlaps('mapels', filteredMapels);
    }
  }

  const [babsResult, visibility] = await Promise.all([
    query,
    fetchVisibilitySettings(),
  ]);

  const { data, error } = babsResult;
  if (error || !data) return [];

  const rawBabs = data.flatMap((q: any) => {
    const val = q.babs || [];
    return Array.isArray(val) ? val : [val];
  }).filter(Boolean);

  const seen = new Map<string, string>();
  for (const raw of rawBabs) {
    const slug = normalizeCategorySlug(String(raw));
    if (slug && !seen.has(slug)) {
      seen.set(slug, String(raw));
    }
  }

  return Array.from(seen.entries())
    .filter(([slug]) => !visibility.hidden_babs.includes(slug))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, raw]) => ({ value: raw, label: categorySlugToLabel(slug) }));
}

export async function fetchAllBabsAdmin(): Promise<BabInfo[]> {
  const { data, error } = await supabase.from('public_categories').select('*');

  if (error || !data) return [];

  const rawBabs = data.flatMap((q: any) => {
    const val = q.babs || [];
    return Array.isArray(val) ? val : [val];
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
    .map(([slug, raw]) => ({ value: raw, label: categorySlugToLabel(slug) }));
}

export async function fetchSubBabs(bab?: string): Promise<SubBabInfo[]> {
  let query = supabase.from('public_categories').select('*');
  if (bab && bab !== 'Semua BAB' && bab !== 'None') {
    query = query.contains('babs', [bab]);
  }

  const [subBabsResult, visibility] = await Promise.all([
    query,
    fetchVisibilitySettings(),
  ]);

  const { data, error } = subBabsResult;
  if (error || !data) return [];

  const rawSubBabs = data.flatMap((q: any) => {
    const val = q.sub_babs || [];
    return Array.isArray(val) ? val : [val];
  }).filter(Boolean);

  const seen = new Map<string, string>();
  for (const raw of rawSubBabs) {
    const slug = normalizeCategorySlug(String(raw));
    if (slug && !seen.has(slug)) {
      seen.set(slug, String(raw));
    }
  }

  return Array.from(seen.entries())
    .filter(([slug]) => !visibility.hidden_sub_babs.includes(slug) && !visibility.admin_only_sub_babs.includes(slug))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, raw]) => ({ value: raw, label: categorySlugToLabel(slug) }));
}

export async function fetchSubBabsAdmin(bab?: string | string[]): Promise<SubBabInfo[]> {
  let query = supabase.from('public_categories').select('*');

  if (bab) {
    const babs = Array.isArray(bab) ? bab : [bab];
    const filteredBabs = babs.filter(b => b !== 'Semua BAB' && b !== 'None');
    if (filteredBabs.length > 0) {
      query = query.overlaps('babs', filteredBabs);
    }
  }

  const [subBabsResult, visibility] = await Promise.all([
    query,
    fetchVisibilitySettings(),
  ]);

  const { data, error } = subBabsResult;
  if (error || !data) return [];

  const rawSubBabs = data.flatMap((q: any) => {
    const val = q.sub_babs || [];
    return Array.isArray(val) ? val : [val];
  }).filter(Boolean);

  const seen = new Map<string, string>();
  for (const raw of rawSubBabs) {
    const slug = normalizeCategorySlug(String(raw));
    if (slug && !seen.has(slug)) {
      seen.set(slug, String(raw));
    }
  }

  return Array.from(seen.entries())
    .filter(([slug]) => !visibility.hidden_sub_babs.includes(slug))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, raw]) => ({ value: raw, label: categorySlugToLabel(slug) }));
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
    .map(([slug, raw]) => ({ value: raw, label: categorySlugToLabel(slug) }));
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
    .map(([slug, raw]) => ({ value: raw, label: categorySlugToLabel(slug) }));
}

export async function fetchQuestions(mapel?: string, bab?: string, subBab?: string): Promise<RawQuestion[]> {
  let query = supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, question_type, short_answer, is_hidden, mapels, babs, sub_babs');

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
  } catch (err: any) {
    console.error('start_exam_session action failed:', err.message);
    throw new Error(`Failed to start exam session: ${err.message}`);
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
    .select('id, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, question_type, short_answer, is_hidden, mapels, babs, sub_babs')
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


