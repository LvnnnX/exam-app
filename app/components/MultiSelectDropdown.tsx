"use client";

import React, { useState, useEffect, useRef } from 'react';

interface MultiSelectDropdownProps {
  label: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  hideSelectAll?: boolean;
  theme?: 'light' | 'dark';
}

const MultiSelectDropdown = ({ label, options, selectedValues, onChange, disabled, placeholder, hideSelectAll, theme = 'dark' }: MultiSelectDropdownProps) => {
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
    if (selectedValues.length === options.length && options.length > 1) return `All ${label}s Selected`;
    if (selectedValues.length > 2) return `${selectedValues.length} ${label}s Selected`;
    return selectedValues.map(v => options.find(o => o.value === v)?.label || v).join(', ');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between rounded-full border px-3 h-10 text-[13px] transition-spring-fast ${disabled || options.length === 0 ? (theme === 'dark' ? 'cursor-not-allowed border-dark-border-medium bg-dark-700 text-dark-text-tertiary' : 'cursor-not-allowed border-nike-grey-200 bg-nike-grey-100 text-[#9e9ea0]') : (theme === 'dark' ? 'border-dark-border-medium bg-dark-800 hover:border-dark-text-primary hover:scale-[1.02]' : 'border-nike-grey-200 bg-white hover:border-nike-grey-200 hover:scale-[1.02]')
          }`}
      >
        <span className={`truncate font-medium ${selectedValues.length > 0 ? (theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black') : (theme === 'dark' ? 'text-dark-text-tertiary' : 'text-black/40')}`}>
          {getDisplayText()}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-black/40'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute z-[110] mt-2 w-full overflow-hidden rounded-2xl border shadow-ios-md animate-in fade-in zoom-in-95 duration-150 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-800' : 'border-nike-grey-200 bg-white'}`}>
          <div className="max-h-[220px] overflow-y-auto p-1.5 space-y-0.5">
            {options.length > 0 ? (
              <>
                {!hideSelectAll && (
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
                      className={`w-full flex items-center gap-2 rounded-full px-3 py-2 text-left transition-spring-fast ${theme === 'dark' ? 'hover:bg-dark-750' : 'hover:bg-nike-grey-100'}`}
                    >
                      <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-spring-fast ${selectedValues.length === options.length ? (theme === 'dark' ? 'bg-accent-blue border-accent-blue' : 'bg-nike-black border-nike-black') : (theme === 'dark' ? 'border-dark-border' : 'border-nike-grey-200')
                        }`}>
                        {selectedValues.length === options.length && (
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>Select All</span>
                    </button>
                    <div className={`h-[1px] my-1 ${theme === 'dark' ? 'bg-dark-border' : 'bg-black/[0.06]'}`} />
                  </>
                )}
                {options.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={`w-full flex items-center gap-2 rounded-full px-3 py-2 text-left transition-spring-fast ${theme === 'dark' ? 'hover:bg-dark-750' : 'hover:bg-nike-grey-100'}`}
                  >
                    <div className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-spring-fast ${selectedValues.includes(option.value) ? (theme === 'dark' ? 'bg-accent-blue border-accent-blue' : 'bg-nike-black border-nike-black') : (theme === 'dark' ? 'border-dark-border' : 'border-nike-grey-200')
                      }`}>
                      {selectedValues.includes(option.value) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-[13px] font-medium ${selectedValues.includes(option.value) ? (theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black') : (theme === 'dark' ? 'text-dark-text-secondary' : 'text-black/55')}`}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <div className={`p-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-dark-text-muted'}`}>
                No options
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
