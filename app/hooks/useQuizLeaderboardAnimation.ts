"use client";

import { useLayoutEffect, type MutableRefObject } from 'react';
import { type Player } from '@/lib/quiz';

export default function useQuizLeaderboardAnimation(
  leaderboard: Player[],
  leaderboardRowRefs: MutableRefObject<Record<string, HTMLDivElement | null>>,
  previousLeaderboardRectsRef: MutableRefObject<Map<string, DOMRect>>,
) {
  useLayoutEffect(() => {
    const rowElements = leaderboard
      .map((entry) => leaderboardRowRefs.current[entry.id])
      .filter((element): element is HTMLDivElement => Boolean(element));

    rowElements.forEach((element) => {
      element.getAnimations().forEach((animation) => animation.cancel());
    });

    const nextRects = new Map<string, DOMRect>();
    leaderboard.forEach((entry) => {
      const element = leaderboardRowRefs.current[entry.id];
      if (element) {
        nextRects.set(entry.id, element.getBoundingClientRect());
      }
    });

    const previousRects = previousLeaderboardRectsRef.current;

    leaderboard.forEach((entry, index) => {
      const element = leaderboardRowRefs.current[entry.id];
      const nextRect = nextRects.get(entry.id);
      if (!element || !nextRect) return;

      const previousRect = previousRects.get(entry.id);
      if (previousRect) {
        const deltaX = previousRect.left - nextRect.left;
        const deltaY = previousRect.top - nextRect.top;
        if (deltaX === 0 && deltaY === 0) {
          return;
        }

        const moveDistance = Math.hypot(deltaX, deltaY);
        const pulseScale = 1.02 + Math.min(0.015, moveDistance / 2400);

        element.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px) scale(1)`, boxShadow: '0 0 0 rgba(0, 0, 0, 0)' },
            { offset: 0.38, transform: `translate(${deltaX * 0.45}px, ${deltaY * 0.45}px) scale(${pulseScale})`, boxShadow: '0 16px 32px rgba(15, 23, 42, 0.16)' },
            { transform: 'translate(0px, 0px) scale(1)', boxShadow: '0 0 0 rgba(0, 0, 0, 0)' },
          ],
          {
            duration: Math.min(660, Math.max(320, 240 + Math.min(260, Math.abs(deltaY)))),
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            fill: 'both',
          }
        );
        return;
      }

      element.animate(
        [
          { opacity: 0, transform: 'translateY(14px) scale(0.98)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        {
          duration: 320 + index * 30,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          fill: 'both',
          delay: index * 24,
        }
      );
    });

    previousLeaderboardRectsRef.current = nextRects;
  }, [leaderboard, leaderboardRowRefs, previousLeaderboardRectsRef]);
}
