"use client";

import React from 'react';

type AdminHeaderProps = {
  onLogout: () => void;
  theme?: 'light' | 'dark';
};

export default function AdminHeader({ onLogout, theme = 'dark' }: AdminHeaderProps) {
  return (
    <header
      className={`mb-4 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between ${
        theme === 'dark' ? 'border-dark-border-subtle' : 'border-[#e5e5e5]'
      }`}
    >
      <div>
        <p
          className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
            theme === 'dark' ? 'text-dark-text-muted' : 'text-[#8a8a8a]'
          }`}
        >
          Control center
        </p>
        <h1
          className={`mt-1 text-[26px] font-semibold tracking-tight sm:text-[30px] ${
            theme === 'dark' ? 'text-dark-text-primary' : 'text-[#111111]'
          }`}
        >
          Admin Panel
        </h1>
        <p
          className={`text-xs font-medium ${
            theme === 'dark' ? 'text-dark-text-tertiary' : 'text-[#707072]'
          }`}
        >
          Questions, results, settings, and live quizzes.
        </p>
      </div>
      <button
        onClick={onLogout}
        className={`h-10 rounded-full border px-5 text-xs font-semibold transition-spring-fast hover:scale-[1.02] ${
          theme === 'dark'
            ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary hover:border-dark-text-primary'
            : 'border-[#111111] bg-white text-[#111111] hover:bg-[#111111] hover:text-white'
        }`}
      >
        Logout
      </button>
    </header>
  );
}
