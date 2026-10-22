// Kontrak Fase 5 (ujian mandiri). BE (server.ts/actions.ts) dan FE (components/hooks) sama-sama import dari sini.

export type UjianMode = 'exam' | 'survival';
export type NavMode = 'strict' | 'standard';
export type SessionStatus = 'active' | 'finished' | 'expired' | 'abandoned';
export type EndReason = 'submit' | 'surrender' | 'time_up' | 'violation' | 'lives_out' | 'questions_out';
export type FinishReason = 'submit' | 'surrender' | 'time_up';
export type QuestionType = 'multiple_choice' | 'short_answer';

// Konstanta (QUESTION_PRESETS, TIME_LIMIT_OPTIONS, PASS_PERCENT, dst) ada di ./logic.ts supaya unit test jalan tanpa bundler.

export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export interface CategoryTopic {
  id: string;
  name: string;
  slug: string;
  question_count: number;
}
export interface CategoryChapter {
  id: string;
  name: string;
  slug: string;
  topics: CategoryTopic[];
}
export interface CategorySubject {
  id: string;
  name: string;
  slug: string;
  chapters: CategoryChapter[];
}

export interface TopicLabels {
  mapel: string[];
  bab: string[];
  sub_bab: string[];
}

export interface StartUjianInput {
  name: string;
  mode: UjianMode;
  /** Diabaikan server untuk survival (selalu strict). */
  nav_mode: NavMode;
  topic_ids: string[];
  /** Wajib salah satu QUESTION_PRESETS untuk exam, null untuk survival. */
  question_count: number | null;
  /** Salah satu TIME_LIMIT_OPTIONS. */
  time_limit_minutes: number;
}

/** secret cuma dikirim sekali di sini. Client simpan terenkripsi (src/lib/secure-storage.ts). */
export interface StartUjianResult {
  session_id: string;
  secret: string;
}

export interface AnswerMark {
  index: number;
  answered: boolean;
  doubtful: boolean;
}

export interface UjianState {
  session_id: string;
  name: string;
  mode: UjianMode;
  nav_mode: NavMode;
  status: SessionStatus;
  end_reason: EndReason | null;
  total: number;
  /** strict/survival: soal yang sedang tampil. standard: soal terakhir yang dibuka. */
  current_index: number;
  lives: number;
  /** null untuk exam yang masih aktif (skor tidak bocor sebelum selesai). */
  score: number | null;
  time_limit_minutes: number;
  started_at: string;
  /** null kalau tanpa batas waktu. */
  expires_at: string | null;
  /** Jam server saat respons dibuat, buat koreksi offset jam HP. */
  server_now: string;
  topics: TopicLabels;
  /** Exam saja. Tanpa isi jawaban benar/salah. */
  answers: AnswerMark[];
  violation_count: number;
}

/** Payload soal tanpa answer_key dan tanpa pembahasan. */
export interface UjianQuestion {
  index: number;
  total: number;
  id: number;
  type: QuestionType;
  body_html: string;
  options: { label: string; text: string }[];
  saved_answer: string | null;
  doubtful: boolean;
}

export interface SaveAnswerResult {
  saved_at: string;
  next_index: number;
  finished: boolean;
  /** Survival saja. */
  is_correct?: boolean;
  lives?: number;
  score?: number;
}

export interface FinishResult {
  status: SessionStatus;
  end_reason: EndReason | null;
  score: number;
  total: number;
  answered: number;
  /** Exam saja, null untuk survival. */
  percent: number | null;
}

export interface RecapItem {
  index: number;
  question_id: number;
  type: QuestionType;
  body_html: string;
  options: { label: string; text: string }[];
  user_answer: string | null;
  answer_key: string;
  is_correct: boolean;
  doubtful: boolean;
}

export interface UjianRecap {
  summary: FinishResult & {
    name: string;
    mode: UjianMode;
    nav_mode: NavMode;
    topics: TopicLabels;
    duration_seconds: number | null;
  };
  items: RecapItem[];
}

export interface AdminResultFilter {
  /** YYYY-MM-DD, inklusif, zona Asia/Makassar. */
  from?: string;
  to?: string;
  search?: string;
}

export interface AdminResultRow {
  id: string;
  name: string;
  mode: UjianMode;
  nav_mode: NavMode;
  topics_label: string;
  score: number;
  total: number;
  percent: number | null;
  /** null untuk survival. */
  passed: boolean | null;
  status: SessionStatus;
  end_reason: EndReason | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  has_answers: boolean;
}

export interface AdminResultDetail {
  row: AdminResultRow;
  items: (RecapItem & { explanation_html: string | null })[];
}
