export type Answer = string | null;

export type GameMode = 'exam' | 'survival';
export type ExamMode = 'strict' | 'standard';
export type Feedback = 'correct' | 'wrong' | null;

export type RecapItem = {
  question_id: number;
  user_answer: string | null;
  correct_text: string;
  is_correct: boolean;
  question_text: string;
};
