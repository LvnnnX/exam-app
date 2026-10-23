'use server';

import { revalidatePath } from 'next/cache';
import {
  toggleSubjectVisibility,
  toggleChapterVisibility,
  toggleTopicVisibility,
  createSubject,
  createChapter,
  createTopic,
  deleteTopic,
  getCategoryTree,
} from './server';
import type { Visibility } from './types';

export async function getCategoryTreeAction() {
  try {
    const tree = await getCategoryTree();
    return { success: true, tree };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleSubjectAction(id: string, visibility: Visibility) {
  try {
    await toggleSubjectVisibility(id, visibility);
    revalidatePath('/admin/kategori');
    revalidatePath('/admin/soal');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleChapterAction(id: string, visibility: Visibility) {
  try {
    await toggleChapterVisibility(id, visibility);
    revalidatePath('/admin/kategori');
    revalidatePath('/admin/soal');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleTopicAction(id: string, visibility: Visibility) {
  try {
    await toggleTopicVisibility(id, visibility);
    revalidatePath('/admin/kategori');
    revalidatePath('/admin/soal');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createSubjectAction(name: string, customSlug?: string) {
  try {
    const data = await createSubject(name, customSlug);
    revalidatePath('/admin/kategori');
    revalidatePath('/admin/soal');
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createChapterAction(subjectId: string, name: string, customSlug?: string) {
  try {
    const data = await createChapter(subjectId, name, customSlug);
    revalidatePath('/admin/kategori');
    revalidatePath('/admin/soal');
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createTopicAction(chapterId: string, name: string, customSlug?: string) {
  try {
    const data = await createTopic(chapterId, name, customSlug);
    revalidatePath('/admin/kategori');
    revalidatePath('/admin/soal');
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteTopicAction(topicId: string) {
  try {
    await deleteTopic(topicId);
    revalidatePath('/admin/kategori');
    revalidatePath('/admin/soal');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
