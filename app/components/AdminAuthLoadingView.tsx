"use client";

import React from 'react';

type AdminAuthLoadingViewProps = {
  theme?: 'light' | 'dark';
};

export default function AdminAuthLoadingView({ theme = 'dark' }: AdminAuthLoadingViewProps) {
  const isDark = theme === 'dark';

  return (
    <div className={`min-h-dvh flex items-center justify-center ${isDark ? 'bg-dark-900 text-dark-text-primary' : 'bg-white text-nike-black'}`}>
      <div className="flex flex-col items-center gap-4">
        <div className={`w-10 h-10 border-3 rounded-full animate-spin ${isDark ? 'border-white/15 border-t-white' : 'border-black/10 border-t-nike-black'}`} />
        <p className={`text-sm font-medium tracking-tight ${isDark ? 'text-dark-text-tertiary' : 'text-black/60'}`}>
          Memverifikasi sesi admin…
        </p>
      </div>
    </div>
  );
}
