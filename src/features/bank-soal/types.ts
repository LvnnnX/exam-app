import type { Visibility } from '@/src/features/kategori/types';

export type QuestionType = 'multiple_choice' | 'short_answer';

export type QuestionOption = {
  label: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
};

export type QuestionRow = {
  id: number;
  type: QuestionType;
  body_html: string;
  options: QuestionOption[];
  answer_key: string;
  explanation_html: string | null;
  visibility: Visibility;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuestionTopicInfo = {
  topic_id: string;
  topic_name: string;
  chapter_id: string;
  chapter_name: string;
  subject_id: string;
  subject_name: string;
};

export type QuestionWithTopics = QuestionRow & {
  topics: QuestionTopicInfo[];
};

export type QuestionFilter = {
  search?: string;
  exactId?: number;
  subjectIds?: string[];
  chapterIds?: string[];
  topicIds?: string[];
  type?: 'all' | QuestionType;
  visibility?: 'all' | Visibility;
  page?: number;
  limit?: number;
};

export type QuestionInput = {
  type: QuestionType;
  body_html: string;
  options?: QuestionOption[];
  answer_key: string;
  explanation_html?: string | null;
  visibility?: Visibility;
  topic_ids: string[];
};

export type ImportPreviewRow = {
  row_num: number;
  type: QuestionType;
  body_html: string;
  options: QuestionOption[];
  answer_key: string;
  explanation_html: string | null;
  subject_name: string;
  chapter_name: string;
  topic_name: string;
  error?: string;
};

export type ImportResult = {
  total: number;
  imported: number;
  failed: number;
  errors: { row: number; error: string }[];
};
