export const PREPARING_STEP = 25;

export const STORAGE_KEYS = {
  NAME: 'exam_name',
  STEP: 'exam_step',
  CURRENT: 'exam_current',
  ANSWERS: 'exam_answers',
  SESSION_ID: 'exam_session_id',
  TOTAL: 'exam_total_questions',
  MAPELS: 'exam_mapels',
  BABS: 'exam_babs',
  SUB_BABS: 'exam_sub_babs',
  START_TIME: 'exam_start_time',
  MODE: 'exam_mode',
  LIVES: 'exam_lives',
  EXPIRES_AT: 'exam_expires_at',
  TIME_LIMIT: 'exam_time_limit',
  SCORE: 'exam_score',
  EXAM_MODE: 'exam_exam_mode',
  DOUBT_FLAGS: 'exam_doubt_flags',
} as const;

export const TIME_LIMIT_OPTIONS = [
  { label: 'No Time', value: 0 },
  { label: '1 Minutes (debug)', value: 1 },
  { label: '30 Minutes', value: 30 },
  { label: '60 Minutes', value: 60 },
  { label: '90 Minutes', value: 90 },
  { label: '120 Minutes', value: 120 },
  { label: '150 Minutes', value: 150 },
  { label: '180 Minutes', value: 180 },
] as const;
