"use client";

import React, { useState } from 'react';
import Link from 'next/link';
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

  const inputClass = 'well h-12 w-full rounded-xl px-4 text-[15px] font-medium text-fg placeholder:text-fg-subtle transition-calm';
  const labelClass = 'mb-2 ml-0.5 block text-[13px] font-medium text-fg-muted';
  const secondaryBtn = 'well well-hover flex h-11 items-center justify-center rounded-xl text-[13px] font-medium text-fg transition-calm';

  return (
    <div data-theme={theme} className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
            className="well well-hover inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-medium text-fg transition-calm"
          >
            {isDark ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
                Terang
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                Gelap
              </>
            )}
          </button>
        </div>

        <div className="glass rounded-4xl p-7 md:p-9">
          <div className="mb-7 flex flex-col items-center text-center">
            <div className="clay mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden
              >
                <rect x="4" y="11" width="16" height="9" rx="2.5" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-fg md:text-[28px]">
              Admin login.
            </h1>
            <p className="mt-2 text-[14px] font-medium text-fg-muted">
              Masuk untuk mengelola dashboard ujian dan kuis.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className={labelClass}>Email atau username</span>
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
              <span className={labelClass}>Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputClass} pr-14`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  className="well-hover absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-fg-muted transition-calm hover:text-fg"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.7 21.7 0 0 1 5.17-6.17" />
                      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.7 21.7 0 0 1-3.17 4.19" />
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
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
                className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] font-semibold text-danger"
              >
                {authError}
              </div>
            )}

            <button type="submit" disabled={authLoading} className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold">
              {authLoading ? 'Memverifikasi…' : 'Masuk'}
            </button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link href="/admin/forgot-password" className={secondaryBtn}>
                Lupa password
              </Link>
              <Link href="/admin/signup" className={secondaryBtn}>
                Minta akses
              </Link>
            </div>

            <Link
              href="/"
              className="well-hover flex h-11 w-full items-center justify-center rounded-xl text-[13px] font-medium text-fg-muted transition-calm hover:text-fg"
            >
              Kembali ke beranda
            </Link>
          </form>
        </div>

        <p className="mt-6 text-center text-[12px] font-medium text-fg-muted">
          OSK Smandapura 2026
        </p>
      </div>
    </div>
  );
}
