export type Visibility = 'shown' | 'hidden';

export type Subject = {
  id: string;
  name: string;
  slug: string;
  visibility: Visibility;
  sort_order: number;
  created_at: string;
};

export type Chapter = {
  id: string;
  subject_id: string;
  name: string;
  slug: string;
  visibility: Visibility;
  sort_order: number;
  created_at: string;
};

export type Topic = {
  id: string;
  chapter_id: string;
  name: string;
  slug: string;
  visibility: Visibility;
  sort_order: number;
  created_at: string;
  question_count?: number;
};

export type TopicNode = Topic & {
  question_count: number;
};

export type ChapterNode = Chapter & {
  topics: TopicNode[];
  question_count: number;
};

export type SubjectNode = Subject & {
  chapters: ChapterNode[];
  question_count: number;
};
