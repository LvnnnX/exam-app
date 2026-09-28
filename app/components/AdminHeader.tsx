"use client";

import React from 'react';

type AdminHeaderProps = {
  onLogout: () => void;
  theme?: 'light' | 'dark';
};

export default function AdminHeader({ onLogout }: AdminHeaderProps) {
  return (
    <header className="glass mb-4 flex flex-col gap-3 rounded-3xl px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[12px] font-medium text-fg-muted">Control center</p>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight text-fg sm:text-[30px]">
          Admin panel
        </h1>
        <p className="text-[13px] font-medium text-fg-muted">
          Questions, results, settings, and live quizzes.
        </p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="h-11 rounded-xl bg-danger/10 px-5 text-[13px] font-semibold text-danger transition-calm hover:bg-danger/15"
      >
        Logout
      </button>
    </header>
  );
}
