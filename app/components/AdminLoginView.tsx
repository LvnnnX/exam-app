"use client";

import React from 'react';

type AdminLoginViewProps = {
  email: string;
  password: string;
  authError: string;
  authLoading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
};

export default function AdminLoginView({
  email,
  password,
  authError,
  authLoading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AdminLoginViewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-xl shadow-slate-200/50 border-2 border-slate-100 text-center">
          <div className="w-20 h-20 bg-[#FF9500]/10 text-[#FF9500] rounded-[24px] flex items-center justify-center mx-auto mb-8 text-3xl shadow-inner">
            🔒
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">Admin Login</h1>
          <p className="text-slate-400 text-sm mb-10 font-medium tracking-tight">Enter your credentials to access the panel.</p>

          <form onSubmit={onSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Email / Username</label>
              <input
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="admin@example.com atau username"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#4A90D9]/10 focus:border-[#4A90D9] transition-all placeholder:text-slate-300"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#4A90D9]/10 focus:border-[#4A90D9] transition-all placeholder:text-slate-300"
                required
              />
            </div>

            {authError && (
              <div className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl text-red-600 text-xs font-bold animate-shake">
                ⚠️ {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{ background: '#4A90D9' }}
              className="w-full py-4 mt-4 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authLoading ? 'Verifying...' : 'Sign In to Dashboard'}
            </button>

            <button
              type="button"
              onClick={() => window.location.href = '/admin/forgot-password'}
              className="w-full py-4 bg-white border-2 border-slate-100 text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors mt-2"
            >
              Forgot Password
            </button>

            <button
              type="button"
              onClick={() => window.location.href = '/admin/signup'}
              className="w-full py-4 bg-white border-2 border-slate-100 text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors mt-2"
            >
              Request Admin Access
            </button>

            <button
              type="button"
              onClick={() => window.location.href = '/'}
              className="w-full py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-colors mt-2"
            >
              Return to Home
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
          OSN SMANDAPURA • SECURE ADMIN ACCESS
        </p>
      </div>
    </div>
  );
}
