"use server";

import ExcelJS from 'exceljs';
import { requireAdmin } from '@/lib/admin-server';
import { hasPermission } from '@/lib/admin-permissions';
import { isSafeCategorySlug, normalizeCategorySlug } from '@/lib/categories';
import { stripHtml } from '@/lib/rich-text';
import type { RawQuestion } from '@/lib/questions';

const ANSWER_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

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

function buildPayload(q: RawQuestion): Omit<RawQuestion, 'id'> {
  const { id: _, ...payload } = q;
  return payload;
}

// Treat a cell as "filled" if it has visible text or embedded media (img/iframe).
function hasContentValue(raw: unknown): boolean {
  const str = String(raw ?? '');
  if (/<(img|iframe)[^>]*>/i.test(str)) return true;
  return stripHtml(str).trim().length > 0;
}

type ParseOutcome =
  | { ok: true; question: RawQuestion }
  | { ok: false; reason: string };

function parseRow(row: ImportRow): ParseOutcome {
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
  const shortAnswerRaw = stripHtml(String(row.short_answer ?? '')).trim();

  const mapels = splitList(row.mapel);
  const babs = splitList(row.bab);
  const subBabs = splitList(row.sub_bab).length > 0 ? splitList(row.sub_bab) : [];

  // Required: question text (text or media)
  if (!hasContentValue(questionText) || questionText.length > 10000) {
    return { ok: false, reason: 'Teks soal kosong atau melebihi 10000 karakter.' };
  }

  // Categories required for every question type
  try {
    assertCategoryList(mapels, 'MAPEL');
    assertCategoryList(babs, 'BAB');
    if (subBabs.length > 0) assertCategoryList(subBabs, 'Sub-bab');
  } catch {
    return { ok: false, reason: 'Mapel / Bab / Sub-bab kosong atau tidak valid.' };
  }

  let correctAnswer: string;
  let shortAnswer: string;
  let optA = optionA;
  let optB = optionB;
  let optC = optionC;
  let optD = optionD;
  let optE = optionE;

  if (questionType === 'multiple_choice') {
    // PG: all five options must be filled; Jawaban must be A-E. short_answer ignored.
    const missingOption = [optionA, optionB, optionC, optionD, optionE].some(
      (opt) => !hasContentValue(opt),
    );
    if (missingOption) {
      return { ok: false, reason: 'Soal Pilihan Ganda wajib mengisi semua opsi A-E.' };
    }
    if (!ANSWER_LABELS.includes(jawaban as (typeof ANSWER_LABELS)[number])) {
      return { ok: false, reason: 'Kolom Jawaban soal Pilihan Ganda harus salah satu dari A, B, C, D, atau E.' };
    }
    correctAnswer = jawaban;
    shortAnswer = '';
  } else {
    // Isian: short_answer required; options ignored (cleared). Jawaban column also
    // accepted as the short answer for convenience (export puts it in `jawaban`).
    const answer = shortAnswerRaw || (jawaban ? String(row.jawaban ?? '').trim() : '');
    if (!answer) {
      return { ok: false, reason: 'Soal Isian wajib mengisi kolom Jawaban Singkat (atau Jawaban).' };
    }
    correctAnswer = 'A'; // placeholder, unused for short_answer
    shortAnswer = answer;
    optA = '';
    optB = '';
    optC = '';
    optD = '';
    optE = '';
  }

  return {
    ok: true,
    question: {
      id: 0, // placeholder — actual ID read from Excel
      question_text: questionText,
      option_a: optA,
      option_b: optB,
      option_c: optC,
      option_d: optD,
      option_e: optE,
      correct_answer: correctAnswer,
      question_type: questionType,
      short_answer: shortAnswer,
      is_hidden: isHidden,
      mapels,
      babs,
      sub_babs: subBabs,
    },
  };
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
      if (!parsed.ok) {
        errors.push({ row: i, message: parsed.reason });
        continue;
      }

      const id = Number(rawId) || 0;
      const payload = buildPayload(parsed.question);

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
