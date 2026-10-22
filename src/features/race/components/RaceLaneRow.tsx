'use client';

import React, { memo, useEffect, useRef } from 'react';
import MountAvatar from '@/src/features/kuis/components/MountAvatar';
import CrownIcon from './CrownIcon';
import { prefersReducedMotion } from '../hooks/useRaceEffects';
import type { RaceLane } from '../logic';

interface RaceLaneRowProps {
  lane: RaceLane;
  registerMount: (id: string, el: HTMLElement | null) => void;
}

const GLIDE = 'transform 320ms var(--ease-calm)';

function RaceLaneRow({ lane, registerMount }: RaceLaneRowProps) {
  const rankRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const prev = useRef({ rank: lane.rank, score: lane.score, answered: lane.answered });

  useEffect(() => {
    registerMount(lane.id, mountRef.current);
    return () => registerMount(lane.id, null);
  }, [lane.id, registerMount]);

  useEffect(() => {
    const before = prev.current;
    prev.current = { rank: lane.rank, score: lane.score, answered: lane.answered };
    if (prefersReducedMotion()) return;

    if (before.rank !== null && lane.rank !== null && before.rank !== lane.rank) {
      const dy = lane.rank < before.rank ? -3 : 3;
      rankRef.current?.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
        { duration: 400, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    }

    const moved = lane.answered > before.answered || (lane.score ?? 0) > (before.score ?? 0);
    const el = mountRef.current;
    if (!moved || !el) return;
    el.classList.remove('horse-galloping', 'horse-dust');
    void el.offsetWidth;
    el.classList.add('horse-galloping', 'horse-dust');
    const done = (e: AnimationEvent) => {
      if (e.animationName !== 'horse-gallop') return;
      el.classList.remove('horse-galloping', 'horse-dust');
      el.removeEventListener('animationend', done);
    };
    el.addEventListener('animationend', done);
    return () => el.removeEventListener('animationend', done);
  }, [lane.rank, lane.score, lane.answered]);

  const isLeader = lane.rank === 1;
  const crown = lane.rank !== null && lane.rank <= 3 ? (lane.rank as 1 | 2 | 3) : null;

  return (
    <li className="flex items-center gap-2 sm:gap-3">
      <div ref={rankRef} className="flex w-14 shrink-0 items-center gap-1">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl text-[13px] font-semibold tabular-nums ${
            isLeader ? 'clay-highlight' : 'clay'
          }`}
        >
          <span className="sr-only">Peringkat </span>
          {lane.rank ?? '-'}
        </span>
        {crown && <CrownIcon rank={crown} className="text-[18px]" />}
      </div>

      <div className="well min-w-0 flex-1 rounded-2xl px-3 pb-1.5 pt-1.5">
        <div className="flex items-center gap-2 text-[13px] text-fg-muted">
          <span className="min-w-0 flex-1 truncate">{lane.name}</span>
          <span className="shrink-0 tabular-nums">
            Skor {lane.score ?? '?'}
            <span className="sr-only">, {lane.answered} dari {lane.total} soal dijawab,</span>
          </span>
          <span
            className={`shrink-0 rounded-lg px-2 py-0.5 text-[12px] font-semibold ${
              lane.finished ? 'bg-primary/14 text-primary' : 'border border-line text-fg-muted'
            }`}
          >
            {lane.finished ? 'Selesai' : 'Live'}
          </span>
        </div>

        <div className="relative mt-1 h-10 sm:h-12" aria-hidden="true">
          <div className="absolute inset-x-0 bottom-1 h-2 overflow-hidden rounded-full">
            <div
              className="h-full w-full origin-left bg-primary/14"
              style={{ transform: `scaleX(${lane.progress})`, transition: GLIDE }}
            />
          </div>
          <div className="absolute inset-y-0 right-0 border-r-2 border-dashed border-ink-500/60" />
          <div
            className="pointer-events-none absolute inset-y-0 left-0 right-8 sm:right-10"
            style={{ transform: `translateX(${lane.progress * 100}%)`, transition: GLIDE }}
          >
            <div ref={mountRef} className="relative h-full w-8 sm:w-10">
              <span className="absolute bottom-0.5 left-1/2 h-1.5 w-7 -translate-x-1/2 rounded-full bg-fg/15 sm:w-8" />
              <MountAvatar skin={lane.skin} size="sm" bare className="absolute bottom-1 left-0 sm:h-10 sm:w-10" />
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function sameLane(a: RaceLaneRowProps, b: RaceLaneRowProps): boolean {
  const x = a.lane;
  const y = b.lane;
  return (
    x.id === y.id &&
    x.skin === y.skin &&
    x.score === y.score &&
    x.answered === y.answered &&
    x.progress === y.progress &&
    x.finished === y.finished &&
    x.rank === y.rank &&
    x.name === y.name
  );
}

export default memo(RaceLaneRow, sameLane);
