"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { createAdminSignupRequestAction } from '@/app/actions/admin/access';
import { type AdminRole } from '@/lib/admin-permissions';
import { useAdminTheme } from '@/app/hooks/useAdminTheme';

type SignupRole = Exclude<AdminRole, 'super_admin'>;

export default function AdminSignupPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState<SignupRole>('teacher');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { theme, toggleTheme } = useAdminTheme();
  const isDark = theme === 'dark';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signUpError) throw signUpError;

      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setMessage('Akun dibuat. Konfirmasi email kamu, lalu hubungi super admin jika permintaan belum terlihat.');
        return;
      }

      await createAdminSignupRequestAction(accessToken, requestedRole, username);
      setMessage('Permintaan terkirim. Tunggu approval super admin sebelum login ke admin panel.');
      setEmail('');
      setUsername('');
      setPassword('');
      setRequestedRole('teacher');
      await supabase.auth.signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim permintaan akses.');
    } finally {
      setLoading(false);
    }
  };

  const labelClass = 'mb-2 ml-0.5 block text-[13px] font-medium text-fg-muted';
  const inputClass = 'well h-12 w-full rounded-xl px-4 text-[15px] font-medium text-fg placeholder:text-fg-subtle transition-calm';

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
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
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-fg md:text-[28px]">
              Daftar admin.
            </h1>
            <p className="mt-2 text-[14px] font-medium text-fg-muted">
              Ajukan akun baru untuk ditinjau oleh super admin.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className={labelClass}>Username</span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nama_pengguna"
                className={inputClass}
                required
              />
            </label>

            <label className="block">
              <span className={labelClass}>Email</span>
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

            <label className="block">
              <span className={labelClass}>Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  placeholder="Minimal 6 karakter"
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

            <label className="block">
              <span className={labelClass}>Peran yang diajukan</span>
              <div className="relative">
                <select
                  value={requestedRole}
                  onChange={(e) => setRequestedRole(e.target.value as SignupRole)}
                  className={`${inputClass} well-hover cursor-pointer appearance-none pr-11 font-semibold`}
                >
                  <option value="teacher">Teacher (Guru / Pembuat Soal)</option>
                  <option value="curator">Curator (Kurator Konten)</option>
                  <option value="admin">Admin (Pengelola Penuh)</option>
                </select>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
                  aria-hidden
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
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
              {loading ? 'Mengirim permintaan…' : 'Ajukan pendaftaran'}
            </button>

            <Link
              href="/admin"
              className="well well-hover flex h-11 w-full items-center justify-center rounded-xl text-[13px] font-medium text-fg transition-calm"
            >
              Sudah punya akun? Masuk
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
