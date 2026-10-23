'use server';

// Pintu masuk client untuk ujian mandiri. Semua validasi input ulang di server.ts dan di RPC.
import {
  listCategories,
  countQuestions,
  startSession,
  getState,
  getQuestion,
  saveAnswer,
  reportViolation,
  finishSession,
  getRecap,
  adminListResults,
  adminGetDetail,
} from './server';
import type {
  ActionResult,
  AdminResultDetail,
  AdminResultFilter,
  AdminResultRow,
  CategorySubject,
  FinishReason,
  FinishResult,
  SaveAnswerResult,
  StartUjianInput,
  StartUjianResult,
  UjianQuestion,
  UjianRecap,
  UjianState,
} from './types';

async function wrap<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await fn() };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan' };
  }
}

export async function listUjianCategoriesAction(): Promise<ActionResult<CategorySubject[]>> {
  return wrap(() => listCategories());
}

/** Jumlah soal shown (distinct) di sub-bab terpilih, buat filter preset. */
export async function countUjianQuestionsAction(topicIds: string[]): Promise<ActionResult<number>> {
  return wrap(() => countQuestions(topicIds));
}

export async function startUjianAction(input: StartUjianInput): Promise<ActionResult<StartUjianResult>> {
  return wrap(() => startSession(input));
}

export async function getUjianStateAction(sessionId: string, secret: string): Promise<ActionResult<UjianState>> {
  return wrap(() => getState(sessionId, secret));
}

export async function getUjianQuestionAction(
  sessionId: string,
  secret: string,
  index: number
): Promise<ActionResult<UjianQuestion>> {
  return wrap(() => getQuestion(sessionId, secret, index));
}

/** answer null = skip/kosong. timeTaken dalam detik. */
export async function saveUjianAnswerAction(
  sessionId: string,
  secret: string,
  index: number,
  answer: string | null,
  doubtful: boolean,
  timeTaken: number
): Promise<ActionResult<SaveAnswerResult>> {
  return wrap(() => saveAnswer(sessionId, secret, index, answer, doubtful, timeTaken));
}

export async function reportUjianViolationAction(
  sessionId: string,
  secret: string
): Promise<ActionResult<{ violation_count: number; finished: boolean }>> {
  return wrap(() => reportViolation(sessionId, secret));
}

export async function finishUjianAction(
  sessionId: string,
  secret: string,
  reason: FinishReason
): Promise<ActionResult<FinishResult>> {
  return wrap(() => finishSession(sessionId, secret, reason));
}

export async function getUjianRecapAction(sessionId: string, secret: string): Promise<ActionResult<UjianRecap>> {
  return wrap(() => getRecap(sessionId, secret));
}

export async function adminListUjianResultsAction(filter: AdminResultFilter): Promise<ActionResult<AdminResultRow[]>> {
  return wrap(() => adminListResults(filter));
}

export async function adminGetUjianDetailAction(sessionId: string): Promise<ActionResult<AdminResultDetail>> {
  return wrap(() => adminGetDetail(sessionId));
}
