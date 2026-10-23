"use client";

import React, { useEffect, useRef, useState } from 'react';

type MultiSelectDropdownProps = {
  label: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
};

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 flex h-[18px] w-[18px] items-center justify-center rounded-md transition-calm ${checked ? 'bg-primary text-on-primary' : 'well border border-line-strong'}`}
    >
      {checked && (
        <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
        </svg>
      )}
    </span>
  );
}

export default function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  disabled,
  placeholder,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder || `Select ${label}`;
    if (selectedValues.length === options.length && options.length > 0) return `All ${label}s`;
    if (selectedValues.length > 2) return `${selectedValues.length} selected`;
    return selectedValues.map(v => options.find(o => o.value === v)?.label || v).join(', ');
  };

  const isDisabled = disabled || options.length === 0;
  const allSelected = selectedValues.length === options.length && options.length > 0;

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
        aria-label={`${label}: ${getDisplayText()}`}
        onClick={() => setIsOpen(!isOpen)}
        className={`well well-hover w-full flex items-center justify-between gap-2 rounded-xl px-4 h-11 text-[14px] transition-calm ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className={`truncate font-medium ${selectedValues.length > 0 ? 'text-fg' : 'text-fg-subtle'}`}>
          {getDisplayText()}
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
        <div className="glass-strong animate-in absolute z-[110] mt-2 w-full min-w-[200px] overflow-hidden rounded-2xl">
          <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-0.5" role="listbox" aria-multiselectable="true">
            {options.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedValues.length === options.length) {
                      onChange([]);
                    } else {
                      onChange(options.map(o => o.value));
                    }
                  }}
                  className="well-hover w-full flex items-center gap-3 rounded-xl px-3 min-h-11 text-left transition-calm"
                >
                  <CheckBox checked={allSelected} />
                  <span className="text-[14px] font-semibold text-fg">Select all</span>
                </button>
                <div className="my-1 h-px bg-line" />
                {options.map(option => {
                  const checked = selectedValues.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggleOption(option.value)}
                      className="well-hover w-full flex items-center gap-3 rounded-xl px-3 min-h-11 text-left transition-calm"
                    >
                      <CheckBox checked={checked} />
                      <span className={`text-[14px] font-medium ${checked ? 'text-fg' : 'text-fg-muted'}`}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </>
            ) : (
              <div className="p-4 text-center text-[13px] font-medium text-fg-muted">
                No options available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
