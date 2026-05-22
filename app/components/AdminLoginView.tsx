"use client";

import React, { useState } from 'react';
import type { AdminTheme } from '@/app/hooks/useAdminTheme';

type AdminLoginViewProps = {
  email: string;
  password: string;
  authError: string;
  authLoading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  theme: AdminTheme;
  onToggleTheme: () => void;
};

export default function AdminLoginView({
  email,
  password,
  authError,
  authLoading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  theme,
  onToggleTheme,
}: AdminLoginViewProps) {
  const isDark = theme === 'dark';
  const [showPassword, setShowPassword] = useState(false);

  const pageBg = isDark ? 'bg-black' : 'bg-white';
  const cardBg = isDark ? 'bg-[#111111]' : 'bg-white';
  const cardShadow = isDark ? 'shadow-ios-lg' : 'shadow-ios-lg';
  const headlineColor = isDark ? 'text-white' : 'text-nike-black';
  const mutedText = isDark ? 'text-white/55' : 'text-black/55';
  const subtleText = isDark ? 'text-white/35' : 'text-black/35';
  const iconBubble = isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-nike-black';
  const inputClass = isDark
    ? 'w-full h-12 rounded-2xl bg-white/5 px-5 text-sm font-medium text-white placeholder:text-white/30 focus:outline-none focus:bg-white/10 focus:ring-2 focus:ring-white/20 transition-spring-fast'
    : 'w-full h-12 rounded-2xl bg-black/5 px-5 text-sm font-medium text-nike-black placeholder:text-black/30 focus:outline-none focus:bg-white focus:ring-2 focus:ring-nike-black/15 transition-spring-fast';
  const labelClass = isDark ? 'text-white/55' : 'text-black/55';
  const primaryBtn = isDark
    ? 'w-full h-12 rounded-full bg-white text-nike-black text-sm font-semibold shadow-ios-sm hover:shadow-ios-md hover:scale-[1.01] active:scale-[0.99] transition-spring-fast disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
    : 'w-full h-12 rounded-full bg-nike-black text-white text-sm font-semibold shadow-ios-sm hover:shadow-ios-md hover:scale-[1.01] active:scale-[0.99] transition-spring-fast disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100';
  const ghostBtn = isDark
    ? 'h-11 rounded-full bg-white/5 text-xs font-semibold text-white hover:bg-white/10 transition-spring-fast'
    : 'h-11 rounded-full bg-black/5 text-xs font-semibold text-nike-black hover:bg-black/10 transition-spring-fast';
  const linkBtn = isDark
    ? 'w-full h-11 rounded-full text-xs font-semibold text-white/50 hover:text-white hover:bg-white/5 transition-spring-fast'
    : 'w-full h-11 rounded-full text-xs font-semibold text-black/50 hover:text-nike-black hover:bg-black/5 transition-spring-fast';
  const togglePill = isDark
    ? 'inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/5 text-xs font-semibold text-white hover:bg-white/10 transition-spring-fast'
    : 'inline-flex items-center gap-2 h-10 px-4 rounded-full bg-black/5 text-xs font-semibold text-nike-black hover:bg-black/10 transition-spring-fast';

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-10 ${pageBg}`}>
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
            className={togglePill}
          >
            {isDark ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
                Terang
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                Gelap
              </>
            )}
          </button>
        </div>

        <div className={`${cardBg} rounded-3xl p-8 md:p-10 ${cardShadow}`}>
          <div className="flex flex-col items-center text-center mb-8">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-5 ${iconBubble}`}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6"
                aria-hidden
              >
                <rect x="4" y="11" width="16" height="9" rx="2.5" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
            <h1 className={`text-2xl md:text-[28px] font-semibold tracking-tight ${headlineColor}`}>
              Admin login.
            </h1>
            <p className={`mt-2 text-sm font-medium ${mutedText}`}>
              Masuk untuk mengelola dashboard.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className={`block text-xs font-semibold mb-2 ml-1 ${labelClass}`}>Email atau username</span>
              <input
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="admin@example.com"
                className={inputClass}
                required
              />
            </label>

            <label className="block">
              <span className={`block text-xs font-semibold mb-2 ml-1 ${labelClass}`}>Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputClass} pr-12`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full transition-spring-fast ${isDark ? 'text-white/55 hover:bg-white/10 hover:text-white' : 'text-black/50 hover:bg-black/5 hover:text-nike-black'}`}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.7 21.7 0 0 1 5.17-6.17" />
                      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.7 21.7 0 0 1-3.17 4.19" />
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {authError && (
              <div
                role="alert"
                className="rounded-2xl bg-accent-red/10 px-4 py-3 text-xs font-semibold text-accent-red"
              >
                {authError}
              </div>
            )}

            <button type="submit" disabled={authLoading} className={primaryBtn}>
              {authLoading ? 'Memverifikasi...' : 'Masuk ke dashboard'}
            </button>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => (window.location.href = '/admin/forgot-password')}
                className={ghostBtn}
              >
                Lupa password
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = '/admin/signup')}
                className={ghostBtn}
              >
                Minta akses
              </button>
            </div>

            <button
              type="button"
              onClick={() => (window.location.href = '/')}
              className={linkBtn}
            >
              Kembali ke beranda
            </button>
          </form>
        </div>

        <p className={`text-center mt-6 text-xs font-medium ${subtleText}`}>
          OSN Smandapura · Secure admin access.
        </p>
      </div>
    </div>
  );
}
