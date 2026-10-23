// Pure race-view logic: lane order, ranking, position, standard-mode score hiding.
// No React, no DOM: unit-tested in tests/unit/race_logic.test.ts.
import CryptoJS from 'crypto-js';

export type RaceQuizMode = 'strict' | 'standard';
export type RaceQuizStatus = 'waiting' | 'active' | 'paused' | 'finished' | 'cancelled';

export interface RacePlayerInput {
  id: string;
  name: string;
  skin: string | null;
  score: number;
  total_time: number;
  answers_count: number;
  is_finished: boolean;
  joined_at: string;
  score_hidden?: boolean;
}

export interface RaceQuizInput {
  status: RaceQuizStatus;
  config?: { quiz_mode?: RaceQuizMode; question_count?: number } | null;
}

export interface RaceLane {
  id: string;
  name: string;
  skin: string | null;
  /** null = hidden (standard mode, player still working) */
  score: number | null;
  answered: number;
  total: number;
  /** 0..1, drives translateX of the mount */
  progress: number;
  /** what progress is based on: correct answers, or answered count when score is hidden */
  basis: 'score' | 'answered';
  finished: boolean;
  /** null = no rank yet (score hidden) */
  rank: number | null;
}

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/** Score is hidden for a standard-mode player who has not finished while the quiz is still running. */
export function isScoreHidden(quiz: RaceQuizInput, p: Pick<RacePlayerInput, 'is_finished' | 'score_hidden'>): boolean {
  if (p.score_hidden) return true;
  return quiz.config?.quiz_mode === 'standard' && !p.is_finished && quiz.status !== 'finished';
}

/** KL-15 ranking: score desc, total_time asc, joined_at asc. */
export function compareRank(a: RacePlayerInput, b: RacePlayerInput): number {
  if (b.score !== a.score) return b.score - a.score;
  if (a.total_time !== b.total_time) return a.total_time - b.total_time;
  return time(a.joined_at) - time(b.joined_at);
}

/** Stable lane order: joined_at asc, id as tiebreak so equal timestamps never swap. */
export function compareLane(a: { joined_at: string; id: string }, b: { joined_at: string; id: string }): number {
  return time(a.joined_at) - time(b.joined_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Ranks only players whose score is visible. Hidden players get null, so the
 * rank badge cannot leak a hidden score through relative order.
 */
export function computeRanks(quiz: RaceQuizInput, players: RacePlayerInput[]): Map<string, number | null> {
  const ranks = new Map<string, number | null>();
  const visible = players.filter((p) => !isScoreHidden(quiz, p)).sort(compareRank);
  visible.forEach((p, i) => ranks.set(p.id, i + 1));
  for (const p of players) if (!ranks.has(p.id)) ranks.set(p.id, null);
  return ranks;
}

export function totalQuestions(quiz: RaceQuizInput): number {
  return Math.max(1, Math.floor(quiz.config?.question_count ?? 1));
}

const clamp01 = (n: number) => (n <= 0 ? 0 : n >= 1 ? 1 : n);
export const HIDDEN_PROGRESS_CAP = 0.95;

export function buildLanes(quiz: RaceQuizInput, players: RacePlayerInput[]): RaceLane[] {
  const total = totalQuestions(quiz);
  const ranks = computeRanks(quiz, players);
  return [...players].sort(compareLane).map((p) => {
    const hidden = isScoreHidden(quiz, p);
    const answered = Math.max(0, Math.min(total, p.answers_count));
    // Hidden lanes move by answered count but never touch the line before the
    // player presses finish, so reaching the line always means "done".
    const progress = hidden ? Math.min(clamp01(answered / total), HIDDEN_PROGRESS_CAP) : clamp01(p.score / total);
    return {
      id: p.id,
      name: p.name,
      skin: p.skin,
      score: hidden ? null : p.score,
      answered,
      total,
      progress,
      basis: hidden ? 'answered' : 'score',
      // Finish = player completed the quiz, or a visible perfect score (strict mode reaches the line).
      finished: p.is_finished || (!hidden && p.score >= total),
      rank: ranks.get(p.id) ?? null,
    };
  });
}

/** Text leaderboard for the aria-live list: ranked lanes first, then hidden ones in lane order. */
export function rankedList(lanes: RaceLane[]): RaceLane[] {
  const ranked = lanes.filter((l) => l.rank !== null).sort((a, b) => (a.rank as number) - (b.rank as number));
  return [...ranked, ...lanes.filter((l) => l.rank === null)];
}

/** Rank changes between two snapshots. Only players ranked in both count. */
export function rankChanges(
  prev: ReadonlyMap<string, number | null>,
  lanes: RaceLane[],
): Map<string, 'up' | 'down'> {
  const out = new Map<string, 'up' | 'down'>();
  for (const l of lanes) {
    const before = prev.get(l.id);
    if (before == null || l.rank === null || before === l.rank) continue;
    out.set(l.id, l.rank < before ? 'up' : 'down');
  }
  return out;
}

/**
 * Finish events fire once per player id. The first snapshot only primes the
 * tracker (players already finished when the view opens get no confetti).
 */
export function createFinishTracker() {
  const seen = new Set<string>();
  let primed = false;
  return (lanes: RaceLane[]): string[] => {
    const fresh: string[] = [];
    for (const l of lanes) {
      if (!l.finished || seen.has(l.id)) continue;
      seen.add(l.id);
      if (primed) fresh.push(l.id);
    }
    primed = true;
    return fresh;
  };
}

export interface MaskablePlayer {
  score: number;
  is_finished: boolean;
  joined_at: string;
  id: string;
  score_hidden?: boolean;
}

/**
 * Public alias of a player id. The real player_id is the only credential the
 * player RPCs check, so other students must never see it. Sync (crypto-js) so
 * the client can derive its own alias to find itself in the list.
 */
export function publicPlayerId(playerId: string): string {
  return CryptoJS.SHA256(`race:${playerId}`).toString().slice(0, 24);
}

/**
 * Server-side mask for non-admin viewers (stream + state route): ids become
 * public aliases; in standard mode an unfinished player's score is zeroed and
 * flagged; the array is re-sorted by joined_at so the DB's score ordering
 * cannot leak either.
 */
export function maskPlayersForPublic<T extends MaskablePlayer>(quiz: RaceQuizInput, players: T[]): T[] {
  const hide = quiz.config?.quiz_mode === 'standard' && quiz.status !== 'finished';
  return [...players].sort(compareLane).map((p) => {
    const id = publicPlayerId(p.id);
    return hide && !p.is_finished ? { ...p, id, score: 0, score_hidden: true } : { ...p, id, score_hidden: false };
  });
}
