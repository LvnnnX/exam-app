import React from 'react';
import Link from 'next/link';
import { getCurrentAdmin } from '@/src/features/auth/server';
import { logoutAdminAction } from '@/src/features/auth/actions';
import { BookOpen, ClipboardList, FolderTree, LogOut, Radio, Shield, Users } from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Top Navigation Bar */}
      <header className="p-3.5 sm:p-4 rounded-3xl glass border border-line flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <Link href="/admin/soal" className="flex items-center gap-2 font-bold text-fg text-base">
            <span className="p-2 rounded-2xl bg-primary text-white clay-primary">
              <Shield size={18} />
            </span>
            <span>Admin Portal</span>
          </Link>
          {admin && (
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full well text-primary font-semibold border border-line">
              {admin.role}
            </span>
          )}
        </div>

        {admin && (
          <nav className="flex items-center gap-2">
            <Link
              href="/admin/soal"
              className="px-3.5 py-2 rounded-2xl text-xs font-semibold hover:bg-well flex items-center gap-1.5 text-fg transition-colors border border-transparent hover:border-line"
            >
              <BookOpen size={15} className="text-primary" />
              <span>Bank Soal</span>
            </Link>
            <Link
              href="/admin/kategori"
              className="px-3.5 py-2 rounded-2xl text-xs font-semibold hover:bg-well flex items-center gap-1.5 text-fg transition-colors border border-transparent hover:border-line"
            >
              <FolderTree size={15} className="text-highlight" />
              <span>Kategori</span>
            </Link>
            <Link
              href="/admin/kuis"
              className="px-3.5 py-2 rounded-2xl text-xs font-semibold hover:bg-well flex items-center gap-1.5 text-fg transition-colors border border-transparent hover:border-line"
            >
              <Radio size={15} className="text-primary" />
              <span>Kuis Live</span>
            </Link>
            <Link
              href="/admin/hasil"
              className="px-3.5 py-2 rounded-2xl text-xs font-semibold hover:bg-well flex items-center gap-1.5 text-fg transition-colors border border-transparent hover:border-line"
            >
              <ClipboardList size={15} className="text-primary" />
              <span>Hasil Ujian</span>
            </Link>

            {admin.role === 'super_admin' && (
              <Link
                href="/admin/kelola-admin"
                className="px-3.5 py-2 rounded-2xl text-xs font-semibold hover:bg-well flex items-center gap-1.5 text-fg transition-colors border border-transparent hover:border-line"
              >
                <Users size={15} className="text-highlight" />
                <span>Kelola Admin</span>
              </Link>
            )}

            <form action={logoutAdminAction} className="ml-2 pl-2 border-l border-line">
              <button
                type="submit"
                className="p-2 rounded-2xl well hover:bg-brick-50 text-fg-subtle hover:text-danger transition-colors border border-line"
                title="Keluar"
              >
                <LogOut size={16} />
              </button>
            </form>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 w-full">{children}</div>
    </div>
  );
}
