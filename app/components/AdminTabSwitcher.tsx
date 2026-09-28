"use client";

import Image from 'next/image';
import React, { useEffect, useState, useCallback } from 'react';
import {
  FileQuestion,
  BarChart3,
  TrendingUp,
  Settings,
  PlayCircle,
  Shield,
  Sun,
  Moon,
  Menu,
  X,
  CalendarClock,
  LogOut,
} from 'lucide-react';

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

const tabs: Array<{
  id: AdminTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accessOnly?: boolean;
  settingsOnly?: boolean;
}> = [
  { id: 'questions', label: 'Soal', icon: FileQuestion },
  { id: 'quiz', label: 'Kuis live', icon: PlayCircle },
  { id: 'results', label: 'Hasil ujian', icon: BarChart3 },
  { id: 'analytics', label: 'Analitik', icon: TrendingUp },
  { id: 'scheduled', label: 'Jadwal ujian', icon: CalendarClock },
  { id: 'settings', label: 'Pengaturan', icon: Settings, settingsOnly: true },
  { id: 'access', label: 'Akses admin', icon: Shield, accessOnly: true },
];

function NavButton({
  tab,
  activeTab,
  onTabChange,
  theme = 'dark',
}: {
  tab: typeof tabs[number];
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  theme?: 'light' | 'dark';
}) {
  const isActive = activeTab === tab.id;
  const Icon = tab.icon;

  const styles =
    theme === 'dark'
      ? isActive
        ? 'bg-white text-dark-900 font-semibold shadow-ios-sm'
        : 'text-white/70 hover:text-white hover:bg-white/5 font-medium'
      : isActive
        ? 'bg-nike-black text-white font-semibold shadow-ios-sm'
        : 'text-black/70 hover:text-nike-black hover:bg-black/5 font-medium';

  return (
    <button
      type="button"
      onClick={() => onTabChange(tab.id)}
      role="tab"
      aria-selected={isActive}
      className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] rounded-2xl transition-spring-fast active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 ${
        theme === 'dark' ? 'focus-visible:ring-white/40' : 'focus-visible:ring-nike-black/30'
      } ${styles}`}
    >
      <Icon size={17} className="shrink-0" />
      <span className="truncate">{tab.label}</span>
    </button>
  );
}

export default function AdminTabSwitcher({
  activeTab,
  onTabChange,
  onLogout,
  adminEmail,
  adminRole,
  canAccessManage,
  canViewSettings,
  theme = 'dark',
  onToggleTheme,
}: AdminTabSwitcherProps) {
  const isDark = theme === 'dark';
  const visibleTabs = tabs.filter(
    (tab) => (!tab.accessOnly || canAccessManage) && (!tab.settingsOnly || canViewSettings)
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && mobileOpen) {
      setMobileOpen(false);
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = previous;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [mobileOpen, handleKeyDown]);

  const handleMobileTab = (tab: AdminTab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden h-dvh w-[240px] shrink-0 flex-col overflow-hidden border-r px-3.5 py-4 md:flex ${
          isDark
            ? 'border-white/10 bg-dark-900 text-dark-text-primary'
            : 'border-black/10 bg-white text-nike-black'
        }`}
      >
        {/* Brand header */}
        <div className="px-2 pb-4 pt-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5 p-1.5">
              <Image src="/favicon.ico" alt="Smandapura Exam App" width={32} height={32} priority />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-bold leading-tight tracking-tight">
                Smandapura
              </div>
              <div className={`text-[11px] font-medium ${isDark ? 'text-white/50' : 'text-black/50'}`}>
                Admin console
              </div>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-1 py-1" role="tablist" aria-label="Menu navigasi admin">
          {visibleTabs.map((tab) => (
            <NavButton
              key={tab.id}
              tab={tab}
              activeTab={activeTab}
              onTabChange={onTabChange}
              theme={theme}
            />
          ))}
        </nav>

        <div className="flex-1" />

        {/* Account card & Actions */}
        <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
          {adminEmail && (
            <div
              className={`rounded-2xl px-3 py-2.5 ${
                isDark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold uppercase ${
                    isDark ? 'bg-white/15 text-white' : 'bg-nike-black text-white'
                  }`}
                >
                  {adminEmail[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[12.5px] font-medium tracking-tight"
                    title={adminEmail}
                  >
                    {adminEmail}
                  </p>
                  <p
                    className={`truncate text-[11px] ${
                      isDark ? 'text-white/50' : 'text-black/50'
                    }`}
                  >
                    {adminRole || 'Administrator'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
                className={`flex-1 flex h-9 items-center justify-center gap-2 rounded-2xl text-[12px] font-medium transition-spring-fast active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${
                  isDark
                    ? 'bg-white/5 text-white hover:bg-white/10 focus-visible:ring-white/40'
                    : 'bg-black/5 text-nike-black hover:bg-black/10 focus-visible:ring-nike-black/30'
                }`}
              >
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
                <span>{isDark ? 'Terang' : 'Gelap'}</span>
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                aria-label="Keluar dari akun admin"
                className={`flex h-9 px-3 items-center justify-center gap-1.5 rounded-2xl text-[12px] font-medium transition-spring-fast active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${
                  isDark
                    ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25 focus-visible:ring-accent-red/40'
                    : 'bg-red-50 text-red-600 hover:bg-red-100 focus-visible:ring-red-500/30'
                }`}
              >
                <LogOut size={14} />
                <span>Keluar</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile top navigation bar */}
      <div
        className={`fixed top-0 inset-x-0 z-30 flex h-14 items-center justify-between px-4 border-b md:hidden backdrop-blur-xl ${
          isDark
            ? 'border-white/10 bg-dark-900/90 text-dark-text-primary'
            : 'border-black/10 bg-white/90 text-nike-black'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Image src="/favicon.ico" alt="Smandapura" width={24} height={24} />
          <span className="text-[14px] font-bold tracking-tight">Smandapura Admin</span>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-spring-fast active:scale-90 focus-visible:ring-2 ${
            isDark
              ? 'bg-white/10 text-white focus-visible:ring-white/40'
              : 'bg-black/5 text-nike-black focus-visible:ring-nike-black/30'
          }`}
          aria-label="Buka menu admin"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi admin"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <aside
            className={`absolute inset-y-0 right-0 flex h-full w-[280px] max-w-[85vw] flex-col overflow-y-auto p-4 shadow-ios-xl ${
              isDark ? 'bg-dark-900 text-dark-text-primary' : 'bg-white text-nike-black'
            }`}
          >
            <div className="mb-4 flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Image src="/favicon.ico" alt="Smandapura" width={28} height={28} />
                <span className="text-[15px] font-bold tracking-tight">Menu admin</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-spring-fast active:scale-90 ${
                  isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-nike-black'
                }`}
                aria-label="Tutup menu"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="flex flex-col gap-1 py-2" role="tablist">
              {visibleTabs.map((tab) => (
                <NavButton
                  key={tab.id}
                  tab={tab}
                  activeTab={activeTab}
                  onTabChange={handleMobileTab}
                  theme={theme}
                />
              ))}
            </nav>

            <div className="flex-1" />

            <div className="space-y-2 pt-3 border-t border-black/5 dark:border-white/5">
              {adminEmail && (
                <div
                  className={`rounded-2xl px-3 py-2.5 ${
                    isDark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'
                  }`}
                >
                  <p className="truncate text-[12px] font-medium tracking-tight" title={adminEmail}>
                    {adminEmail}
                  </p>
                  <p className={`text-[11px] ${isDark ? 'text-white/50' : 'text-black/50'}`}>
                    {adminRole || 'Administrator'}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className={`flex-1 flex h-9 items-center justify-center gap-2 rounded-2xl text-[12px] font-medium transition-spring-fast active:scale-95 ${
                      isDark ? 'bg-white/5 text-white' : 'bg-black/5 text-nike-black'
                    }`}
                  >
                    {isDark ? <Sun size={14} /> : <Moon size={14} />}
                    <span>{isDark ? 'Terang' : 'Gelap'}</span>
                  </button>
                )}

                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      setMobileOpen(false);
                    }}
                    className={`flex h-9 px-3 items-center justify-center gap-1.5 rounded-2xl text-[12px] font-medium transition-spring-fast active:scale-95 ${
                      isDark
                        ? 'bg-accent-red/15 text-accent-red'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    <LogOut size={14} />
                    <span>Keluar</span>
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
