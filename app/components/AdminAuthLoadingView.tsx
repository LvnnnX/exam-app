"use client";

import React from 'react';

type AdminAuthLoadingViewProps = {
  theme?: 'light' | 'dark';
};

export default function AdminAuthLoadingView({ theme = 'dark' }: AdminAuthLoadingViewProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-dark-900' : 'bg-white'}`}>
      <div className="flex flex-col items-center gap-4">
        <div className={`w-12 h-12 border-4 rounded-full animate-spin ${theme === 'dark' ? 'border-dark-700 border-t-accent-blue' : 'border-blue-100 border-t-[#4A90D9]'}`}></div>
        <p className={`text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>Verifying Admin Session...</p>
      </div>
    </div>
  );
}
