import { supabase } from './supabase';
import { ensureHtmlDocument } from './rich-text';

// Available categories
export const CATEGORIES = [
  { value: 'combinatorics', label: 'Combinatorics' },
  { value: 'coding', label: 'Coding' },
  { value: 'general_informatics', label: 'General Informatics' },
] as const;

export type CategoryValue = typeof CATEGORIES[number]['value'];

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
  category: string;
};

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

// Hardcoded fallback pool (used when Supabase is unreachable)
export const fallbackQuestions: RawQuestion[] = [
  { id: 1, question_text: 'What is the time complexity of binary search?', option_a: 'O(n)', option_b: 'O(log n)', option_c: 'O(n log n)', option_d: 'O(1)', option_e: 'O(n²)', correct_answer: 'B', category: 'coding' },
  { id: 2, question_text: 'Which data structure uses LIFO?', option_a: 'Queue', option_b: 'Stack', option_c: 'Array', option_d: 'Linked List', option_e: 'Tree', correct_answer: 'B', category: 'coding' },
  { id: 3, question_text: 'ACID in databases stands for?', option_a: 'Atomicity, Consistency, Isolation, Durability', option_b: 'Atomic, Consistency, Instant, Durability', option_c: 'Asynchronous, Consistent, Isolated, Durable', option_d: 'Atomicity, Concurrency, Isolation, Durability', option_e: 'Atomic, Consistency, Isolation, Durability', correct_answer: 'A', category: 'general_informatics' },
  { id: 4, question_text: 'Which SQL join returns left table all records?', option_a: 'INNER JOIN', option_b: 'LEFT OUTER JOIN', option_c: 'RIGHT OUTER JOIN', option_d: 'FULL OUTER JOIN', option_e: 'CROSS JOIN', correct_answer: 'B', category: 'general_informatics' },
  { id: 5, question_text: 'Which property does a primary key enforce?', option_a: 'Nullable', option_b: 'Duplicates Allowed', option_c: 'Not Null Only', option_d: 'Not Null and Unique', option_e: 'Indexed Only', correct_answer: 'D', category: 'general_informatics' },
  { id: 6, question_text: 'A hash collision occurs when?', option_a: 'Two distinct keys map to same hash', option_b: 'Two identical keys map to same value', option_c: 'Hash functions are perfect', option_d: 'Collision implies overflow', option_e: 'No such thing as collision', correct_answer: 'A', category: 'general_informatics' },
  { id: 7, question_text: 'In balanced BST, insertion takes?', option_a: 'O(1)', option_b: 'O(n)', option_c: 'O(log n)', option_d: 'O(n log n)', option_e: 'O(n²)', correct_answer: 'C', category: 'coding' },
  { id: 8, question_text: 'Which HTTP methods are idempotent?', option_a: 'POST', option_b: 'GET', option_c: 'PATCH', option_d: 'PUT', option_e: 'GET and PUT', correct_answer: 'E', category: 'coding' },
  { id: 9, question_text: 'Normalization aims to?', option_a: 'Increase redundancy', option_b: 'Reduce redundancy', option_c: 'Speed up queries', option_d: 'Cannot be achieved', option_e: 'Denormalize data', correct_answer: 'B', category: 'general_informatics' },
  { id: 10, question_text: 'Which sort has O(n log n) worst-case?', option_a: 'Bubble sort', option_b: 'Insertion sort', option_c: 'Selection sort', option_d: 'Merge sort', option_e: 'Quick sort', correct_answer: 'D', category: 'coding' },
  { id: 11, question_text: 'Which SQL clause filters rows?', option_a: 'GROUP BY', option_b: 'ORDER BY', option_c: 'WHERE', option_d: 'HAVING', option_e: 'LIMIT', correct_answer: 'C', category: 'general_informatics' },
  { id: 12, question_text: 'In memory, stack stores?', option_a: 'Dynamic memory', option_b: 'Function call frames and local variables', option_c: 'Always larger than heap', option_d: 'Same as heap', option_e: 'Global objects', correct_answer: 'B', category: 'general_informatics' },
  { id: 13, question_text: 'CSS property for text color?', option_a: 'background-color', option_b: 'color', option_c: 'font-size', option_d: 'text-color', option_e: 'font-weight', correct_answer: 'B', category: 'coding' },
  { id: 14, question_text: 'Which is safer for unknown types?', option_a: 'any', option_b: 'unknown', option_c: 'never', option_d: 'unknown | any', option_e: 'string', correct_answer: 'B', category: 'coding' },
  { id: 15, question_text: 'Which SQL function counts rows?', option_a: 'SUM', option_b: 'AVG', option_c: 'MAX', option_d: 'COUNT', option_e: 'TOTAL', correct_answer: 'D', category: 'general_informatics' },
  { id: 16, question_text: 'HTTP 201 indicates?', option_a: 'OK', option_b: 'Created', option_c: 'No Content', option_d: 'Bad Request', option_e: 'Not Found', correct_answer: 'B', category: 'coding' },
  { id: 17, question_text: 'In graph theory, a cycle is?', option_a: 'Path with unique vertices', option_b: 'Path starts and ends at same vertex', option_c: 'A tree', option_d: 'A connected component', option_e: 'A loop', correct_answer: 'B', category: 'general_informatics' },
  { id: 18, question_text: 'BFS time complexity is?', option_a: 'O(V)', option_b: 'O(E)', option_c: 'O(V+E)', option_d: 'O(V*E)', option_e: 'O(log V)', correct_answer: 'C', category: 'coding' },
  { id: 19, question_text: 'Database index improves?', option_a: 'Write performance', option_b: 'Memory usage', option_c: 'Query performance', option_d: 'Disk I/O', option_e: 'Both a and c', correct_answer: 'C', category: 'general_informatics' },
  { id: 20, question_text: 'Which NOT a JS primitive?', option_a: 'string', option_b: 'number', option_c: 'boolean', option_d: 'object', option_e: 'symbol', correct_answer: 'D', category: 'coding' },
  { id: 21, question_text: 'How many ways can 5 people be seated in a row?', option_a: '25', option_b: '120', option_c: '60', option_d: '24', option_e: '720', correct_answer: 'B', category: 'combinatorics' },
  { id: 22, question_text: 'What is 7 choose 3 (C(7,3))?', option_a: '21', option_b: '35', option_c: '42', option_d: '30', option_e: '28', correct_answer: 'B', category: 'combinatorics' },
  { id: 23, question_text: 'How many subsets does a set with 4 elements have?', option_a: '8', option_b: '12', option_c: '16', option_d: '4', option_e: '24', correct_answer: 'C', category: 'combinatorics' },
  { id: 24, question_text: 'What is the value of 0! (zero factorial)?', option_a: '0', option_b: '1', option_c: 'Undefined', option_d: 'Infinity', option_e: '-1', correct_answer: 'B', category: 'combinatorics' },
  { id: 25, question_text: 'How many diagonals does a hexagon have?', option_a: '6', option_b: '9', option_c: '12', option_d: '15', option_e: '3', correct_answer: 'B', category: 'combinatorics' },
];

// ==================== Fetch from Supabase with category filter ====================

export async function fetchQuestions(category?: string): Promise<RawQuestion[]> {
  let query = supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, category');

  if (category) {
    query = query.eq('category', category);
  }

  // Race the Supabase query against a 2-second timeout so placeholder
  // credentials fail fast instead of waiting for a DNS timeout.
  const timeout = new Promise<{ data: null; error: { message: string } }>((resolve) =>
    setTimeout(() => resolve({ data: null, error: { message: 'Fetch timeout (2s)' } }), 2000)
  );

  const { data, error } = await Promise.race([query, timeout]);

  if (error || !data || data.length === 0) {
    console.warn('Supabase fetch failed or empty, using fallback questions:', error?.message);
    // Filter fallback by category if specified
    const pool = category
      ? fallbackQuestions.filter(q => q.category === category)
      : fallbackQuestions;
    const fallbackPool = pool.length > 0 ? pool : fallbackQuestions;
    return fallbackPool.map(normalizeRawQuestion);
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

function shuffleOptions(raw: RawQuestion): ShuffledQuestion {
  const normalized = normalizeRawQuestion(raw);

  const originalOptions = [
    { originalLabel: 'A', text: normalized.option_a },
    { originalLabel: 'B', text: normalized.option_b },
    { originalLabel: 'C', text: normalized.option_c },
    { originalLabel: 'D', text: normalized.option_d },
    { originalLabel: 'E', text: normalized.option_e },
  ];

  const shuffledOpts = fisherYatesShuffle(originalOptions);

  let correctLabel = 'A';
  const options: ShuffledOption[] = shuffledOpts.map((opt, idx) => {
    const newLabel = LABELS[idx];
    if (opt.originalLabel === normalized.correct_answer) {
      correctLabel = newLabel;
    }
    return { label: newLabel, text: opt.text };
  });

  return {
    id: normalized.id,
    question_text: normalized.question_text,
    options,
    correct_label: correctLabel,
  };
}

// ==================== Prepare Session Questions ====================

export function prepareSessionQuestions(pool: RawQuestion[], count: number = 20): ShuffledQuestion[] {
  // Shuffle the entire pool
  const shuffledPool = fisherYatesShuffle(pool);

  // Slice to the desired count (max available)
  const selected = shuffledPool.slice(0, Math.min(count, shuffledPool.length));

  // Shuffle options within each selected question
  return selected.map(shuffleOptions);
}
