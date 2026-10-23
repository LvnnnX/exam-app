'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, KeyRound, Mail, Shield } from 'lucide-react';
import { loginAdminAction } from '../actions';
import { Field } from './Field';

export default function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await loginAdminAction(new FormData(e.currentTarget));
    // Success redirects server-side; we only get here on failure.
    if (res && !res.success) {
      setError(res.error || 'Login gagal');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="glass flex w-full max-w-md flex-col gap-6 rounded-3xl border border-line-strong p-6 sm:p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="clay-primary rounded-2xl p-3.5">
            <Shield size={28} aria-hidden />
          </div>
          <h1 className="text-xl font-bold text-fg">Login Admin</h1>
          <p className="text-sm text-fg-muted">Bank soal, kuis live, dan hasil ujian</p>
        </div>

        {error && (
          <div
            role="alert"
            data-testid="login-error-alert"
            className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-sm font-medium text-danger"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="redirect" value={redirectTo} />
          <Field label="Email" icon={Mail} name="email" type="email" autoComplete="email" required placeholder="nama@sekolah.sch.id" />
          <Field label="Password" icon={KeyRound} name="password" type="password" autoComplete="current-password" required />

          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted select-none">
            <input type="checkbox" name="rememberMe" defaultChecked className="h-4 w-4 accent-primary" />
            Ingat saya di perangkat ini
          </label>

          <button
            type="submit"
            disabled={loading}
            className="clay-primary mt-1 flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Masuk'} <ArrowRight size={16} aria-hidden />
          </button>
        </form>

        <p className="border-t border-line pt-4 text-center text-sm text-fg-muted">
          Belum punya akun?{' '}
          <Link href="/admin/register" className="inline-flex items-center font-bold text-primary hover:underline py-1">
            Ajukan pendaftaran
          </Link>
        </p>
      </div>
    </div>
  );
}
