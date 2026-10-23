'use server';

import { revalidatePath } from 'next/cache';
import {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  toggleQuestionVisibility,
  bulkToggleVisibility,
  checkActiveQuizConflict,
  listQuestions,
} from './server';
import {
  parseCsvContent,
  parseXlsxBuffer,
  buildPreviewRows,
  executeImport,
} from './import';
import type { ImportPreviewRow, QuestionFilter, QuestionInput } from './types';
import type { Visibility } from '@/src/features/kategori/types';

export async function listQuestionsAction(filters: QuestionFilter = {}) {
  try {
    const res = await listQuestions(filters);
    return { success: true, ...res };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createQuestionAction(input: QuestionInput) {
  try {
    const data = await createQuestion(input);
    revalidatePath('/admin/soal');
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateQuestionAction(id: number, input: Partial<QuestionInput>) {
  try {
    const data = await updateQuestion(id, input);
    revalidatePath('/admin/soal');
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteQuestionAction(id: number) {
  try {
    const result = await deleteQuestion(id);
    revalidatePath('/admin/soal');
    return { success: true, ...result };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleQuestionAction(id: number, visibility: Visibility) {
  try {
    await toggleQuestionVisibility(id, visibility);
    revalidatePath('/admin/soal');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function bulkToggleAction(ids: number[], visibility: Visibility) {
  try {
    const result = await bulkToggleVisibility(ids, visibility);
    revalidatePath('/admin/soal');
    return { ...result };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function checkQuizConflictAction(ids: number[]) {
  try {
    const warnings = await checkActiveQuizConflict(ids);
    return { success: true, warnings };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function previewImportAction(formData: FormData): Promise<{ success: boolean; rows?: ImportPreviewRow[]; error?: string }> {
  try {
    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: 'File tidak ditemukan' };

    const name = file.name.toLowerCase();
    let rawRows: Record<string, string>[] = [];

    if (name.endsWith('.csv')) {
      const text = await file.text();
      rawRows = parseCsvContent(text);
    } else if (name.endsWith('.xlsx')) {
      const arrayBuffer = await file.arrayBuffer();
      rawRows = await parseXlsxBuffer(Buffer.from(arrayBuffer));
    } else {
      return { success: false, error: 'Format file harus CSV atau XLSX' };
    }

    if (!rawRows.length) {
      return { success: false, error: 'File kosong atau tidak memiliki baris data' };
    }

    const preview = buildPreviewRows(rawRows);
    return { success: true, rows: preview };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function executeImportAction(rows: ImportPreviewRow[]) {
  try {
    const result = await executeImport(rows);
    revalidatePath('/admin/soal');
    return { success: true, result };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
