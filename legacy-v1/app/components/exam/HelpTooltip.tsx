"use client";

import React, { useId, useRef, useState } from 'react';

type HelpTooltipProps = {
  text: string;
};

// Half of the tooltip width (w-52 = 208px) plus the 12px page gutter it must keep.
const HALF_WIDTH = 104;
const EDGE = 12;

export default function HelpTooltip({ text }: HelpTooltipProps) {
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [align, setAlign] = useState<'start' | 'center' | 'end'>('center');

  // Pick the alignment on open so the tooltip never runs off a narrow screen.
  const place = () => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mid = rect.left + rect.width / 2;
    if (mid + HALF_WIDTH > window.innerWidth - EDGE) setAlign('end');
    else if (mid - HALF_WIDTH < EDGE) setAlign('start');
    else setAlign('center');
  };

  const alignClass = align === 'end' ? 'right-0' : align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={wrapperRef}
      className="relative group inline-flex ml-1.5 align-middle"
      onPointerEnter={place}
      onFocus={place}
    >
      <button
        type="button"
        aria-label="Bantuan"
        aria-describedby={tooltipId}
        className="relative flex h-[18px] w-[18px] items-center justify-center rounded-full well text-[11px] font-semibold text-fg-muted transition-calm hover:text-fg cursor-help before:absolute before:-inset-[13px] before:content-['']"
      >
        ?
      </button>
      {/* display:none while closed, so a hidden tooltip never widens the page. */}
      <span
        id={tooltipId}
        role="tooltip"
        className={`glass-strong animate-in pointer-events-none absolute bottom-full z-20 mb-2 hidden w-52 max-w-[calc(100vw-24px)] rounded-xl px-3 py-2 text-center text-[12px] font-medium leading-snug text-fg group-hover:block group-focus-within:block ${alignClass}`}
      >
        {text}
      </span>
    </span>
  );
}
