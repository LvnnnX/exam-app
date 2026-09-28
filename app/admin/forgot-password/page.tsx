"use client";

import React, { useState } from 'react';
import Link from 'next/link';
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

  const pageBg = isDark ? 'bg-dark-900' : 'bg-[#fafafa]';
  const cardBg = isDark ? 'bg-dark-800' : 'bg-white';
  const headlineColor = isDark ? 'text-white' : 'text-nike-black';
  const mutedText = isDark ? 'text-dark-text-tertiary' : 'text-black/60';
  const labelClass = isDark ? 'text-dark-text-secondary' : 'text-black/70';
  const iconBubble = isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-nike-black';
  const inputClass = isDark
    ? 'w-full h-12 rounded-2xl bg-white/5 px-5 text-sm font-medium text-white placeholder:text-white/40 focus:outline-none focus:bg-white/10 focus:ring-2 focus:ring-white/20 transition-spring-fast'
    : 'w-full h-12 rounded-2xl bg-black/5 px-5 text-sm font-medium text-nike-black placeholder:text-black/40 focus:outline-none focus:bg-white focus:ring-2 focus:ring-nike-black/15 transition-spring-fast';
  const primaryBtn = isDark
    ? 'w-full h-12 rounded-full bg-white text-nike-black text-sm font-semibold shadow-ios-sm hover:shadow-ios-md hover:scale-[1.01] active:scale-[0.99] transition-spring-fast disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
    : 'w-full h-12 rounded-full bg-nike-black text-white text-sm font-semibold shadow-ios-sm hover:shadow-ios-md hover:scale-[1.01] active:scale-[0.99] transition-spring-fast disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100';
  const ghostBtn = isDark
    ? 'w-full h-11 flex items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-white hover:bg-white/10 transition-spring-fast'
    : 'w-full h-11 flex items-center justify-center rounded-full bg-black/5 text-xs font-semibold text-nike-black hover:bg-black/10 transition-spring-fast';
  const togglePill = isDark
    ? 'inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white/5 text-xs font-semibold text-white hover:bg-white/10 transition-spring-fast'
    : 'inline-flex items-center gap-2 h-10 px-4 rounded-full bg-black/5 text-xs font-semibold text-nike-black hover:bg-black/10 transition-spring-fast';

  return (
    <div className={`min-h-dvh flex items-center justify-center px-4 py-10 ${pageBg}`}>
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={toggleTheme}
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

        <div className={`${cardBg} rounded-3xl p-8 md:p-10 shadow-ios-xl border ${isDark ? 'border-white/5' : 'border-black/5'}`}>
          <div className="flex flex-col items-center text-center mb-8">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-5 ${iconBubble}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h1 className={`text-2xl md:text-[28px] font-semibold tracking-tight ${headlineColor}`}>
              Lupa password.
            </h1>
            <p className={`mt-2 text-sm font-medium ${mutedText}`}>
              Masukkan email akun admin untuk menerima tautan reset.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className={`block text-xs font-semibold mb-2 ml-1 ${labelClass}`}>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className={inputClass}
                required
              />
            </label>

            {message && (
              <div
                role="status"
                className={`p-3.5 rounded-2xl text-xs font-medium ${
                  isDark ? 'bg-accent-green/15 text-accent-green border border-accent-green/20' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {message}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className={`p-3.5 rounded-2xl text-xs font-medium ${
                  isDark ? 'bg-accent-red/15 text-accent-red border border-accent-red/20' : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={primaryBtn}
            >
              {loading ? 'Mengirim…' : 'Kirim tautan reset'}
            </button>

            <Link href="/admin" className={ghostBtn}>
              Kembali ke login
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
