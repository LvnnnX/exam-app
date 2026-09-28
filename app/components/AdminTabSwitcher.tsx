"use client";

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { FileQuestion, BarChart3, TrendingUp, Settings, PlayCircle, Shield, Sun, Moon, Menu, X, LogOut, CalendarClock } from 'lucide-react';

export type AdminTab = 'questions' | 'results' | 'analytics' | 'settings' | 'quiz' | 'scheduled' | 'access';

type AdminTabSwitcherProps = {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLogout?: () => void;
  adminEmail?: string;
  adminRole?: string;
  canAccessManage?: boolean;
  canViewSettings?: boolean;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
};

const tabs: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; accessOnly?: boolean; settingsOnly?: boolean }> = [
  { id: 'questions', label: 'Soal', icon: FileQuestion },
  { id: 'quiz', label: 'Kuis live', icon: PlayCircle },
  { id: 'results', label: 'Hasil ujian', icon: BarChart3 },
  { id: 'analytics', label: 'Analitik', icon: TrendingUp },
  { id: 'scheduled', label: 'Jadwal ujian', icon: CalendarClock },
  { id: 'settings', label: 'Pengaturan', icon: Settings, settingsOnly: true },
  { id: 'access', label: 'Akses admin', icon: Shield, accessOnly: true },
];

function NavButton({ tab, activeTab, onTabChange }: {
  tab: typeof tabs[number];
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}) {
  const isActive = activeTab === tab.id;
  const Icon = tab.icon;

  return (
    <button
      type="button"
      onClick={() => onTabChange(tab.id)}
      aria-current={isActive ? 'page' : undefined}
      className={`flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[14px] transition-calm ${
        isActive ? 'well font-semibold text-fg' : 'font-medium text-fg-muted well-hover hover:text-fg'
      }`}
    >
      <Icon size={17} className={`shrink-0 ${isActive ? 'text-primary' : 'text-fg-subtle'}`} />
      {tab.label}
    </button>
  );
}

function IdentityRow({ adminEmail, adminRole }: { adminEmail: string; adminRole?: string }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="clay flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold uppercase" aria-hidden="true">
        {adminEmail[0]}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-fg" title={adminEmail}>{adminEmail}</p>
        <p className="mt-0.5 text-[12px] font-medium capitalize text-fg-muted">{adminRole || 'Administrator'}</p>
      </div>
    </div>
  );
}

export default function AdminTabSwitcher({ activeTab, onTabChange, onLogout, adminEmail, adminRole, canAccessManage, canViewSettings, theme = 'dark', onToggleTheme }: AdminTabSwitcherProps) {
  const visibleTabs = tabs.filter((tab) => (!tab.accessOnly || canAccessManage) && (!tab.settingsOnly || canViewSettings));
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? 'Admin';
  const isDark = theme === 'dark';

  useEffect(() => {
    if (mobileOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setMobileOpen(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = previous;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [mobileOpen]);

  const handleMobileTab = (tab: AdminTab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  const themeLabel = isDark ? 'Terang' : 'Gelap';
  const themeAria = isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap';

  return (
    <>
      <aside className="glass fixed inset-y-3 left-3 z-40 hidden w-[228px] shrink-0 flex-col overflow-y-auto rounded-4xl px-3 py-4 md:flex">
        <div className="mb-5 flex items-center gap-2.5 px-1.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center">
            <Image src="/favicon.ico" alt="" width={36} height={36} priority />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold leading-tight tracking-tight text-fg">Smandapura</div>
            <div className="text-[12px] font-medium text-fg-muted">Admin console</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Menu navigasi admin">
          {visibleTabs.map((tab) => (
            <NavButton key={tab.id} tab={tab} activeTab={activeTab} onTabChange={onTabChange} />
          ))}
        </nav>

        <div className="flex-1" />

        <div className="mt-5 space-y-3 border-t border-line pt-4">
          {adminEmail && <IdentityRow adminEmail={adminEmail} adminRole={adminRole} />}

          <div className="flex gap-1.5">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="well well-hover flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-medium text-fg transition-calm"
                aria-label={themeAria}
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                {themeLabel}
              </button>
            )}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                aria-label="Keluar dari akun admin"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-danger/10 text-[13px] font-semibold text-danger transition-calm hover:bg-danger/15"
              >
                <LogOut size={16} />
                Keluar
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="glass fixed inset-x-3 top-3 z-40 flex h-14 items-center justify-between rounded-3xl pl-4 pr-1.5 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Image src="/favicon.ico" alt="" width={24} height={24} />
          <span className="truncate text-[15px] font-bold tracking-tight text-fg">{activeLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="well-hover flex h-11 w-11 items-center justify-center rounded-xl text-fg transition-calm"
          aria-label="Buka menu admin"
          aria-expanded={mobileOpen}
        >
          <Menu size={20} />
        </button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi admin"
        >
          <div
            className="glass-scrim absolute inset-0"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="glass-strong animate-in absolute inset-y-2 right-2 flex w-[288px] max-w-[88vw] flex-col overflow-y-auto rounded-4xl px-3 py-3">
            <div className="mb-4 flex items-center justify-between pl-2">
              <div className="flex min-w-0 items-center gap-2">
                <Image src="/favicon.ico" alt="" width={28} height={28} />
                <div className="text-[15px] font-bold leading-tight tracking-tight text-fg">
                  Menu admin
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="well well-hover flex h-11 w-11 items-center justify-center rounded-xl text-fg transition-calm"
                aria-label="Tutup menu"
                autoFocus
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex flex-col gap-1" aria-label="Menu navigasi admin">
              {visibleTabs.map((tab) => (
                <NavButton key={tab.id} tab={tab} activeTab={activeTab} onTabChange={handleMobileTab} />
              ))}
            </nav>

            <div className="flex-1" />

            <div className="mt-4 space-y-3 border-t border-line pt-4">
              {adminEmail && <IdentityRow adminEmail={adminEmail} adminRole={adminRole} />}

              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  aria-label={themeAria}
                  className="well well-hover flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-medium text-fg transition-calm"
                >
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  {themeLabel}
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  onClick={() => { onLogout(); setMobileOpen(false); }}
                  aria-label="Keluar dari akun admin"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-danger/10 text-[13px] font-semibold text-danger transition-calm hover:bg-danger/15"
                >
                  <LogOut size={16} />
                  Keluar
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
