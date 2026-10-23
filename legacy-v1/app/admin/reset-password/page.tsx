"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function AdminResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      if (password.length < 8) throw new Error('Password minimal 8 karakter.');
      if (password !== confirmPassword) throw new Error('Konfirmasi password tidak sama.');

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setMessage('Password berhasil diubah. Silakan login ulang.');
      setPassword('');
      setConfirmPassword('');
      await supabase.auth.signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const labelClass = 'mb-2 ml-0.5 block text-[13px] font-medium text-fg-muted';
  const inputClass = 'well h-12 w-full rounded-xl px-4 text-[15px] font-medium text-fg transition-calm';

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="glass rounded-4xl p-7 md:p-9">
          <div className="mb-7 text-center">
            <div className="clay mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                <rect x="4" y="11" width="16" height="9" rx="2.5" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-fg md:text-[28px]">Reset password.</h1>
            <p className="mt-2 text-[14px] font-medium text-fg-muted">Masukkan password baru dari link reset Supabase.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-new-password" className={labelClass}>New password</label>
              <input
                id="reset-new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label htmlFor="reset-confirm-password" className={labelClass}>Confirm password</label>
              <input
                id="reset-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                className={inputClass}
                required
              />
            </div>

            {message && <div role="status" className="rounded-xl bg-primary/12 px-4 py-3 text-[13px] font-semibold text-primary">{message}</div>}
            {error && <div role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] font-semibold text-danger">{error}</div>}

            <button type="submit" disabled={loading} className="clay-primary mt-2 h-12 w-full rounded-xl text-[15px] font-semibold">
              {loading ? 'Updating...' : 'Update password'}
            </button>

            <Link href="/admin" className="well well-hover flex h-11 w-full items-center justify-center rounded-xl text-[13px] font-medium text-fg transition-calm">
              Back to login
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
