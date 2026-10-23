import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLanes,
  compareRank,
  computeRanks,
  createFinishTracker,
  HIDDEN_PROGRESS_CAP,
  isScoreHidden,
  maskPlayersForPublic,
  publicPlayerId,
  rankChanges,
  rankedList,
  type RacePlayerInput,
  type RaceQuizInput,
} from '../../src/features/race/logic.ts';

const t0 = Date.parse('2026-10-22T08:00:00Z');
const at = (s: number) => new Date(t0 + s * 1000).toISOString();

function player(id: string, joinSec: number, over: Partial<RacePlayerInput> = {}): RacePlayerInput {
  return { id, name: id, skin: 'ember:horse', score: 0, total_time: 0, answers_count: 0, is_finished: false, joined_at: at(joinSec), ...over };
}
const strict = (status: RaceQuizInput['status'] = 'active', n = 5): RaceQuizInput => ({ status, config: { quiz_mode: 'strict', question_count: n } });
const standard = (status: RaceQuizInput['status'] = 'active', n = 5): RaceQuizInput => ({ status, config: { quiz_mode: 'standard', question_count: n } });

describe('race: ranking', () => {
  it('orders by score desc, total_time asc, joined_at asc', () => {
    const ps = [
      player('late', 30, { score: 3, total_time: 20 }),
      player('slow', 10, { score: 3, total_time: 40 }),
      player('top', 20, { score: 4, total_time: 99 }),
      player('early', 5, { score: 3, total_time: 20 }),
    ];
    assert.deepEqual([...ps].sort(compareRank).map((p) => p.id), ['top', 'early', 'late', 'slow']);
    const r = computeRanks(strict(), ps);
    assert.equal(r.get('top'), 1);
    assert.equal(r.get('early'), 2);
    assert.equal(r.get('slow'), 4);
  });
});

describe('race: lanes', () => {
  it('lane order follows joined_at and stays put when scores change', () => {
    const ps = [player('c', 30), player('a', 10), player('b', 20)];
    const before = buildLanes(strict(), ps).map((l) => l.id);
    ps[2].score = 5; // c leads now
    const after = buildLanes(strict(), ps).map((l) => l.id);
    assert.deepEqual(before, ['a', 'b', 'c']);
    assert.deepEqual(after, before);
  });

  it('position = score / total questions, clamped 0..1', () => {
    const lanes = buildLanes(strict('active', 4), [player('a', 0, { score: 1 }), player('b', 1, { score: 9 }), player('c', 2, { score: -2 })]);
    assert.deepEqual(lanes.map((l) => l.progress), [0.25, 1, 0]);
    assert.ok(lanes.every((l) => l.basis === 'score'));
  });

  it('zero or missing question_count never divides by zero', () => {
    const lanes = buildLanes({ status: 'active', config: { quiz_mode: 'strict', question_count: 0 } }, [player('a', 0, { score: 0 })]);
    assert.equal(lanes[0].progress, 0);
    assert.equal(lanes[0].total, 1);
  });

  it('strict mode: perfect score reaches the line and counts as finished', () => {
    const [l] = buildLanes(strict('active', 5), [player('a', 0, { score: 5, answers_count: 5 })]);
    assert.equal(l.progress, 1);
    assert.equal(l.finished, true);
  });
});

describe('race: standard mode hides unfinished scores', () => {
  const ps = () => [
    player('done', 0, { score: 2, answers_count: 5, is_finished: true }),
    player('work', 1, { score: 5, answers_count: 3 }),
    player('allin', 2, { score: 1, answers_count: 5 }),
  ];

  it('isScoreHidden only in standard, unfinished, quiz not finished', () => {
    assert.equal(isScoreHidden(standard(), { is_finished: false }), true);
    assert.equal(isScoreHidden(standard(), { is_finished: true }), false);
    assert.equal(isScoreHidden(standard('finished'), { is_finished: false }), false);
    assert.equal(isScoreHidden(strict(), { is_finished: false }), false);
    assert.equal(isScoreHidden(strict(), { is_finished: false, score_hidden: true }), true);
  });

  it('hidden lane: score null, rank null, position from answered count, capped before the line', () => {
    const lanes = buildLanes(standard(), ps());
    const work = lanes.find((l) => l.id === 'work')!;
    const allin = lanes.find((l) => l.id === 'allin')!;
    assert.equal(work.score, null);
    assert.equal(work.rank, null);
    assert.equal(work.basis, 'answered');
    assert.equal(work.progress, 3 / 5);
    assert.equal(allin.progress, HIDDEN_PROGRESS_CAP);
    assert.equal(allin.finished, false);
  });

  it('position does not depend on hidden score', () => {
    const a = buildLanes(standard(), [player('x', 0, { score: 0, answers_count: 3 })])[0];
    const b = buildLanes(standard(), [player('x', 0, { score: 3, answers_count: 3 })])[0];
    assert.deepEqual(a, b);
  });

  it('only visible players are ranked; hidden ones go last in the text list', () => {
    const lanes = buildLanes(standard(), ps());
    assert.equal(lanes.find((l) => l.id === 'done')!.rank, 1);
    assert.deepEqual(rankedList(lanes).map((l) => l.id), ['done', 'work', 'allin']);
  });

  it('after the quiz finishes everything is revealed', () => {
    const lanes = buildLanes(standard('finished'), ps());
    assert.ok(lanes.every((l) => l.score !== null && l.rank !== null));
    assert.equal(lanes.find((l) => l.id === 'work')!.rank, 1);
  });
});

describe('race: public mask (server payload)', () => {
  it('standard: zeroes score, flags hidden, re-sorts by joined_at', () => {
    const raw = [
      player('b', 20, { score: 5 }),
      player('a', 10, { score: 4, is_finished: true }),
      player('c', 30, { score: 1 }),
    ];
    const out = maskPlayersForPublic(standard(), raw);
    assert.deepEqual(out.map((p) => p.id), ['a', 'b', 'c'].map(publicPlayerId));
    assert.deepEqual(out.map((p) => p.score), [4, 0, 0]);
    assert.deepEqual(out.map((p) => p.score_hidden), [false, true, true]);
    assert.ok(!JSON.stringify(out).includes('"score":5'));
    assert.equal(raw[0].score, 5, 'input not mutated');
  });

  it('never exposes real player ids (they are the player credential)', () => {
    const raw = [player('11111111-2222-3333-4444-555555555555', 0, { score: 2, name: 'Budi' })];
    for (const q of [strict(), standard(), standard('finished')]) {
      const out = maskPlayersForPublic(q, raw);
      assert.ok(!JSON.stringify(out).includes(raw[0].id));
      assert.equal(out[0].id, publicPlayerId(raw[0].id));
    }
    assert.match(publicPlayerId('x'), /^[0-9a-f]{24}$/);
    assert.notEqual(publicPlayerId('a'), publicPlayerId('b'));
  });

  it('strict or finished quiz: untouched scores', () => {
    const raw = [player('a', 0, { score: 3 })];
    assert.equal(maskPlayersForPublic(strict(), raw)[0].score, 3);
    assert.equal(maskPlayersForPublic(standard('finished'), raw)[0].score, 3);
  });
});

describe('race: simulation 5 players, scores climb', () => {
  it('rank order and one finish event per player', () => {
    const N = 5;
    const quiz = strict('active', N);
    const ps = ['Budi', 'Siti', 'Ketut', 'Dewi', 'Agus'].map((n, i) => player(n, i));
    // Budi answers all correctly, Siti 4, Ketut 3, Dewi 2, Agus 1; each round every player answers one question.
    const correctUntil: Record<string, number> = { Budi: 5, Siti: 4, Ketut: 3, Dewi: 2, Agus: 1 };
    const track = createFinishTracker();
    const fired: string[] = [];
    let prevRanks = new Map<string, number | null>();
    const changesSeen: string[] = [];

    fired.push(...track(buildLanes(quiz, ps))); // prime
    for (let round = 1; round <= N; round++) {
      for (const p of ps) {
        p.answers_count = round;
        if (round <= correctUntil[p.id]) p.score += 1;
        p.total_time += 3 + ps.indexOf(p);
        if (round === N) p.is_finished = true;
      }
      const lanes = buildLanes(quiz, ps);
      for (const [id, dir] of rankChanges(prevRanks, lanes)) changesSeen.push(`${id}:${dir}`);
      prevRanks = new Map(lanes.map((l) => [l.id, l.rank]));
      fired.push(...track(lanes));
      // replaying the same snapshot never re-fires
      assert.deepEqual(track(lanes), []);
    }

    const finalRank = rankedList(buildLanes(quiz, ps)).map((l) => l.id);
    assert.deepEqual(finalRank, ['Budi', 'Siti', 'Ketut', 'Dewi', 'Agus']);
    assert.deepEqual([...fired].sort(), ['Agus', 'Budi', 'Dewi', 'Ketut', 'Siti']);
    assert.equal(new Set(fired).size, fired.length, 'confetti exactly once per player');
    // Budi reached the line with a perfect score in the last round, so he fires; nobody fired before round 5.
    assert.equal(fired.length, 5);
    assert.equal(changesSeen.length, 0, 'ties broken by total_time keep ranks stable here');
  });

  it('rank change detection reports up/down', () => {
    const quiz = strict();
    const ps = [player('a', 0, { score: 2 }), player('b', 1, { score: 1 })];
    const before = new Map(buildLanes(quiz, ps).map((l) => [l.id, l.rank]));
    ps[1].score = 3;
    const ch = rankChanges(before, buildLanes(quiz, ps));
    assert.equal(ch.get('b'), 'up');
    assert.equal(ch.get('a'), 'down');
  });

  it('players already finished when the view opens do not fire', () => {
    const track = createFinishTracker();
    assert.deepEqual(track(buildLanes(strict(), [player('a', 0, { is_finished: true })])), []);
    assert.deepEqual(track(buildLanes(strict(), [player('a', 0, { is_finished: true }), player('b', 1, { is_finished: true })])), ['b']);
  });
});

describe('race: 40 players', () => {
  it('builds 40 lanes fast', () => {
    const ps = Array.from({ length: 40 }, (_, i) => player(`p${i}`, i, { score: i % 11, total_time: 100 - i, answers_count: i % 11 }));
    const start = performance.now();
    let lanes = buildLanes(strict('active', 10), ps);
    for (let i = 0; i < 200; i++) lanes = buildLanes(strict('active', 10), ps);
    const ms = (performance.now() - start) / 201;
    assert.equal(lanes.length, 40);
    assert.equal(new Set(lanes.map((l) => l.rank)).size, 40);
    assert.ok(ms < 5, `buildLanes took ${ms.toFixed(3)}ms`);
    console.log(`buildLanes 40 players avg ${ms.toFixed(3)}ms`);
  });
});
