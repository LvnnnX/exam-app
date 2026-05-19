"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { createAdminSignupRequestAction } from '@/app/actions/admin/access';
import { type AdminRole } from '@/lib/admin-permissions';

type SignupRole = Exclude<AdminRole, 'super_admin'>;

export default function AdminSignupPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState<SignupRole>('teacher');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
        setMessage('Account created. Please confirm your email, then contact super-admin if your request is not visible yet.');
        return;
      }

      await createAdminSignupRequestAction(accessToken, requestedRole, username);
      setMessage('Request submitted. Tunggu approval super-admin sebelum login admin panel.');
      setEmail('');
      setUsername('');
      setPassword('');
      setRequestedRole('teacher');
      await supabase.auth.signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit signup request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-[#111111]">
      <div className="mx-auto flex min-h-screen max-w-md items-center">
        <div className="w-full rounded-[32px] border-2 border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50 md:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#111111] text-2xl font-bold text-white">A</div>
            <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Admin Signup</h1>
            <p className="mt-2 text-sm font-medium text-slate-400">Buat akun, lalu tunggu approval super-admin.</p>
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

            <div>
              <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                pattern="[a-zA-Z0-9_.-]{3,32}"
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-700 transition-all focus:border-[#4A90D9] focus:outline-none focus:ring-4 focus:ring-[#4A90D9]/10"
                required
              />
            </div>

            <div>
              <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-700 transition-all focus:border-[#4A90D9] focus:outline-none focus:ring-4 focus:ring-[#4A90D9]/10"
                required
              />
            </div>

            <div>
              <label className="mb-2 ml-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Request Role</label>
              <select
                value={requestedRole}
                onChange={(e) => setRequestedRole(e.target.value as SignupRole)}
                className="h-12 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 text-sm font-bold text-slate-700 focus:border-[#4A90D9] focus:outline-none"
              >
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {message && <div className="rounded-2xl border-2 border-green-100 bg-green-50 p-4 text-xs font-bold text-green-700">{message}</div>}
            {error && <div className="rounded-2xl border-2 border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-2xl bg-[#111111] py-4 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Access Request'}
            </button>

            <button
              type="button"
              onClick={() => window.location.href = '/admin'}
              className="w-full rounded-2xl border-2 border-slate-100 bg-white py-4 text-sm font-bold text-slate-400 transition-colors hover:bg-slate-50"
            >
              Back to Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
