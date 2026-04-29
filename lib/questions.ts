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
export const QUESTION_COUNTS = [5, 10, 20] as const;
export type QuestionCount = typeof QUESTION_COUNTS[number];

// Raw question shape from Supabase (also used as fallback)
export type RawQuestion = {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_answer: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  babs: string[];
  sub_babs: string[];
};

export type PublicQuestion = Omit<RawQuestion, 'correct_answer'>;

// A single shuffled option for rendering
export type ShuffledOption = {
  label: string;   // display label: 'A', 'B', 'C', 'D', 'E'
  text: string;     // the option text
};

// A fully prepared question with shuffled options
export type ShuffledQuestion = {
  id: number;
  question_text: string;
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

function normalizeRawQuestion(raw: RawQuestion): RawQuestion {
  return {
    ...raw,
    question_text: ensureHtmlDocument(String(raw.question_text ?? '')),
    option_a: ensureHtmlDocument(String(raw.option_a ?? '')),
    option_b: ensureHtmlDocument(String(raw.option_b ?? '')),
    option_c: ensureHtmlDocument(String(raw.option_c ?? '')),
    option_d: ensureHtmlDocument(String(raw.option_d ?? '')),
    option_e: ensureHtmlDocument(String(raw.option_e ?? '')),
    correct_answer: normalizeCorrectAnswer(raw.correct_answer),
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
  };
}

/**
 * Fetches the list of admin-hidden sub_bab values from the app_settings table.
 * Returns an empty array if the table doesn't exist yet or has no entry.
 */
export async function fetchHiddenSubBabs(): Promise<string[]> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('hidden_sub_babs')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch hidden sub_babs:', error.message);
    return [];
  }

  return (data?.hidden_sub_babs as string[]) || [];
}

/**
 * Persists the hidden sub_bab list to the app_settings table.
 * Uses upsert so the row is created on first save.
 */
export async function saveHiddenSubBabs(hidden: string[]): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, hidden_sub_babs: hidden }, { onConflict: 'id' });

  if (error) {
    console.error('Failed to save hidden sub_babs:', error.message);
    throw new Error(`Failed to save settings: ${error.message}`);
  }
}

export async function fetchbabs(): Promise<BabInfo[]> {
  const { data, error } = await supabase.from('questions').select('babs');

  if (error) {
    console.error('Failed to fetch babs:', error.message);
    return [];
  }

  const uniqueBabs = Array.from(
    new Set(data.flatMap((q) => (q.babs || []).map(normalizeCategorySlug)).filter(isSafeCategorySlug))
  ).sort();

  return uniqueBabs.map((hb) => ({ value: hb, label: categorySlugToLabel(hb) }));
}

export async function fetchSubBabs(bab?: string): Promise<SubBabInfo[]> {
  const query = bab && bab !== 'Semua BAB' && bab !== 'None'
    ? supabase.from('questions').select('sub_babs').contains('babs', [bab])
    : supabase.from('questions').select('sub_babs');

  const [subBabsResult, dbHidden] = await Promise.all([
    query,
    fetchHiddenSubBabs(),
  ]);

  const { data, error } = subBabsResult;

  if (error) {
    console.error('Failed to fetch sub babs:', error.message);
    return [];
  }

  const uniqueSubBabs = Array.from(new Set(data.flatMap((q) => q.sub_babs || [])))
    .map(normalizeCategorySlug)
    .filter(isSafeCategorySlug)
    .sort();

  return uniqueSubBabs
    .filter((sb) => !dbHidden.includes(sb))
    .map((sb) => ({ value: sb, label: categorySlugToLabel(sb) }));
}

/** 
 * Returns sub_babs belonging to ANY of the provided babs.
 */
export async function fetchSubBabsForMultiple(babs: string[]): Promise<SubBabInfo[]> {
  if (!babs || babs.length === 0) return [];

  const safeBabs = babs.map(normalizeCategorySlug).filter(isSafeCategorySlug);
  if (safeBabs.length === 0) return [];

  const { data, error } = await supabase
    .from('questions')
    .select('sub_babs')
    .or(safeBabs.map((hb) => `babs.cs.{${hb}}`).join(','));

  if (error) {
    console.error('Failed to fetch sub babs for multiple BABs:', error.message);
    return [];
  }

  const uniqueSubBabs = Array.from(new Set(data.flatMap((q) => q.sub_babs || [])))
    .map(normalizeCategorySlug)
    .filter(isSafeCategorySlug)
    .sort();

  return uniqueSubBabs.map((sb) => ({ value: sb, label: categorySlugToLabel(sb) }));
}

/** Returns ALL sub_babs from the questions table with zero filtering.
 *  Used by the admin Settings page to allow toggling every sub_bab. */
export async function fetchAllSubBabsAdmin(): Promise<SubBabInfo[]> {
  const { data, error } = await supabase.from('questions').select('sub_babs');

  if (error) {
    console.error('Failed to fetch all sub_babs (admin):', error.message);
    return [];
  }

  const uniqueSubBabs = Array.from(new Set(data.flatMap((q) => q.sub_babs || [])))
    .map(normalizeCategorySlug)
    .filter(isSafeCategorySlug)
    .sort();

  return uniqueSubBabs.map((sb) => ({ value: sb, label: categorySlugToLabel(sb) }));
}

export async function fetchQuestions(bab?: string, subBab?: string): Promise<RawQuestion[]> {
  let query = supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, babs, sub_babs');

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

export async function startExamSessionViaRpc(name: string, bab: string, subBab: string, mode: string, count: number, timeLimitMinutes: number): Promise<{ sessionId: string; total: number; expiresAt: string }> {
  const { data, error } = await supabase.rpc('start_exam_session', {
    p_name: name,
    p_bab: bab,
    p_sub_bab: subBab,
    p_mode: mode,
    p_count: count,
    p_time_limit_minutes: timeLimitMinutes > 0 ? timeLimitMinutes : null,
    p_user_agent: getUA()
  }).single();

  if (error || !data) {
    console.error('start_exam_session rpc failed:', error?.message);
    throw new Error(`Failed to start exam session: ${error?.message}`);
  }

  const session = data as StartExamSessionRpcRow;

  return {
    sessionId: session.session_id,
    total: session.question_count,
    expiresAt: session.expires_at
  };
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
    .select('id, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, babs, sub_babs')
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
    options,
    correct_label: 'HIDDEN',
  };
}


