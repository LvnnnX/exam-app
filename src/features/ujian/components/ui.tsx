'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { EndReason, TopicLabels } from '../types';

export const END_REASON_LABEL: Record<EndReason, string> = {
  submit: 'Dikirim',
  surrender: 'Menyerah',
  time_up: 'Waktu habis',
  violation: 'Dihentikan karena pelanggaran',
  lives_out: 'Nyawa habis',
  questions_out: 'Soal habis',
};

export const BTN_PRIMARY =
  'clay-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-[14px] font-semibold md:h-12';
export const BTN_SECONDARY =
  'well well-hover transition-calm inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-medium text-fg disabled:cursor-not-allowed disabled:text-fg-subtle';
export const BTN_DANGER =
  'clay-danger inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-[14px] font-semibold';
export const BTN_GHOST =
  'transition-calm inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-medium text-fg-muted hover:bg-[var(--well-bg)]';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <span className={`spinner-calm inline-block shrink-0 ${className}`} aria-hidden="true" />;
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-12 text-[14px] text-fg-muted">
      <Spinner className="h-6 w-6" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
      <AlertTriangle size={22} className="text-danger" aria-hidden="true" />
      <p className="text-[14px] font-semibold text-fg">{title}</p>
      {detail && <p className="max-w-sm text-[13px] text-fg-muted">{detail}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className={BTN_SECONDARY}>
          Coba lagi
        </button>
      )}
    </div>
  );
}

/** Pola +N chip: tampilkan maks `max` label, sisanya jadi "+N". */
export function ChipList({ items, max = 2 }: { items: string[]; max?: number }) {
  if (items.length === 0) return <span className="text-[13px] text-fg-muted">-</span>;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1.5" title={items.join(', ')}>
      {shown.map((t) => (
        <span key={t} className="well inline-flex h-6 max-w-[180px] items-center truncate rounded-lg px-2.5 text-[12px] font-semibold text-fg">
          {t}
        </span>
      ))}
      {rest > 0 && (
        <span className="well inline-flex h-6 items-center rounded-lg px-2.5 text-[12px] font-semibold text-fg-muted">+{rest}</span>
      )}
    </span>
  );
}

export function topicsSummary(t: TopicLabels): string[] {
  return t.sub_bab.length ? t.sub_bab : t.bab.length ? t.bab : t.mapel;
}
