"use client";

import { useEffect } from 'react';
import { secureSave } from '@/lib/security';
import type { Answer, GameMode, ExamMode } from '@/app/hooks/examTypes';

type StorageKeys = {
  NAME: string;
  STEP: string;
  CURRENT: string;
  ANSWERS: string;
  SESSION_ID: string;
  TOTAL: string;
  MAPELS: string;
  BABS: string;
  SUB_BABS: string;
  START_TIME: string;
  MODE: string;
  LIVES: string;
  EXPIRES_AT: string;
  TIME_LIMIT: string;
  SCORE: string;
  EXAM_MODE: string;
  DOUBT_FLAGS: string;
  IS_SCHEDULED_EXAM: string;
  SCHEDULED_EXAM_TITLE: string;
  SCHEDULED_TIME_LIMIT: string;
};

type UseExamStorageSyncArgs = {
  storageKeys: StorageKeys;
  isRestored: boolean;
  userName: string;
  step: number;
  current: number;
  answers: Answer[];
  sessionId: string | null;
  totalQuestions: number;
  mapels: string[];
  babs: string[];
  subBabs: string[];
  startTime: number | null;
  gameMode: GameMode;
  lives: number;
  score: number;
  expiresAt: string | null;
  timeLimit: number;
  examMode: ExamMode;
  doubtFlags: boolean[];
  isScheduledExam: boolean;
  scheduledExamTitle: string;
  scheduledTimeLimitMinutes: number;
};

export default function useExamStorageSync({
  storageKeys,
  isRestored,
  userName,
  step,
  current,
  answers,
  sessionId,
  totalQuestions,
  mapels,
  babs,
  subBabs,
  startTime,
  gameMode,
  lives,
  score,
  expiresAt,
  timeLimit,
  examMode,
  doubtFlags,
  isScheduledExam,
  scheduledExamTitle,
  scheduledTimeLimitMinutes,
}: UseExamStorageSyncArgs) {
  useEffect(() => {
    if (!isRestored) return;
    if (userName) secureSave(storageKeys.NAME, userName);
    secureSave(storageKeys.STEP, step);
    secureSave(storageKeys.CURRENT, current);
    secureSave(storageKeys.ANSWERS, answers);
    secureSave(storageKeys.SESSION_ID, sessionId);
    secureSave(storageKeys.TOTAL, totalQuestions);
    secureSave(storageKeys.MAPELS, mapels);
    secureSave(storageKeys.BABS, babs);
    secureSave(storageKeys.SUB_BABS, subBabs);
    secureSave(storageKeys.START_TIME, startTime);
    secureSave(storageKeys.MODE, gameMode);
    secureSave(storageKeys.LIVES, lives);
    secureSave(storageKeys.SCORE, score);
    secureSave(storageKeys.EXPIRES_AT, expiresAt);
    secureSave(storageKeys.TIME_LIMIT, timeLimit);
    secureSave(storageKeys.EXAM_MODE, examMode);
    secureSave(storageKeys.DOUBT_FLAGS, doubtFlags);
    secureSave(storageKeys.IS_SCHEDULED_EXAM, isScheduledExam);
    secureSave(storageKeys.SCHEDULED_EXAM_TITLE, scheduledExamTitle);
    secureSave(storageKeys.SCHEDULED_TIME_LIMIT, scheduledTimeLimitMinutes);
  }, [
    isRestored,
    userName,
    step,
    current,
    answers,
    sessionId,
    totalQuestions,
    mapels,
    babs,
    subBabs,
    startTime,
    gameMode,
    lives,
    score,
    expiresAt,
    timeLimit,
    examMode,
    doubtFlags,
    storageKeys,
    isScheduledExam,
    scheduledExamTitle,
    scheduledTimeLimitMinutes,
  ]);
}
