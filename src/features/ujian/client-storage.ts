// Kunci localStorage ujian mandiri. Isi cuma token sesi dan setup terakhir, tidak ada skor/jawaban/timer.
import { secureLoad, secureRemove, secureSave } from '@/src/lib/secure-storage';
import type { NavMode, UjianMode } from './types';

export interface SessionToken {
  sessionId: string;
  secret: string;
}

export interface LastSetup {
  name: string;
  mode: UjianMode;
  nav_mode: NavMode;
  subject_ids: string[];
  chapter_ids: string[];
  topic_ids: string[];
  question_count: number | null;
  time_limit_minutes: number;
}

const SESSION_KEY = 'ujian_session';
const SETUP_KEY = 'ujian_last_setup';

export const loadToken = () => {
  const t = secureLoad<SessionToken>(SESSION_KEY);
  return t && typeof t.sessionId === 'string' && typeof t.secret === 'string' ? t : null;
};
export const saveToken = (t: SessionToken) => secureSave(SESSION_KEY, t);
export const clearToken = () => secureRemove(SESSION_KEY);
export const loadLastSetup = () => secureLoad<LastSetup>(SETUP_KEY);
export const saveLastSetup = (s: LastSetup) => secureSave(SETUP_KEY, s);
