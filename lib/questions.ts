import { supabase } from './supabase';
import { ensureHtmlDocument } from './rich-text';

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

// Categories hidden from user selection (still available in admin)
const HIDDEN_CATEGORIES = ['bonus'];

export async function fetchCategories(): Promise<CategoryInfo[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('categories');

  if (error) {
    console.error('Failed to fetch categories:', error.message);
    return [];
  }

  // Deduplicate manually 
  const uniqueCategories = Array.from(new Set(data.flatMap((q) => q.categories || [])));
  
  return uniqueCategories
    .filter((cat) => !HIDDEN_CATEGORIES.includes(cat))
    .map((cat) => {
      // Basic Title Casing for the display label: 'general_informatics' -> 'General Informatics'
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

export async function fetchPublicQuestions(category?: string): Promise<PublicQuestion[]> {
  let query = supabase
    .from('public_questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, option_e, categories');

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
    return [];
  }

  return data.map((q: any) => normalizePublicQuestion(q as PublicQuestion));
}

export async function checkAnswerViaRpc(questionId: number, answerText: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_answer', {
    p_question_id: questionId,
    p_answer_text: answerText
  });
  
  if (error) {
    console.error('check_answer rpc failed:', error.message);
    return false;
  }
  return !!data;
}

export async function submitExamViaRpc(
  name: string,
  category: string,
  mode: string,
  questionCount: number,
  answers: { question_id: number; user_answer: string | null }[],
  startTime: string,
  endTime: string
): Promise<number> {
  const { data, error } = await supabase.rpc('submit_exam', {
    p_name: name,
    p_category: category,
    p_mode: mode,
    p_question_count: questionCount,
    p_answers: answers,
    p_start_time: startTime,
    p_end_time: endTime
  });

  if (error) {
    console.error('submit_exam rpc failed:', error.message);
    throw new Error(`Failed to submit exam: ${error.message}`);
  }
  
  return data as number;
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

// ==================== Prepare Session Questions ====================

export function prepareSessionQuestions(pool: PublicQuestion[], count: number = 20): ShuffledQuestion[] {
  // Shuffle the entire pool
  const shuffledPool = fisherYatesShuffle(pool);

  // Slice to the desired count (max available)
  const selected = shuffledPool.slice(0, Math.min(count, shuffledPool.length));

  // Shuffle options within each selected question
  return selected.map(shuffleOptions);
}
