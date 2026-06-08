"use server";

import ExcelJS from 'exceljs';
import { requireAdmin } from '@/lib/admin-server';
import { hasPermission } from '@/lib/admin-permissions';
import { isSafeCategorySlug, normalizeCategorySlug } from '@/lib/categories';
import type { RawQuestion } from '@/lib/questions';

// Same column layout as export HEADERS
const HEADER_KEYS = [
  'id',
  'status',
  'tipe',
  'mapel',
  'bab',
  'sub_bab',
  'question_text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'option_e',
  'jawaban',
  'short_answer',
  'created_by',
  'updated_at',
] as const;

type ImportRow = Partial<Record<(typeof HEADER_KEYS)[number], string | number>>;

type ImportError = { row: number; message: string };

type ImportResult = {
  created: number;
  updated: number;
  errors: ImportError[];
  total: number;
};

// ── helpers ──────────────────────────────────────────────

function splitList(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function assertCategoryList(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error(`Invalid ${label}`);
  }
  if (
    value.some(
      (item) =>
        typeof item !== 'string' ||
        !isSafeCategorySlug(normalizeCategorySlug(item)),
    )
  ) {
    throw new Error(`Invalid ${label}`);
  }
}

function parseRow(row: ImportRow): RawQuestion | null {
  const tipe = String(row.tipe ?? '').trim().toLowerCase();
  const questionType: RawQuestion['question_type'] =
    tipe === 'isian' ? 'short_answer' : 'multiple_choice';

  const status = String(row.status ?? '').trim().toLowerCase();
  const isHidden = status === 'hidden';

  const questionText = String(row.question_text ?? '').trim();
  const optionA = String(row.option_a ?? '').trim();
  const optionB = String(row.option_b ?? '').trim();
  const optionC = String(row.option_c ?? '').trim();
  const optionD = String(row.option_d ?? '').trim();
  const optionE = String(row.option_e ?? '').trim();

  const jawaban = String(row.jawaban ?? '').trim().toUpperCase();

  // PG: jawaban must be A-E, Isian: use short_answer column
  const correctAnswer =
    questionType === 'multiple_choice' && ['A', 'B', 'C', 'D', 'E'].includes(jawaban)
      ? jawaban
      : 'A'; // default, will be overridden by validation

  const shortAnswer =
    questionType === 'short_answer'
      ? String(row.short_answer ?? '').trim()
      : '';

  const mapels = splitList(row.mapel);
  const babs = splitList(row.bab);

  // Sub-bab: use sub_bab column, optional
  const subBabs = splitList(row.sub_bab).length > 0 ? splitList(row.sub_bab) : [];

  // Validate required text
  if (!questionText || questionText.length > 10000) return null;

  // Validate categories
  try {
    assertCategoryList(mapels, 'MAPEL');
    assertCategoryList(babs, 'BAB');
    if (subBabs.length > 0) assertCategoryList(subBabs, 'Sub-bab');
  } catch {
    return null;
  }

  return {
    id: 0, // placeholder — actual ID read from Excel
    question_text: questionText,
    option_a: optionA,
    option_b: optionB,
    option_c: optionC,
    option_d: optionD,
    option_e: optionE,
    correct_answer: correctAnswer,
    question_type: questionType,
    short_answer: shortAnswer,
    is_hidden: isHidden,
    mapels,
    babs,
    sub_babs: subBabs,
  };
}

function buildPayload(q: RawQuestion): Omit<RawQuestion, 'id'> {
  const { id: _, ...payload } = q;
  return payload;
}

// ── main action ──────────────────────────────────────────

export async function importQuestionsAction(
  accessToken: string,
  fileBase64: string,
): Promise<ImportResult> {
  const { supabase, admin } = await requireAdmin(accessToken);

  const buffer = Buffer.from(fileBase64, 'base64');
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (workbook.xlsx.load as any)(buffer);

  const sheet = workbook.getWorksheet(1);
  if (!sheet) throw new Error('Worksheet tidak ditemukan di file Excel.');

  const canCreate = hasPermission(admin, 'question:create');
  const canUpdateAny = hasPermission(admin, 'question:update:any');
  const canUpdateOwn = hasPermission(admin, 'question:update:own');

  let created = 0;
  let updated = 0;
  const errors: ImportError[] = [];

  // Row 1 = header (skip), data starts row 2
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);

    // Read columns by position (match HEADER_KEYS order)
    const rawId = row.getCell(1).value;
    const rowData: ImportRow = {};
    for (let c = 0; c < HEADER_KEYS.length; c++) {
      const cellVal = row.getCell(c + 1).value;
      rowData[HEADER_KEYS[c]] = String(cellVal ?? '');
    }

    // Skip completely empty rows (all cells empty)
    const hasContent = Object.values(rowData).some(
      (v) => v !== '' && v !== null && v !== undefined,
    );
    if (!hasContent) continue;

    try {
      const parsed = parseRow(rowData);
      if (!parsed) {
        errors.push({ row: i, message: 'Data baris tidak valid (teks soal atau kategori kosong/invalid).' });
        continue;
      }

      const id = Number(rawId) || 0;
      const payload = buildPayload(parsed);

      if (id > 0) {
        // Update existing
        // Check permission: update:any OR (update:own AND question creator is this admin)
        if (!canUpdateAny && !canUpdateOwn) {
          errors.push({ row: i, message: 'Tidak punya izin untuk update soal.' });
          continue;
        }

        const { data: existing, error: fetchErr } = await supabase
          .from('questions')
          .select('created_by')
          .eq('id', id)
          .single();

        if (fetchErr || !existing) {
          errors.push({ row: i, message: `Soal ID ${id} tidak ditemukan.` });
          continue;
        }

        const isOwn =
          existing.created_by === admin.userId;
        if (!canUpdateAny && !(canUpdateOwn && isOwn)) {
          errors.push({ row: i, message: `Tidak punya izin untuk mengedit soal ID ${id} (bukan milikmu).` });
          continue;
        }

        const { error: updateErr } = await supabase
          .from('questions')
          .update(payload)
          .eq('id', id);

        if (updateErr) {
          errors.push({ row: i, message: updateErr.message });
          continue;
        }

        updated++;
      } else {
        // Create new
        if (!canCreate) {
          errors.push({ row: i, message: 'Tidak punya izin untuk membuat soal.' });
          continue;
        }

        const { error: insertErr } = await supabase
          .from('questions')
          .insert([{ ...payload, created_by: admin.userId }]);

        if (insertErr) {
          errors.push({ row: i, message: insertErr.message });
          continue;
        }

        created++;
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal memproses baris.';
      errors.push({ row: i, message: msg });
    }
  }

  return { created, updated, errors, total: created + updated };
}
