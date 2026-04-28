import { supabase } from './supabase';
import { ensureHtmlDocument } from './rich-text';

const getUA = () => typeof window !== 'undefined' ? window.navigator.userAgent : 'server';

// Type for fetching distinct categories
export type CategoryInfo = {
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
  categories: string[];
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
 * Fetches the list of admin-hidden category values from the app_settings table.
 * Returns an empty array if the table doesn't exist yet or has no entry.
 */
export async function fetchHiddenCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('hidden_categories')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch hidden categories:', error.message);
    return [];
  }

  return (data?.hidden_categories as string[]) || [];
}

/**
 * Persists the hidden category list to the app_settings table.
 * Uses upsert so the row is created on first save.
 */
export async function saveHiddenCategories(hidden: string[]): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, hidden_categories: hidden }, { onConflict: 'id' });

  if (error) {
    console.error('Failed to save hidden categories:', error.message);
    throw new Error(`Failed to save settings: ${error.message}`);
  }
}

export async function fetchCategories(): Promise<CategoryInfo[]> {
  const [categoriesResult, dbHidden] = await Promise.all([
    supabase.from('questions').select('categories'),
    fetchHiddenCategories(),
  ]);

  const { data, error } = categoriesResult;

  if (error) {
    console.error('Failed to fetch categories:', error.message);
    return [];
  }

  // Deduplicate manually
  const uniqueCategories = Array.from(new Set(data.flatMap((q) => q.categories || [])));

  // Only filter categories explicitly hidden by the admin in app_settings
  return uniqueCategories
    .filter((cat) => !dbHidden.includes(cat))
    .map((cat) => {
      const label = cat
        .split('_')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return { value: cat, label };
    });
}


/** Returns ALL categories from the questions table with zero filtering.
 *  Used by the admin Settings page to allow toggling every category,
 *  including hard-hidden ones like 'bonus'. */
export async function fetchAllCategoriesAdmin(): Promise<CategoryInfo[]> {
  const { data, error } = await supabase.from('questions').select('categories');

  if (error) {
    console.error('Failed to fetch all categories (admin):', error.message);
    return [];
  }

  const uniqueCategories = Array.from(new Set(data.flatMap((q) => q.categories || []))).sort();

  return uniqueCategories.map((cat) => {
    const label = cat
      .split('_')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return { value: cat, label };
  });
}

export async function fetchQuestions(category?: string): Promise<RawQuestion[]> {
  let query = supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, categories');

  // We skip filtering if the chosen category is somehow the placeholder 'All Categories', or just filter normally.
  if (category && category !== 'All Categories') {
    query = query.contains('categories', [category]);
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

export async function startExamSessionViaRpc(name: string, category: string, mode: string, count: number, timeLimitMinutes: number): Promise<{ sessionId: string; total: number; expiresAt: string }> {
  const { data, error } = await supabase.rpc('start_exam_session', {
    p_name: name,
    p_category: category,
    p_mode: mode,
    p_count: count,
    p_time_limit_minutes: timeLimitMinutes > 0 ? timeLimitMinutes : null,
    p_user_agent: getUA()
  });

  if (error || !data) {
    console.error('start_exam_session rpc failed:', error?.message);
    throw new Error(`Failed to start exam session: ${error?.message}`);
  }

  return {
    sessionId: data.session_id,
    total: data.question_count,
    expiresAt: data.expires_at
  };
}

export async function getSessionStateViaRpc(sessionId: string): Promise<any> {
  const { data, error } = await supabase.rpc('get_session_state', {
    p_session_id: sessionId
  });

  if (error) {
    console.error('get_session_state rpc failed:', error.message);
    return null;
  }

  return data;
}

export async function getSessionQuestionViaRpc(sessionId: string, index: number): Promise<ShuffledQuestion | null> {
  const { data, error } = await supabase.rpc('get_session_question', {
    p_session_id: sessionId,
    p_index: index
  });

  if (error) {
    console.error('get_session_question rpc failed:', error.message);
    return null;
  }

  if (!data) return null;

  return shuffleOptions(data as PublicQuestion);
}

export async function saveSessionAnswerViaRpc(sessionId: string, index: number, answerText: string): Promise<any> {
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

  return data;
}

export async function submitSessionExamViaRpc(
  sessionId: string,
  endTime: string
): Promise<{ score: number, recap: any[], total_attempted: number }> {
  const { data, error } = await supabase.rpc('submit_session_exam', {
    p_session_id: sessionId,
    p_end_time: endTime
  });

  if (error) {
    console.error('submit_session_exam rpc failed:', error.message);
    throw new Error(`Failed to submit exam: ${error.message}`);
  }
  
  return data as { score: number, recap: any[], total_attempted: number };
}

// ==================== Fetch specific questions by IDs ====================

export async function fetchQuestionsByIds(ids: number[]): Promise<RawQuestion[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, categories')
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

function shuffleOptions(raw: PublicQuestion): ShuffledQuestion {
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


