"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
      setMessage('Jika email terdaftar, link reset password akan dikirim. Cek inbox/spam.');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-[#111111]">
      <div className="mx-auto flex min-h-screen max-w-md items-center">
        <div className="w-full rounded-[32px] border-2 border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50 md:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#111111] text-2xl font-bold text-white">?</div>
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Forgot Password</h1>
            <p className="mt-2 text-sm font-medium text-slate-400">Masukkan email akun admin untuk menerima link reset.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-700 transition-all focus:border-[#4A90D9] focus:outline-none focus:ring-4 focus:ring-[#4A90D9]/10"
                required
              />
            </div>

            {message && <div className="rounded-2xl border-2 border-green-100 bg-green-50 p-4 text-xs font-bold text-green-700">{message}</div>}
            {error && <div className="rounded-2xl border-2 border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">{error}</div>}

            <button type="submit" disabled={loading} className="mt-4 w-full rounded-2xl bg-[#111111] py-4 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-50">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button type="button" onClick={() => window.location.href = '/admin'} className="w-full rounded-2xl border-2 border-slate-100 bg-white py-4 text-sm font-bold text-slate-400 transition-colors hover:bg-slate-50">
              Back to Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
