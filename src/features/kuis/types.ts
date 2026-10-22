export type QuizStatus = 'waiting' | 'active' | 'paused' | 'finished' | 'cancelled';
export type QuizMode = 'strict' | 'standard';

export interface QuizConfig {
  duration_minutes: number;
  quiz_mode: QuizMode;
  allow_join_mid_game: boolean;
  question_count: number;
  topic_ids?: string[];
  sub_topic_weights?: Record<string, number>;
}

export interface Quiz {
  id: string;
  code: string;
  config: QuizConfig;
  status: QuizStatus;
  scheduled_at: string | null;
  started_at: string | null;
  paused_at: string | null;
  finished_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  quiz_id: string;
  user_id: string | null;
  name: string;
  skin: string | null;
  score: number;
  total_time: number;
  current_index: number;
  question_order: number[];
  joined_at: string;
  finished_at: string | null;
}

export interface Answer {
  id: string;
  player_id: string;
  question_id: number;
  user_answer: string | null;
  is_correct: boolean;
  time_taken: number;
  answered_at: string;
  violation_count: number;
}

export interface QuizQuestionJit {
  id: number;
  type: 'single' | 'multiple' | 'true_false' | 'short_answer';
  body_html: string;
  options: Array<{ id: string; text?: string; label?: string; [key: string]: unknown }> | null;
  index: number;
  total: number;
}

export interface LivePlayerProgress {
  id: string;
  name: string;
  skin: string | null;
  score: number;
  total_time: number;
  current_index: number;
  total_questions: number;
  is_finished: boolean;
  finished_at: string | null;
  joined_at: string;
  answers_count: number;
  /** true when the server masked score (standard mode, player not finished, viewer not admin) */
  score_hidden?: boolean;
}

export interface QuizStreamState {
  quiz: Quiz;
  players: LivePlayerProgress[];
  server_time: string;
}

export interface CreateQuizInput {
  topic_ids: string[];
  question_count: number;
  duration_minutes: number;
  quiz_mode: QuizMode;
  allow_join_mid_game: boolean;
  weights?: Record<string, number>;
}

export interface PlayerAnswerDetail {
  question_id: number;
  question_number: number;
  body_html: string;
  user_answer: string | null;
  correct_answer?: string | null;
  is_correct: boolean;
  time_taken: number;
}
