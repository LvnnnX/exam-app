'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Clock, KeyRound, Mail, Shield, User } from 'lucide-react';
import { registerAdminAction } from '../actions';
import { passwordProblem } from '../validation';
import { Field } from './Field';

export default function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const pwHint = password ? passwordProblem(password) : null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await registerAdminAction(new FormData(e.currentTarget));
    setLoading(false);
    if (res.success) setDone(res.message || 'Permohonan terkirim.');
    else setError(res.error || 'Pendaftaran gagal');
  }

  return (
    <div className="flex min-h-[75vh] items-center justify-center p-4">
      <div className="glass flex w-full max-w-md flex-col gap-6 rounded-3xl border border-line-strong p-6 sm:p-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="clay-primary rounded-2xl p-3.5">
            <Shield size={28} aria-hidden />
          </div>
          <h1 className="text-xl font-bold text-fg">Daftar Admin</h1>
          <p className="text-sm text-fg-muted">Akun baru aktif setelah disetujui super admin</p>
        </div>

        {done ? (
          <div data-testid="register-success-view" role="status" className="well flex flex-col items-center gap-4 rounded-2xl border border-line p-5 text-center">
            <CheckCircle2 size={36} className="text-primary" aria-hidden />
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-bold text-fg">Permohonan Telah Dikirim</h2>
              <p className="text-sm text-fg-muted">{done}</p>
            </div>
            <div className="flex w-full items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 p-3 text-left text-sm text-fg">
              <Clock size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              <span>
                Status akun: <strong>Pending</strong>. Kamu baru bisa login setelah super admin menyetujui.
              </span>
            </div>
            <Link href="/admin/login" className="clay-primary flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold">
              <ArrowLeft size={15} aria-hidden /> Kembali ke login
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                data-testid="register-error-alert"
                className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-sm font-medium text-danger"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field
                label="Username"
                icon={User}
                name="username"
                required
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_.]{3,32}"
                autoComplete="username"
                placeholder="pak_budi"
                hint="3 sampai 32 karakter: huruf, angka, titik, garis bawah"
              />
              <Field label="Email" icon={Mail} name="email" type="email" required autoComplete="email" placeholder="nama@sekolah.sch.id" />
              <Field
                label="Password"
                icon={KeyRound}
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint={pwHint ?? 'Minimal 8 karakter, berisi huruf dan angka'}
              />
              <Field
                label="Konfirmasi password"
                icon={KeyRound}
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={loading}
                className="clay-primary mt-1 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold disabled:opacity-50"
              >
                {loading ? 'Mengirim...' : 'Kirim permohonan'} <ArrowRight size={16} aria-hidden />
              </button>
            </form>

            <p className="border-t border-line pt-4 text-center text-sm text-fg-muted">
              Sudah punya akun?{' '}
              <Link href="/admin/login" className="font-bold text-primary hover:underline">
                Masuk
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
