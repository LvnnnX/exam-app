import { createServerSupabaseClient } from '@/src/lib/supabase-server';
import { sanitizeHtml } from '@/src/lib/sanitizer';
import { requireActiveAdmin } from '@/src/features/auth/server';
import type {
  QuestionFilter,
  QuestionInput,
  QuestionOption,
  QuestionRow,
  QuestionWithTopics,
} from './types';
import type { Visibility } from '@/src/features/kategori/types';

export async function listQuestions(filters: QuestionFilter = {}) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();

  const page = Math.max(1, filters.page || 1);
  const limit = Math.max(1, Math.min(100, filters.limit || 25)); // BS-01: 25 per page
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('questions')
    .select(`
      id, type, body_html, options, answer_key, explanation_html, visibility, archived_at, created_by, created_at, updated_at,
      question_topics!inner(
        topic_id,
        topics!inner(
          id, name, slug, visibility,
          chapter_id,
          chapters!inner(
            id, name, slug, visibility,
            subject_id,
            subjects!inner(id, name, slug, visibility)
          )
        )
      )
    `, { count: 'exact' });

  // BS-05: do not list archived questions
  query = query.is('archived_at', null);

  if (filters.exactId !== undefined && !Number.isNaN(filters.exactId)) {
    query = query.eq('id', filters.exactId);
  }

  if (filters.search && filters.search.trim()) {
    query = query.ilike('body_html', `%${filters.search.trim()}%`);
  }

  if (filters.type && filters.type !== 'all') {
    query = query.eq('type', filters.type);
  }

  if (filters.visibility && filters.visibility !== 'all') {
    query = query.eq('visibility', filters.visibility);
  }

  if (filters.topicIds && filters.topicIds.length > 0) {
    query = query.in('question_topics.topic_id', filters.topicIds);
  } else if (filters.chapterIds && filters.chapterIds.length > 0) {
    query = query.in('question_topics.topics.chapter_id', filters.chapterIds);
  } else if (filters.subjectIds && filters.subjectIds.length > 0) {
    query = query.in('question_topics.topics.chapters.subject_id', filters.subjectIds);
  }

  query = query.order('id', { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;

  type RawRow = QuestionRow & {
    question_topics: {
      topic_id: string;
      topics: {
        id: string;
        name: string;
        slug: string;
        visibility: string;
        chapter_id: string;
        chapters: {
          id: string;
          name: string;
          slug: string;
          visibility: string;
          subject_id: string;
          subjects: { id: string; name: string; slug: string; visibility: string };
        };
      };
    }[];
  };

  const rows: QuestionWithTopics[] = ((data as unknown as RawRow[]) || []).map((q) => ({
    id: q.id,
    type: q.type,
    body_html: q.body_html,
    options: (Array.isArray(q.options) ? q.options : []) as QuestionOption[],
    answer_key: q.answer_key,
    explanation_html: q.explanation_html,
    visibility: q.visibility,
    archived_at: q.archived_at,
    created_by: q.created_by,
    created_at: q.created_at,
    updated_at: q.updated_at,
    topics: (q.question_topics || []).map((qt) => ({
      topic_id: qt.topics.id,
      topic_name: qt.topics.name,
      chapter_id: qt.topics.chapters.id,
      chapter_name: qt.topics.chapters.name,
      subject_id: qt.topics.chapters.subjects.id,
      subject_name: qt.topics.chapters.subjects.name,
    })),
  }));

  return {
    rows,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function getQuestion(id: number): Promise<QuestionWithTopics | null> {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('questions')
    .select(`
      id, type, body_html, options, answer_key, explanation_html, visibility, archived_at, created_by, created_at, updated_at,
      question_topics(
        topic_id,
        topics(
          id, name, slug, visibility,
          chapter_id,
          chapters(
            id, name, slug, visibility,
            subject_id,
            subjects(id, name, slug, visibility)
          )
        )
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  type SingleRaw = QuestionRow & {
    question_topics: {
      topic_id: string;
      topics: {
        id: string;
        name: string;
        slug: string;
        visibility: string;
        chapter_id: string;
        chapters: {
          id: string;
          name: string;
          slug: string;
          visibility: string;
          subject_id: string;
          subjects: { id: string; name: string; slug: string; visibility: string };
        };
      } | null;
    }[];
  };

  const q = data as unknown as SingleRaw;
  return {
    id: q.id,
    type: q.type,
    body_html: q.body_html,
    options: (Array.isArray(q.options) ? q.options : []) as QuestionOption[],
    answer_key: q.answer_key,
    explanation_html: q.explanation_html,
    visibility: q.visibility,
    archived_at: q.archived_at,
    created_by: q.created_by,
    created_at: q.created_at,
    updated_at: q.updated_at,
    topics: (q.question_topics || []).filter((qt) => qt.topics !== null).map((qt) => ({
      topic_id: qt.topics!.id,
      topic_name: qt.topics!.name,
      chapter_id: qt.topics!.chapters.id,
      chapter_name: qt.topics!.chapters.name,
      subject_id: qt.topics!.chapters.subjects.id,
      subject_name: qt.topics!.chapters.subjects.name,
    })),
  };
}

export async function createQuestion(input: QuestionInput) {
  const admin = await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();

  // BS-03 validations
  const cleanBody = sanitizeHtml(input.body_html);
  if (!cleanBody || cleanBody === '<p></p>') throw new Error('Teks soal wajib diisi');
  if (!input.topic_ids || input.topic_ids.length === 0) throw new Error('Minimal pilih 1 sub-bab');
  if (!['multiple_choice', 'short_answer'].includes(input.type)) throw new Error('Tipe soal tidak valid');

  const cleanExplanation = input.explanation_html ? sanitizeHtml(input.explanation_html) : null;
  let cleanOptions: QuestionOption[] = [];
  const cleanAnswerKey = String(input.answer_key || '').trim();

  if (input.type === 'multiple_choice') {
    if (!['A', 'B', 'C', 'D', 'E'].includes(cleanAnswerKey)) {
      throw new Error('Kunci jawaban pilihan ganda harus A, B, C, D, atau E');
    }
    cleanOptions = (input.options || []).map((o) => ({
      label: o.label,
      text: sanitizeHtml(o.text),
    }));
    if (cleanOptions.length < 2) throw new Error('Pilihan ganda minimal memiliki 2 opsi');
  } else {
    if (!cleanAnswerKey) throw new Error('Kunci jawaban isian singkat wajib diisi');
    cleanOptions = [];
  }

  // Get next question id
  const { data: maxRow } = await supabase.from('questions').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
  const nextId = (maxRow?.id || 0) + 1;

  const { data: qData, error: qError } = await supabase.from('questions').insert({
    id: nextId,
    type: input.type,
    body_html: cleanBody,
    options: cleanOptions,
    answer_key: cleanAnswerKey,
    explanation_html: cleanExplanation,
    visibility: input.visibility || 'shown',
    created_by: admin.userId,
  }).select().single();

  if (qError) throw qError;

  // Insert topic junctions
  const topicInserts = input.topic_ids.map((tid) => ({ question_id: qData.id, topic_id: tid }));
  const { error: qtError } = await supabase.from('question_topics').insert(topicInserts);
  if (qtError) throw qtError;

  return qData;
}

export async function updateQuestion(id: number, input: Partial<QuestionInput>) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();

  type QuestionUpdate = {
    updated_at: string;
    body_html?: string;
    explanation_html?: string | null;
    type?: string;
    options?: QuestionOption[];
    answer_key?: string;
    visibility?: string;
  };

  const updates: QuestionUpdate = { updated_at: new Date().toISOString() };

  if (input.body_html !== undefined) {
    const clean = sanitizeHtml(input.body_html);
    if (!clean || clean === '<p></p>') throw new Error('Teks soal tidak boleh kosong');
    updates.body_html = clean;
  }

  if (input.explanation_html !== undefined) {
    updates.explanation_html = input.explanation_html ? sanitizeHtml(input.explanation_html) : null;
  }

  if (input.type !== undefined) updates.type = input.type;

  if (input.options !== undefined) {
    updates.options = input.options.map((o) => ({ label: o.label, text: sanitizeHtml(o.text) }));
  }

  if (input.answer_key !== undefined) {
    const k = String(input.answer_key).trim();
    if (!k) throw new Error('Kunci jawaban tidak boleh kosong');
    updates.answer_key = k;
  }

  if (input.visibility !== undefined) updates.visibility = input.visibility;

  const { data, error } = await supabase.from('questions').update(updates).eq('id', id).select().single();
  if (error) throw error;

  if (input.topic_ids && input.topic_ids.length > 0) {
    await supabase.from('question_topics').delete().eq('question_id', id);
    const inserts = input.topic_ids.map((tid) => ({ question_id: id, topic_id: tid }));
    await supabase.from('question_topics').insert(inserts);
  }

  return data;
}

// BS-05: Hapus soal. Kalau pernah dipakai di kuis atau ujian, arsipkan (archived_at).
export async function deleteQuestion(id: number) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();

  const [inQuizRes, inExamRes, inAnsRes] = await Promise.all([
    supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('question_id', id),
    supabase.from('exam_answers').select('id', { count: 'exact', head: true }).eq('question_id', id),
    supabase.from('answers').select('id', { count: 'exact', head: true }).eq('question_id', id),
  ]);

  const usedCount = (inQuizRes.count || 0) + (inExamRes.count || 0) + (inAnsRes.count || 0);

  if (usedCount > 0) {
    // Soft delete / archive
    const { error } = await supabase.from('questions').update({ archived_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    return { archived: true, message: `Soal pernah dipakai di kuis/ujian (${usedCount} kali). Soal telah diarsipkan, tidak dihapus permanen.` };
  }

  // Hard delete
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) throw error;
  return { archived: false, message: 'Soal berhasil dihapus permanen.' };
}

// HS-06: Check if question is in an active/paused quiz
export async function checkActiveQuizConflict(questionIds: number[]): Promise<string[]> {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();
  if (!questionIds.length) return [];

  const { data } = await supabase
    .from('quiz_questions')
    .select('question_id, quizzes!inner(code, status)')
    .in('question_id', questionIds)
    .in('quizzes.status', ['active', 'paused']);

  type ConflictRow = { question_id: number; quizzes: { code: string; status: string } };
  const conflicts = (data as unknown as ConflictRow[]) || [];
  return conflicts.map((c) => `Soal #${c.question_id} sedang dipakai di kuis aktif (kode: ${c.quizzes.code}, status: ${c.quizzes.status})`);
}

// HS-04: Toggle per soal
export async function toggleQuestionVisibility(id: number, visibility: Visibility) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('questions').update({ visibility }).eq('id', id);
  if (error) throw error;
  return { success: true };
}

// HS-04: Toggle massal
export async function bulkToggleVisibility(ids: number[], visibility: Visibility) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();
  if (!ids.length) return { success: true, count: 0 };
  const { error } = await supabase.from('questions').update({ visibility }).in('id', ids);
  if (error) throw error;
  return { success: true, count: ids.length };
}
