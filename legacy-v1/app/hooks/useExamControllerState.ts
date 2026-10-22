"use client";

import { useState } from 'react';
import type {
  ShuffledQuestion,
  QuestionCount,
  BabInfo,
  SubBabInfo,
} from '@/lib/questions';
import type {
  Answer,
  GameMode,
  ExamMode,
  Feedback,
  RecapItem,
} from '@/app/hooks/examTypes';

export default function useExamControllerState() {
  const [userName, setUserName] = useState('');
  const [mapels, setMapels] = useState<string[]>([]);
  const [babs, setBabs] = useState<string[]>([]);
  const [subBabs, setSubBabs] = useState<string[]>([]);
  const [availableMapels, setAvailableMapels] = useState<BabInfo[]>([]);
  const [availableBabs, setAvailableBabs] = useState<BabInfo[]>([]);
  const [availableSubBabs, setAvailableSubBabs] = useState<SubBabInfo[]>([]);
  const [questionCount, setQuestionCount] = useState<QuestionCount>(20);
  const [step, setStep] = useState(1);
  const [current, setCurrent] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<ShuffledQuestion | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [score, setScore] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, setFetchError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>('exam');
  const [saveFailed, setSaveFailed] = useState(false);
  const [lives, setLives] = useState(3);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<Feedback>(null);
  const [recapData, setRecapData] = useState<RecapItem[]>([]);
  const [timeLimit, setTimeLimit] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeftDisplay, setTimeLeftDisplay] = useState('');
  const [examMode, setExamMode] = useState<ExamMode>('strict');
  const [doubtFlags, setDoubtFlags] = useState<boolean[]>([]);
  const [showNavPopup, setShowNavPopup] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [scheduledExamTitle, setScheduledExamTitle] = useState('');
  const [isScheduledExam, setIsScheduledExam] = useState(false);
  const [scheduledTimeLimitMinutes, setScheduledTimeLimitMinutes] = useState(0);

  return {
    userName,
    setUserName,
    mapels,
    setMapels,
    babs,
    setBabs,
    subBabs,
    setSubBabs,
    availableMapels,
    setAvailableMapels,
    availableBabs,
    setAvailableBabs,
    availableSubBabs,
    setAvailableSubBabs,
    questionCount,
    setQuestionCount,
    step,
    setStep,
    current,
    setCurrent,
    sessionId,
    setSessionId,
    totalQuestions,
    setTotalQuestions,
    currentQuestion,
    setCurrentQuestion,
    answers,
    setAnswers,
    score,
    setScore,
    saved,
    setSaved,
    saving,
    setSaving,
    isRestored,
    setIsRestored,
    isLoading,
    setIsLoading,
    setFetchError,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    gameMode,
    setGameMode,
    saveFailed,
    setSaveFailed,
    lives,
    setLives,
    showSurrenderConfirm,
    setShowSurrenderConfirm,
    feedbackResult,
    setFeedbackResult,
    recapData,
    setRecapData,
    timeLimit,
    setTimeLimit,
    expiresAt,
    setExpiresAt,
    timeLeftDisplay,
    setTimeLeftDisplay,
    examMode,
    setExamMode,
    doubtFlags,
    setDoubtFlags,
    showNavPopup,
    setShowNavPopup,
    showSubmitConfirm,
    setShowSubmitConfirm,
    scheduledExamTitle,
    setScheduledExamTitle,
    isScheduledExam,
    setIsScheduledExam,
    scheduledTimeLimitMinutes,
    setScheduledTimeLimitMinutes,
  };
}
