"use client";

import { useEffect } from 'react';
import { secureLoad } from '@/lib/security';
import { getSessionQuestionViaRpc, getSessionStateViaRpc, type BabInfo, type ShuffledQuestion } from '@/lib/questions';
import { getSafeMapels } from '@/app/actions/categories';
import { getScheduledExamRecapAction } from '@/app/actions/scheduled-exam';
import type { Answer, GameMode, ExamMode, RecapItem } from '@/app/hooks/examTypes';

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

type UseExamBootstrapArgs = {
  storageKeys: StorageKeys;
  setFetchError: (value: string | null) => void;
  setAvailableMapels: (value: BabInfo[]) => void;
  setMapels: (value: ((prev: string[]) => string[]) | string[]) => void;
  setIsLoading: (value: boolean) => void;
  setUserName: (value: string) => void;
  setIsRestored: (value: boolean) => void;
  setSessionId: (value: string | null) => void;
  setTotalQuestions: (value: number) => void;
  setBabs: (value: string[]) => void;
  setSubBabs: (value: string[]) => void;
  setGameMode: (value: GameMode) => void;
  setExamMode: (value: ExamMode) => void;
  setLives: (value: number) => void;
  setScore: (value: number) => void;
  setDoubtFlags: (value: boolean[]) => void;
  setStartTime: (value: number | null) => void;
  setEndTime: (value: number | null) => void;
  setExpiresAt: (value: string | null) => void;
  setTimeLimit: (value: number) => void;
  setAnswers: (value: Answer[]) => void;
  setCurrent: (value: number) => void;
  setStep: (value: number) => void;
  setCurrentQuestion: (value: ShuffledQuestion | null) => void;
  setIsScheduledExam: (value: boolean) => void;
  setScheduledExamTitle: (value: string) => void;
  setScheduledTimeLimitMinutes: (value: number) => void;
  setRecapData: (value: RecapItem[]) => void;
  setSaved: (value: boolean) => void;
};

export default function useExamBootstrap({
  storageKeys,
  setFetchError,
  setAvailableMapels,
  setMapels,
  setIsLoading,
  setUserName,
  setIsRestored,
  setSessionId,
  setTotalQuestions,
  setBabs,
  setSubBabs,
  setGameMode,
  setExamMode,
  setLives,
  setScore,
  setDoubtFlags,
  setStartTime,
  setEndTime,
  setExpiresAt,
  setTimeLimit,
  setAnswers,
  setCurrent,
  setStep,
  setCurrentQuestion,
  setIsScheduledExam,
  setScheduledExamTitle,
  setScheduledTimeLimitMinutes,
  setRecapData,
  setSaved,
}: UseExamBootstrapArgs) {
  useEffect(() => {
    const restoreState = async () => {
      const stored = {
        name: secureLoad<string>(storageKeys.NAME),
        step: secureLoad<number>(storageKeys.STEP),
        current: secureLoad<number>(storageKeys.CURRENT),
        answers: secureLoad<Answer[]>(storageKeys.ANSWERS),
        sessionId: secureLoad<string>(storageKeys.SESSION_ID),
        total: secureLoad<number>(storageKeys.TOTAL) || 0,
        mapels: secureLoad<string[]>(storageKeys.MAPELS) || [],
        babs: secureLoad<string[]>(storageKeys.BABS) || [],
        subBabs: secureLoad<string[]>(storageKeys.SUB_BABS) || [],
        startTime: secureLoad<number>(storageKeys.START_TIME),
        mode: secureLoad<GameMode>(storageKeys.MODE) || 'exam',
        lives: secureLoad<number>(storageKeys.LIVES) || 3,
        expiresAt: secureLoad<string>(storageKeys.EXPIRES_AT),
        timeLimit: secureLoad<number>(storageKeys.TIME_LIMIT) || 0,
        score: secureLoad<number>(storageKeys.SCORE) || 0,
        examMode: secureLoad<ExamMode>(storageKeys.EXAM_MODE) || 'strict',
        doubtFlags: secureLoad<boolean[]>(storageKeys.DOUBT_FLAGS) || [],
        isScheduledExam: secureLoad<boolean>(storageKeys.IS_SCHEDULED_EXAM) || false,
        scheduledExamTitle: secureLoad<string>(storageKeys.SCHEDULED_EXAM_TITLE) || '',
        scheduledTimeLimit: secureLoad<number>(storageKeys.SCHEDULED_TIME_LIMIT) || 0,
      };

      const loadMapels = async () => {
        try {
          setFetchError(null);
          const data = await getSafeMapels();
          if (data.length === 0) {
            console.warn('No mapels found in Supabase.');
          }
          setAvailableMapels(data);
          setMapels(prev => prev.filter(v => data.some((u: BabInfo) => u.value === v)));
        } catch (err: unknown) {
          console.error('Failed to load mapels:', err);
          setFetchError(err instanceof Error ? err.message : 'Failed to connect to server');
        }
      };

      window.__retryCategoryFetch = loadMapels;
      void loadMapels();

      if (stored.sessionId) {
        setIsLoading(true);
        try {
          const state = await getSessionStateViaRpc(stored.sessionId);

          if (!state || state.is_finished) {
            if (stored.name) setUserName(stored.name);

            // For scheduled exams, check if there's a stored recap in DB to show performance
            if (stored.isScheduledExam && stored.sessionId) {
              const recapData = await getScheduledExamRecapAction(stored.sessionId);
              if (recapData) {
                setUserName(recapData.name || stored.name || '');
                setSessionId(stored.sessionId);
                setIsScheduledExam(true);
                setScheduledExamTitle(stored.scheduledExamTitle || '');
                setTotalQuestions(recapData.total || stored.total || 0);
                setScore(recapData.score || 0);
                setRecapData(recapData.recap as RecapItem[]);
                setSaved(true);
                setStep(6);
                setMapels(stored.mapels || []);
                setBabs(stored.babs || []);
                setSubBabs(stored.subBabs || []);
                setGameMode(stored.mode || 'exam');
                setStartTime(new Date(recapData.started_at).getTime() || stored.startTime || null);
                setEndTime(new Date(recapData.submitted_at).getTime() || null);
                setIsRestored(true);
                return;
              }
            }

            setIsRestored(true);
            return;
          }

          setUserName(state.name || stored.name || '');
          setSessionId(stored.sessionId);
          setTotalQuestions(state.question_count);
          setMapels(state.mapel ? state.mapel.split(', ') : (stored.mapels || []));
          setBabs(state.bab ? state.bab.split(', ') : (stored.babs || []));
          setSubBabs(state.sub_bab ? state.sub_bab.split(', ') : (stored.subBabs || []));
          setGameMode((state.mode || stored.mode || 'exam') as GameMode);
          setExamMode(stored.examMode || 'strict');
          setLives(state.lives ?? stored.lives ?? 3);
          setScore(stored.score ?? 0);
          setDoubtFlags(stored.doubtFlags || Array(state.question_count).fill(false));
          setIsScheduledExam(stored.isScheduledExam || false);
          setScheduledExamTitle(stored.scheduledExamTitle || '');
          setScheduledTimeLimitMinutes(stored.scheduledTimeLimit || 0);
          if (stored.startTime) setStartTime(stored.startTime);
          setExpiresAt(stored.expiresAt || null);
          setTimeLimit(stored.timeLimit || 0);

          const newAnswers = Array(state.question_count).fill(null);
          if (state.user_answers) {
            Object.keys(state.user_answers).forEach((k) => {
              newAnswers[parseInt(k)] = state.user_answers?.[k] ?? null;
            });
          }
          setAnswers(newAnswers);

          let maxServerIndex = 0;
          if (state.user_answers) {
            for (let i = 0; i < state.question_count; i++) {
              if (state.user_answers[String(i)] != null) {
                maxServerIndex = i + 1;
              } else {
                break;
              }
            }
          }

          let restoreIndex = Math.max(stored.current ?? 0, maxServerIndex);
          if (restoreIndex > state.question_count) {
            restoreIndex = state.question_count;
          }

          setCurrent(restoreIndex);
          setStep(restoreIndex >= state.question_count ? 6 : 3);

          const question = await getSessionQuestionViaRpc(stored.sessionId, restoreIndex);
          setCurrentQuestion(question);
          setIsRestored(true);
        } catch (e) {
          console.error('Session restore failed:', e);
          setIsRestored(true);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (stored.name) {
        setUserName(stored.name);
      }
      setIsRestored(true);
    };

    void restoreState();
  }, [
    storageKeys,
    setFetchError,
    setAvailableMapels,
    setMapels,
    setIsLoading,
    setUserName,
    setIsRestored,
    setSessionId,
    setTotalQuestions,
    setBabs,
    setSubBabs,
    setGameMode,
    setExamMode,
    setLives,
    setScore,
    setDoubtFlags,
    setStartTime,
    setExpiresAt,
    setTimeLimit,
    setAnswers,
    setCurrent,
    setStep,
    setCurrentQuestion,
    setIsScheduledExam,
    setScheduledExamTitle,
    setScheduledTimeLimitMinutes,
  ]);
}
