import { createServerSupabaseClient } from '@/src/lib/supabase-server';
import { normalizeSlug } from '@/src/lib/slug';
import { requireActiveAdmin } from '@/src/features/auth/server';
import type { SubjectNode, ChapterNode, TopicNode, Visibility } from './types';

export async function getCategoryTree(): Promise<SubjectNode[]> {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();

  const [subjectsRes, chaptersRes, topicsRes, qtRes] = await Promise.all([
    supabase.from('subjects').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('chapters').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('topics').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('question_topics').select('topic_id, question_id'),
  ]);

  if (subjectsRes.error) throw subjectsRes.error;
  if (chaptersRes.error) throw chaptersRes.error;
  if (topicsRes.error) throw topicsRes.error;

  const topicCountMap = new Map<string, Set<number>>();
  for (const row of qtRes.data || []) {
    let set = topicCountMap.get(row.topic_id);
    if (!set) {
      set = new Set();
      topicCountMap.set(row.topic_id, set);
    }
    set.add(row.question_id);
  }

  const topicsByChapter = new Map<string, TopicNode[]>();
  for (const t of topicsRes.data || []) {
    const qCount = topicCountMap.get(t.id)?.size || 0;
    const node: TopicNode = {
      ...t,
      visibility: t.visibility as Visibility,
      question_count: qCount,
    };
    const list = topicsByChapter.get(t.chapter_id) || [];
    list.push(node);
    topicsByChapter.set(t.chapter_id, list);
  }

  const chaptersBySubject = new Map<string, ChapterNode[]>();
  for (const c of chaptersRes.data || []) {
    const childTopics = topicsByChapter.get(c.id) || [];
    const chapterQuestionIds = new Set<number>();
    for (const t of childTopics) {
      const qIds = topicCountMap.get(t.id);
      if (qIds) qIds.forEach((id) => chapterQuestionIds.add(id));
    }
    const node: ChapterNode = {
      ...c,
      visibility: c.visibility as Visibility,
      topics: childTopics,
      question_count: chapterQuestionIds.size,
    };
    const list = chaptersBySubject.get(c.subject_id) || [];
    list.push(node);
    chaptersBySubject.set(c.subject_id, list);
  }

  const tree: SubjectNode[] = (subjectsRes.data || []).map((s) => {
    const childChapters = chaptersBySubject.get(s.id) || [];
    const subjectQuestionIds = new Set<number>();
    for (const ch of childChapters) {
      for (const t of ch.topics) {
        const qIds = topicCountMap.get(t.id);
        if (qIds) qIds.forEach((id) => subjectQuestionIds.add(id));
      }
    }
    return {
      ...s,
      visibility: s.visibility as Visibility,
      chapters: childChapters,
      question_count: subjectQuestionIds.size,
    };
  });

  return tree;
}

export async function toggleSubjectVisibility(id: string, visibility: Visibility) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('subjects').update({ visibility }).eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function toggleChapterVisibility(id: string, visibility: Visibility) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('chapters').update({ visibility }).eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function toggleTopicVisibility(id: string, visibility: Visibility) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from('topics').update({ visibility }).eq('id', id);
  if (error) throw error;
  return { success: true };
}

export async function createSubject(name: string, customSlug?: string) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nama mapel wajib diisi');
  const slug = customSlug ? normalizeSlug(customSlug) : normalizeSlug(trimmed);
  if (!slug) throw new Error('Slug mapel tidak valid');

  const { data, error } = await supabase.from('subjects').insert({ name: trimmed, slug }).select().single();
  if (error) throw error;
  return data;
}

export async function createChapter(subjectId: string, name: string, customSlug?: string) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nama bab wajib diisi');
  const slug = customSlug ? normalizeSlug(customSlug) : normalizeSlug(trimmed);
  if (!slug) throw new Error('Slug bab tidak valid');

  const { data, error } = await supabase.from('chapters').insert({ subject_id: subjectId, name: trimmed, slug }).select().single();
  if (error) throw error;
  return data;
}

export async function createTopic(chapterId: string, name: string, customSlug?: string) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nama sub-bab wajib diisi');
  const slug = customSlug ? normalizeSlug(customSlug) : normalizeSlug(trimmed);
  if (!slug) throw new Error('Slug sub-bab tidak valid');

  const { data, error } = await supabase.from('topics').insert({ chapter_id: chapterId, name: trimmed, slug }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTopic(topicId: string) {
  await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase.from('question_topics').select('*', { count: 'exact', head: true }).eq('topic_id', topicId);
  if (count && count > 0) {
    throw new Error(`Tidak bisa menghapus sub-bab ini karena masih memiliki ${count} soal`);
  }
  const { error } = await supabase.from('topics').delete().eq('id', topicId);
  if (error) throw error;
  return { success: true };
}
