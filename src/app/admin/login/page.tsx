'use client';

import React, { useState } from 'react';
import { loginAdminAction } from '@/src/features/auth/actions';
import { Shield, KeyRound, Mail, ArrowRight } from 'lucide-react';

export default function AdminLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await loginAdminAction(formData);
    if (res && !res.success) {
      setError(res.error || 'Login gagal');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl glass shadow-2xl border border-line-strong flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="p-3.5 rounded-2xl bg-primary text-white clay-primary shadow-lg">
            <Shield size={28} />
          </div>
          <h1 className="text-xl font-bold text-fg">Login Admin Guru</h1>
          <p className="text-xs text-fg-muted">
            Smandapura Exam App &mdash; Kelola bank soal dan kuis
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-brick-500/15 text-danger text-xs border border-brick-500/30 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs sm:text-sm">
          <div>
            <label className="font-semibold text-fg-muted block mb-1.5">Email:</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                type="email"
                name="email"
                required
                defaultValue="admin@local.test"
                placeholder="nama@sekolah.sch.id"
                className="w-full pl-10 pr-3 py-2.5 rounded-2xl well border border-line text-fg focus:outline-none focus:border-primary text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-fg-muted block mb-1.5">Password:</label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
              <input
                type="password"
                name="password"
                required
                placeholder="Password akun admin..."
                className="w-full pl-10 pr-3 py-2.5 rounded-2xl well border border-line text-fg focus:outline-none focus:border-primary text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 rounded-2xl text-xs font-bold clay-primary flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Masuk Dashboard'} <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-[11px] text-center text-fg-subtle">
          Untuk testing lokal, password akun <code>admin@local.test</code> telah di-seed di file <code>.env.local</code>.
        </p>
      </div>
    </div>
  );
}
