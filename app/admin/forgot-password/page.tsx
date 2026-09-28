"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminTheme } from '@/app/hooks/useAdminTheme';

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { theme, toggleTheme } = useAdminTheme();
  const isDark = theme === 'dark';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (resetError) throw resetError;
      setMessage('Jika email terdaftar, link reset password akan dikirim. Cek inbox atau folder spam.');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim link reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={toggleTheme}
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-fg md:text-[28px]">
              Lupa password.
            </h1>
            <p className="mt-2 text-[14px] font-medium text-fg-muted">
              Masukkan email akun admin untuk menerima link reset.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 ml-0.5 block text-[13px] font-medium text-fg-muted">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="well h-12 w-full rounded-xl px-4 text-[15px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
                required
              />
            </label>

            {message && (
              <div role="status" className="rounded-xl bg-primary/12 px-4 py-3 text-[13px] font-semibold text-primary">
                {message}
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] font-semibold text-danger">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="clay-primary h-12 w-full rounded-xl text-[15px] font-semibold">
              {loading ? 'Mengirim...' : 'Kirim link reset'}
            </button>

            <button
              type="button"
              onClick={() => (window.location.href = '/admin')}
              className="well well-hover h-11 w-full rounded-xl text-[13px] font-medium text-fg transition-calm"
            >
              Kembali ke login
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[12px] font-medium text-fg-muted">
          OSK Smandapura 2026
        </p>
      </div>
    </div>
  );
}
