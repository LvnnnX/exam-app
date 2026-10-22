'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { createFinishTracker, rankChanges, type RaceLane } from '../logic';

const CONFETTI_COLORS = ['#7fbca9', '#36806c', '#e9b567', '#df9a3f', '#aebbbc'];
const MAX_ANNOUNCED = 3;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function describeChanges(prevLanes: RaceLane[], lanes: RaceLane[]): string {
  const prev = new Map(prevLanes.map((l) => [l.id, l.rank]));
  const changes = rankChanges(prev, lanes);
  if (changes.size === 0) return '';
  const byId = new Map(lanes.map((l) => [l.id, l]));
  return [...changes]
    .map(([id, dir]) => ({ lane: byId.get(id)!, dir }))
    .sort((a, b) => (a.lane.rank as number) - (b.lane.rank as number))
    .slice(0, MAX_ANNOUNCED)
    .map(({ lane, dir }) => `${lane.name} ${dir === 'up' ? 'naik' : 'turun'} ke peringkat ${lane.rank}.`)
    .join(' ');
}

/**
 * Side effects of the race view: a registry of mount elements (confetti origin)
 * and the rank-change sentence for the aria-live region. Mount once per open
 * modal so a reopened view does not replay old finishes.
 */
export function useRaceEffects(lanes: RaceLane[]) {
  const mounts = useRef(new Map<string, HTMLElement>());
  const [trackFinish] = useState(createFinishTracker);
  const [snapshot, setSnapshot] = useState({ lanes, announcement: '' });

  if (snapshot.lanes !== lanes) {
    const next = describeChanges(snapshot.lanes, lanes);
    setSnapshot({ lanes, announcement: next || snapshot.announcement });
  }

  const registerMount = useCallback((id: string, el: HTMLElement | null) => {
    if (el) mounts.current.set(id, el);
    else mounts.current.delete(id);
  }, []);

  useEffect(() => {
    const fresh = trackFinish(lanes);
    // Finish event for observers (E2E counts these); confetti is the visual part.
    for (const id of fresh) window.dispatchEvent(new CustomEvent('race:finish', { detail: id }));
    if (fresh.length === 0 || prefersReducedMotion()) return;
    // Wait for the 320ms glide so the burst starts where the mount stops. Not cleared on
    // re-render: the tracker already consumed these ids, a cancel would lose the burst.
    window.setTimeout(() => {
      for (const id of fresh) {
        const el = mounts.current.get(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        void confetti({
          particleCount: 60,
          spread: 70,
          startVelocity: 28,
          colors: CONFETTI_COLORS,
          disableForReducedMotion: true,
          origin: {
            x: (r.left + r.width / 2) / window.innerWidth,
            y: (r.top + r.height / 2) / window.innerHeight,
          },
        });
      }
    }, 340);
  }, [lanes, trackFinish]);

  return { registerMount, announcement: snapshot.announcement };
}
