"use server";

import ExcelJS from 'exceljs';
import { requireAdmin } from '@/lib/admin-server';
import { stripHtml } from '@/lib/rich-text';
import type { QuestionFilters } from '@/app/actions/admin/questions';

type ExportRow = {
  id: number;
  status: string;
  tipe: string;
  mapel: string;
  bab: string;
  sub_bab: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  jawaban: string;
  short_answer: string;
  created_by: string;
  updated_at: string;
};

const HEADERS: { key: keyof ExportRow; label: string; width: number }[] = [
  { key: 'id', label: 'ID', width: 8 },
  { key: 'status', label: 'Status', width: 10 },
  { key: 'tipe', label: 'Tipe', width: 10 },
  { key: 'mapel', label: 'Mapel', width: 16 },
  { key: 'bab', label: 'Bab', width: 16 },
  { key: 'sub_bab', label: 'Sub-bab', width: 16 },
  { key: 'question_text', label: 'Teks Soal', width: 50 },
  { key: 'option_a', label: 'Opsi A', width: 30 },
  { key: 'option_b', label: 'Opsi B', width: 30 },
  { key: 'option_c', label: 'Opsi C', width: 30 },
  { key: 'option_d', label: 'Opsi D', width: 30 },
  { key: 'option_e', label: 'Opsi E', width: 30 },
  { key: 'jawaban', label: 'Jawaban', width: 14 },
  { key: 'short_answer', label: 'Jawaban Singkat', width: 20 },
  { key: 'created_by', label: 'Dibuat Oleh', width: 20 },
  { key: 'updated_at', label: 'Update Terakhir', width: 20 },
];

function formatDate(value?: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function questionToRow(question: Record<string, unknown>): ExportRow {
  const tipe = question.question_type === 'short_answer' ? 'Isian' : 'PG';
  const status = question.is_hidden ? 'Hidden' : 'Visible';
  const join = (val: unknown) => (Array.isArray(val) ? val.join(', ') : String(val ?? ''));
  const jawaban = tipe === 'PG'
    ? String(question.correct_answer ?? '')
    : String(question.short_answer ?? '');

  return {
    id: Number(question.id),
    status,
    tipe,
    mapel: join(question.mapels),
    bab: join(question.babs),
    sub_bab: join(question.sub_babs),
    question_text: stripHtml(String(question.question_text ?? '')),
    option_a: stripHtml(String(question.option_a ?? '')),
    option_b: stripHtml(String(question.option_b ?? '')),
    option_c: stripHtml(String(question.option_c ?? '')),
    option_d: stripHtml(String(question.option_d ?? '')),
    option_e: stripHtml(String(question.option_e ?? '')),
    jawaban,
    short_answer: tipe === 'Isian' ? String(question.short_answer ?? '') : '',
    created_by: String(question.creator_username || question.created_by || ''),
    updated_at: formatDate(question.updated_at as string | null),
  };
}

export async function exportQuestionsAction(
  accessToken: string,
  filters: QuestionFilters
): Promise<{ bufferBase64: string; filename: string; total: number }> {
  const { supabase } = await requireAdmin(accessToken);

  // Build query (same logic as fetchQuestionsPaginatedAction)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from('questions').select('*');

  if (filters.mapels && filters.mapels.length > 0) {
    query = query.overlaps('mapels', filters.mapels);
  }
  if (filters.babs && filters.babs.length > 0) {
    query = query.overlaps('babs', filters.babs);
  }
  if (filters.subBabs && filters.subBabs.length > 0) {
    query = query.overlaps('sub_babs', filters.subBabs);
  }
  if (filters.questionType && filters.questionType !== 'all') {
    query = query.eq('question_type', filters.questionType);
  }
  if (filters.visibility === 'visible') {
    query = query.eq('is_hidden', false);
  } else if (filters.visibility === 'hidden') {
    query = query.eq('is_hidden', true);
  }
  if (filters.searchQuery && filters.searchQuery.trim()) {
    const safeTerm = filters.searchQuery
      .trim()
      .replace(/[,()*%\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 200);
    if (safeTerm) {
      const pattern = `%${safeTerm}%`;
      query = query.or(
        [
          `question_text.ilike.${pattern}`,
          `option_a.ilike.${pattern}`,
          `option_b.ilike.${pattern}`,
          `option_c.ilike.${pattern}`,
          `option_d.ilike.${pattern}`,
          `option_e.ilike.${pattern}`,
          `short_answer.ilike.${pattern}`,
        ].join(',')
      );
    }
  }

  const sortAscending = filters.sortOrder === 'asc';
  query = query.order('created_at', { ascending: sortAscending });

  const { data: questions, error } = await query;

  if (error) throw new Error(error.message);
  if (!questions || questions.length === 0) {
    throw new Error('Tidak ada soal untuk diexport dengan filter ini.');
  }

  const rows = questions.map(questionToRow);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Soal');

  // Header style
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E5FA8' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    },
  };

  // Header row
  const headerRow = sheet.addRow(HEADERS.map(h => h.label));
  headerRow.height = 28;
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.style = headerStyle as ExcelJS.Style;
  });

  // Data rows
  for (const row of rows) {
    const values = HEADERS.map(h => row[h.key]);
    const dataRow = sheet.addRow(values);
    dataRow.alignment = { vertical: 'middle', wrapText: true };

    for (let i = 1; i <= values.length; i++) {
      dataRow.getCell(i).border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    }
  }

  // Column widths
  HEADERS.forEach((h, i) => {
    sheet.getColumn(i + 1).width = h.width;
  });

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto-filter
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: HEADERS.length },
  };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const bufferBase64 = Buffer.from(buffer).toString('base64');

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `bank-soal-${dateStr}.xlsx`;

  return { bufferBase64, filename, total: rows.length };
}
