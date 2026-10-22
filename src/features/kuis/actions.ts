'use server';

import { revalidatePath } from 'next/cache';
import {
  createQuiz,
  updateQuizStatus,
  joinLiveQuiz,
  getQuizQuestion,
  submitQuizAnswer,
  finishQuizPlayer,
  setPlayerSkin,
  getQuizStreamState,
  getPlayerAnswers,
  listActiveQuizzes,
  listQuizHistory,
} from './server';
import type { CreateQuizInput } from './types';

export async function createQuizAction(input: CreateQuizInput) {
  try {
    const res = await createQuiz(input);
    revalidatePath('/admin/kuis');
    return res;
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateQuizStatusAction(quizId: string, action: 'start' | 'pause' | 'resume' | 'finish' | 'cancel') {
  try {
    const res = await updateQuizStatus(quizId, action);
    revalidatePath('/admin/kuis');
    return res;
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function joinQuizAction(code: string, name: string) {
  try {
    const res = await joinLiveQuiz(code, name);
    return res;
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getQuizQuestionAction(playerId: string, index: number) {
  try {
    const question = await getQuizQuestion(playerId, index);
    return { success: true, question };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function submitQuizAnswerAction(
  playerId: string,
  index: number,
  questionId: number,
  userAnswer: string,
  timeTaken: number
) {
  try {
    const res = await submitQuizAnswer(playerId, index, questionId, userAnswer, timeTaken);
    return res;
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function finishQuizPlayerAction(playerId: string) {
  try {
    const res = await finishQuizPlayer(playerId);
    return res;
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function setPlayerSkinAction(playerId: string, skin: string) {
  try {
    const res = await setPlayerSkin(playerId, skin);
    return res;
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getQuizStateAction(code: string) {
  try {
    const state = await getQuizStreamState(code);
    return { success: true, state };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getPlayerAnswersAction(playerId: string) {
  try {
    const answers = await getPlayerAnswers(playerId);
    return { success: true, answers };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function refreshActiveQuizzesAction() {
  try {
    const quizzes = await listActiveQuizzes();
    return { success: true, quizzes };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function refreshQuizHistoryAction() {
  try {
    const history = await listQuizHistory();
    return { success: true, history };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
