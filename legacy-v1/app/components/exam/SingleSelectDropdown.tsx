"use client";

import React, { useEffect, useRef, useState } from 'react';

type SingleSelectDropdownProps<T extends string | number> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Field name for assistive tech, e.g. "Time limit". Announced with the current value. */
  ariaLabel?: string;
};

export default function SingleSelectDropdown<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Choose option',
  ariaLabel,
}: SingleSelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const isDisabled = disabled || options.length === 0;
  const displayText = selectedOption?.label || placeholder;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsOpen(false);
      }}
    >
      <button
        type="button"
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel ? `${ariaLabel}: ${displayText}` : undefined}
        onClick={() => setIsOpen((current) => !current)}
        className={`well well-hover flex h-11 w-full items-center justify-between gap-2 rounded-xl px-4 text-[14px] transition-calm ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <span className={`truncate font-medium tabular-nums ${selectedOption ? 'text-fg' : 'text-fg-subtle'}`}>
          {displayText}
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="glass-strong animate-in absolute z-[110] mt-2 w-full min-w-[180px] overflow-hidden rounded-2xl">
          <div className="max-h-[260px] space-y-0.5 overflow-y-auto p-1.5" role="listbox" aria-label={ariaLabel}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className="well-hover flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left transition-calm"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-calm ${selected ? 'border-primary' : 'border-line-strong'}`}
                  >
                    {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span className={`text-[14px] font-medium tabular-nums ${selected ? 'text-fg' : 'text-fg-muted'}`}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
