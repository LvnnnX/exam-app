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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setIsOpen(!isOpen)}
        data-open={isOpen ? 'true' : 'false'}
        className={`neumorph-pulse-control w-full flex items-center justify-between bg-black/5 hover:bg-black/10 rounded-2xl px-4 h-11 text-[13px] transition-spring-fast active:scale-[0.98] ${disabled || options.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
          }`}
      >
        <span className={`truncate font-medium tracking-tight ${selectedValues.length > 0 ? 'text-nike-black' : 'text-nike-grey-500'}`}>
          {getDisplayText()}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-nike-grey-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-[110] mt-2 w-full bg-white rounded-2xl shadow-ios-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-0.5">
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
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 transition-spring-fast text-left"
                >
                  <div className={`shrink-0 w-4 h-4 rounded-md flex items-center justify-center transition-spring-fast ${selectedValues.length === options.length ? 'bg-nike-black' : 'bg-black/10'
                    }`}>
                    {selectedValues.length === options.length && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[13px] font-medium tracking-tight text-nike-black">Select all</span>
                </button>
                <div className="h-px bg-black/[0.06] my-1" />
                {options.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-black/5 transition-spring-fast text-left"
                  >
                    <div className={`shrink-0 w-4 h-4 rounded-md flex items-center justify-center transition-spring-fast ${selectedValues.includes(option.value) ? 'bg-nike-black' : 'bg-black/10'
                      }`}>
                      {selectedValues.includes(option.value) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-[13px] font-medium tracking-tight ${selectedValues.includes(option.value) ? 'text-nike-black' : 'text-nike-grey-500'}`}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <div className="p-4 text-center text-nike-grey-500 text-[12px] font-medium tracking-tight">
                No options available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
