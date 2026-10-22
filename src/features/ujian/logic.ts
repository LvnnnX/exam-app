// Logika murni ujian mandiri. Tanpa I/O, dipakai UI dan unit test.
import type { StartUjianInput } from './types';

export const QUESTION_PRESETS = [5, 10, 20, 25, 30, 40, 50, 100] as const;
export const MIN_QUESTIONS = 5;
/** Menit. 0 = tanpa batas waktu. */
export const TIME_LIMIT_OPTIONS = [0, 30, 60, 90, 120, 150, 180] as const;
export const SURVIVAL_LIVES = 3;
/** Batas lulus mode Exam (SRS FR-RES-004: score >= 70%). Survival tidak punya status lulus. */
export const PASS_PERCENT = 70;
export const VIOLATION_LIMIT = 3;
export const NAME_MAX = 16;

export interface PresetOption {
  value: number;
  enabled: boolean;
  /** Keterangan untuk preset yang disabled. */
  note: string | null;
}

export function presetOptions(available: number): PresetOption[] {
  return QUESTION_PRESETS.map((value) => ({
    value,
    enabled: value <= available,
    note: value <= available ? null : 'soal kurang',
  }));
}

/** Preset terbesar yang <= pilihan sebelumnya dan masih tersedia; null kalau soal < MIN_QUESTIONS. */
export function clampPreset(current: number | null, available: number): number | null {
  const ok = QUESTION_PRESETS.filter((p) => p <= available);
  if (ok.length === 0) return null;
  if (current === null) return ok[0];
  if (ok.includes(current as (typeof QUESTION_PRESETS)[number])) return current;
  const below = ok.filter((p) => p <= current);
  return below.length ? below[below.length - 1] : ok[0];
}

export function canStartExam(available: number): boolean {
  return available >= MIN_QUESTIONS;
}

export function cleanName(raw: string): string {
  return raw.trim().slice(0, NAME_MAX);
}

/** Validasi input setup. Return pesan error (bahasa Indonesia) atau null. Dipakai client dan server action. */
export function validateStart(input: StartUjianInput, available?: number): string | null {
  const name = input.name.trim();
  if (!name) return 'Nama wajib diisi.';
  if (name.length > NAME_MAX) return `Nama maksimal ${NAME_MAX} karakter.`;
  if (input.mode !== 'exam' && input.mode !== 'survival') return 'Mode tidak valid.';
  if (input.nav_mode !== 'strict' && input.nav_mode !== 'standard') return 'Navigasi tidak valid.';
  if (!Array.isArray(input.topic_ids) || input.topic_ids.length === 0) return 'Pilih minimal satu sub-bab.';
  if (!(TIME_LIMIT_OPTIONS as readonly number[]).includes(input.time_limit_minutes)) return 'Batas waktu tidak valid.';
  if (input.mode === 'exam') {
    if (input.question_count === null || !(QUESTION_PRESETS as readonly number[]).includes(input.question_count)) {
      return 'Jumlah soal tidak valid.';
    }
    if (available !== undefined && input.question_count > available) {
      return `Soal tersedia cuma ${available}.`;
    }
  }
  return null;
}

export function scorePercent(score: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((score / total) * 100);
}

export function isPassed(percent: number): boolean {
  return percent >= PASS_PERCENT;
}

/** UM-30: >=80 hijau, 60-79 biru, 40-59 oranye, <40 merah. */
export type ScoreTone = 'green' | 'blue' | 'orange' | 'red';
export function scoreTone(percent: number): ScoreTone {
  if (percent >= 80) return 'green';
  if (percent >= 60) return 'blue';
  if (percent >= 40) return 'orange';
  return 'red';
}

/** Cermin aturan server: salah = nyawa -1, habis = selesai. */
export function applySurvivalAnswer(lives: number, correct: boolean): { lives: number; gameOver: boolean } {
  const next = correct ? lives : Math.max(0, lives - 1);
  return { lives: next, gameOver: next === 0 };
}

/** Detik tersisa, memakai offset jam server supaya jam HP yang salah tidak memengaruhi. */
export function secondsLeft(expiresAt: string | null, serverNow: string, clientNowAtFetch: number, clientNow: number): number | null {
  if (!expiresAt) return null;
  const offset = new Date(serverNow).getTime() - clientNowAtFetch;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - (clientNow + offset)) / 1000));
}

export function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
