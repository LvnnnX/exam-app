"use client";

import React, { useEffect, useRef, useState } from 'react';

type SingleSelectDropdownProps<T extends string | number> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
};

export default function SingleSelectDropdown<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  placeholder = 'Choose option',
}: SingleSelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);

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
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setIsOpen((current) => !current)}
        className={`neumorph-pulse-control flex h-11 w-full items-center justify-between rounded-2xl bg-black/5 px-4 text-[13px] transition-spring-fast hover:bg-black/10 active:scale-[0.98] ${disabled || options.length === 0 ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <span className={`truncate font-medium tracking-tight ${selectedOption ? 'text-nike-black' : 'text-nike-grey-500'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <svg
          className={`h-3.5 w-3.5 text-nike-grey-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-[110] mt-2 w-full overflow-hidden rounded-2xl bg-white shadow-ios-xl animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-[260px] space-y-0.5 overflow-y-auto p-1.5">
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-spring-fast hover:bg-black/5"
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-spring-fast ${selected ? 'bg-nike-black' : 'bg-black/10'}`}>
                    {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                  <span className={`text-[13px] font-medium tracking-tight ${selected ? 'text-nike-black' : 'text-nike-grey-500'}`}>
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
