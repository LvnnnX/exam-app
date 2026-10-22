'use client';

import React from 'react';

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
  note?: string | null;
  disabled?: boolean;
  testId?: string;
}

/** Radio group native (panah kiri/kanan jalan sendiri) dengan tampilan tile. Dipakai kalau tiap opsi butuh keterangan. */
export function RadioTiles<T extends string | number>(props: {
  name: string;
  legend: string;
  value: T | null;
  options: ChoiceOption<T>[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const { name, legend, value, options, onChange, className = 'grid-cols-3 sm:grid-cols-4' } = props;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[12px] font-medium text-fg-muted">{legend}</legend>
      <div className={`grid gap-2 ${className}`}>
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={String(o.value)}
              data-testid={o.testId}
              className={`transition-calm flex min-h-11 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
                o.disabled
                  ? 'well cursor-not-allowed text-fg-muted'
                  : checked
                    ? 'clay cursor-pointer text-fg'
                    : 'well well-hover cursor-pointer text-fg'
              }`}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={checked}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
              />
              <span className={`text-[14px] tabular-nums ${checked ? 'font-bold' : 'font-medium'} ${o.disabled ? 'line-through' : ''}`}>
                {o.label}
              </span>
              {o.note && <span className="text-[11px] font-medium leading-tight">{o.note}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Segmented control 2 opsi (DESIGN Segmented control): tombol dengan aria-pressed. */
export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string; testId?: string; danger?: boolean }[];
  onChange: (v: T) => void;
}) {
  const { label, value, options, onChange } = props;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-fg-muted">{label}</span>
      <div role="group" aria-label={label} className="well grid grid-cols-2 gap-1 rounded-xl p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              data-testid={o.testId}
              onClick={() => onChange(o.value)}
              className={`transition-calm h-11 rounded-lg text-[14px] font-semibold ${
                active ? (o.danger ? 'clay-danger' : 'clay') : 'text-fg-muted hover:text-fg'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
