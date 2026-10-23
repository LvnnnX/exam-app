import ExcelJS from 'exceljs';
import { createServerSupabaseClient } from '@/src/lib/supabase-server';
import { sanitizeHtml } from '@/src/lib/sanitizer';
import { normalizeSlug } from '@/src/lib/slug';
import { requireActiveAdmin } from '@/src/features/auth/server';
import type { ImportPreviewRow, ImportResult, QuestionOption, QuestionType } from './types';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((c === ',' || c === ';') && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

export function parseCsvContent(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const rawHeaders = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    rawHeaders.forEach((h, idx) => {
      row[h] = cells[idx] || '';
    });
    rows.push(row);
  }
  return rows;
}

export async function parseXlsxBuffer(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: Record<string, string>[] = [];
  let headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    if (rowNumber === 1) {
      headers = values.map((v) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    } else {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        const val = values[idx];
        obj[h] = typeof val === 'object' && val && 'result' in val ? String(val.result ?? '') : String(val ?? '');
      });
      rows.push(obj);
    }
  });

  return rows;
}

export function buildPreviewRows(rawRows: Record<string, string>[]): ImportPreviewRow[] {
  return rawRows.map((r, idx) => {
    const rowNum = idx + 2;
    const rawType = (r.tipe || r.type || 'multiple_choice').toLowerCase();
    const type: QuestionType = rawType.includes('isian') || rawType.includes('short') ? 'short_answer' : 'multiple_choice';

    const bodyHtml = r.question_text || r.soal || r.body_html || '';
    const answerKey = (r.jawaban || r.kunci || r.answer_key || r.short_answer || '').trim();
    const mapel = r.mapel || r.subject || '';
    const bab = r.bab || r.chapter || '';
    const subBab = r.sub_bab || r.subbab || r.topic || '';

    const options: QuestionOption[] = type === 'multiple_choice'
      ? (['a', 'b', 'c', 'd', 'e'] as const)
          .map((letter) => {
            const key = `option_${letter}`;
            const val = r[key] || r[letter] || '';
            return { label: letter.toUpperCase() as QuestionOption['label'], text: val };
          })
          .filter((o) => o.text.trim().length > 0)
      : [];

    let error: string | undefined;
    if (!bodyHtml.trim()) error = 'Teks soal kosong';
    else if (!mapel.trim() || !bab.trim() || !subBab.trim()) error = 'Mapel, bab, dan sub-bab wajib ada';
    else if (type === 'multiple_choice' && options.length < 2) error = 'Pilihan ganda minimal 2 opsi';
    else if (!answerKey) error = 'Kunci jawaban kosong';

    return {
      row_num: rowNum,
      type,
      body_html: bodyHtml,
      options,
      answer_key: answerKey,
      explanation_html: r.explanation || r.pembahasan || null,
      subject_name: mapel.trim(),
      chapter_name: bab.trim(),
      topic_name: subBab.trim(),
      error,
    };
  });
}

// BS-08: Execute import. DEFAULT VISIBILITY IS ALWAYS 'hidden'.
export async function executeImport(rows: ImportPreviewRow[]): Promise<ImportResult> {
  const admin = await requireActiveAdmin();
  const supabase = await createServerSupabaseClient();

  const validRows = rows.filter((r) => !r.error);
  const result: ImportResult = { total: rows.length, imported: 0, failed: rows.length - validRows.length, errors: [] };

  rows.forEach((r) => {
    if (r.error) result.errors.push({ row: r.row_num, error: r.error });
  });

  if (!validRows.length) return result;

  // Cache categories
  const [subRes, chRes, topRes] = await Promise.all([
    supabase.from('subjects').select('id, name, slug'),
    supabase.from('chapters').select('id, subject_id, name, slug'),
    supabase.from('topics').select('id, chapter_id, name, slug'),
  ]);

  const subjectMap = new Map((subRes.data || []).map((s) => [s.slug, s.id]));
  const chapterMap = new Map((chRes.data || []).map((c) => [`${c.subject_id}::${c.slug}`, c.id]));
  const topicMap = new Map((topRes.data || []).map((t) => [`${t.chapter_id}::${t.slug}`, t.id]));

  // Get current max question id
  const { data: maxRow } = await supabase.from('questions').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
  let currentMaxId = maxRow?.id || 0;

  for (const row of validRows) {
    try {
      // 1. Resolve subject
      const subSlug = normalizeSlug(row.subject_name);
      let subjectId = subjectMap.get(subSlug);
      if (!subjectId) {
        const { data, error } = await supabase.from('subjects').insert({ name: row.subject_name, slug: subSlug }).select('id').single();
        if (error) throw error;
        subjectId = data.id;
        subjectMap.set(subSlug, subjectId);
      }

      // 2. Resolve chapter
      const chSlug = normalizeSlug(row.chapter_name);
      const chKey = `${subjectId}::${chSlug}`;
      let chapterId = chapterMap.get(chKey);
      if (!chapterId) {
        const { data, error } = await supabase.from('chapters').insert({ subject_id: subjectId, name: row.chapter_name, slug: chSlug }).select('id').single();
        if (error) throw error;
        chapterId = data.id;
        chapterMap.set(chKey, chapterId);
      }

      // 3. Resolve topic
      const topSlug = normalizeSlug(row.topic_name);
      const topKey = `${chapterId}::${topSlug}`;
      let topicId = topicMap.get(topKey);
      if (!topicId) {
        const { data, error } = await supabase.from('topics').insert({ chapter_id: chapterId, name: row.topic_name, slug: topSlug }).select('id').single();
        if (error) throw error;
        topicId = data.id;
        topicMap.set(topKey, topicId);
      }

      // 4. Insert question with DEFAULT VISIBILITY = 'hidden' (BS-08, HS-01)
      currentMaxId += 1;
      const cleanBody = sanitizeHtml(row.body_html.startsWith('<p>') ? row.body_html : `<p>${row.body_html}</p>`);
      const cleanOptions = row.options.map((o) => ({ label: o.label, text: sanitizeHtml(o.text) }));
      const cleanExp = row.explanation_html ? sanitizeHtml(row.explanation_html) : null;

      const { data: qData, error: qError } = await supabase.from('questions').insert({
        id: currentMaxId,
        type: row.type,
        body_html: cleanBody,
        options: cleanOptions,
        answer_key: row.answer_key,
        explanation_html: cleanExp,
        visibility: 'hidden', // HS-01 & BS-08
        created_by: admin.userId,
      }).select('id').single();

      if (qError) throw qError;

      // 5. Junction
      await supabase.from('question_topics').insert({ question_id: qData.id, topic_id: topicId });

      result.imported += 1;
    } catch (err: unknown) {
      result.failed += 1;
      result.errors.push({ row: row.row_num, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return result;
}
