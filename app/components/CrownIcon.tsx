"use client";

import React from 'react';

type CrownIconProps = {
  rank: 1 | 2 | 3;
  className?: string;
};

const TONES = {
  1: { fill: 'var(--color-amber-400)', edge: 'var(--color-amber-700)' },
  2: { fill: 'var(--color-ink-300)', edge: 'var(--color-ink-500)' },
  3: { fill: 'var(--color-amber-700)', edge: 'var(--color-amber-900)' },
} as const;

export default function CrownIcon({ rank, className = '' }: CrownIconProps) {
  const tone = TONES[rank];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      width="1em"
      height="1em"
      role="img"
      aria-label={`Peringkat ${rank}`}
    >
      <path
        d="M3.5 8.5l4.2 3.4L12 5.5l4.3 6.4 4.2-3.4-1.6 9.1H5.1z"
        fill={tone.fill}
        stroke={tone.edge}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <rect x="5.1" y="17.6" width="13.8" height="2.4" rx="1.2" fill={tone.edge} />
    </svg>
  );
}
