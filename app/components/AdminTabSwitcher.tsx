"use client";

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { FileQuestion, BarChart3, TrendingUp, Settings, PlayCircle, Shield, Sun, Moon, Menu, X, CalendarClock } from 'lucide-react';

type AdminTab = 'questions' | 'results' | 'analytics' | 'settings' | 'quiz' | 'scheduled' | 'access';

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
  { id: 'questions', label: 'Questions', icon: FileQuestion },
  { id: 'results', label: 'Results', icon: BarChart3 },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'quiz', label: 'Quiz', icon: PlayCircle },
  { id: 'scheduled', label: 'Scheduled', icon: CalendarClock },
  { id: 'settings', label: 'Settings', icon: Settings, settingsOnly: true },
  { id: 'access', label: 'Access', icon: Shield, accessOnly: true },
];

function NavButton({ tab, activeTab, onTabChange, theme = 'dark' }: {
  tab: typeof tabs[number];
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  theme?: 'light' | 'dark';
}) {
  const isActive = activeTab === tab.id;
  const Icon = tab.icon;

  // Per LOGIKA-08 §3.6 Nav Button Anatomy:
  //   Active dark: bg-white/10 text-dark-text-primary shadow-ios-sm
  //   Default dark: text-dark-text-secondary hover:bg-white/5
  //   Active light: bg-black/10 text-gray-900
  //   Default light: text-gray-600 hover:bg-black/5
  const styles = theme === 'dark'
    ? isActive
      ? 'bg-white/10 text-dark-text-primary shadow-ios-sm'
      : 'text-dark-text-secondary hover:bg-white/5'
    : isActive
      ? 'bg-black/10 text-gray-900'
      : 'text-gray-600 hover:bg-black/5';

  return (
    <button
      type="button"
      onClick={() => onTabChange(tab.id)}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] rounded-full font-medium transition-spring-fast active:scale-95 ${styles}`}
    >
      <Icon size={16} className="shrink-0" />
      {tab.label}
    </button>
  );
}

export default function AdminTabSwitcher({ activeTab, onTabChange, onLogout, adminEmail, adminRole, canAccessManage, canViewSettings, theme = 'dark', onToggleTheme }: AdminTabSwitcherProps) {
  const visibleTabs = tabs.filter((tab) => (!tab.accessOnly || canAccessManage) && (!tab.settingsOnly || canViewSettings));
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = previous; };
    }
  }, [mobileOpen]);

  const handleMobileTab = (tab: AdminTab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop sidebar — per LOGIKA-08 §3.6: w-[228px], gap-1 nav, brand top, theme + account bottom */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden h-screen w-[228px] shrink-0 flex-col overflow-hidden border-r px-3 py-4 md:flex ${theme === 'dark' ? 'border-dark-border-subtle bg-dark-850' : 'border-black/10 bg-white'}`}>
        <div className="px-1 pb-5">
          <div className="flex items-center gap-2">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center">
              <Image src="/favicon.ico" alt="Smandapura Exam App" width={44} height={44} priority />
            </div>
            <div className="min-w-0">
              <div className={`text-xl font-bold leading-none tracking-[-0.03em] ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>
                Smandapura<br />Exam App
              </div>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {visibleTabs.map((tab) => (
            <NavButton key={tab.id} tab={tab} activeTab={activeTab} onTabChange={onTabChange} theme={theme} />
          ))}
        </nav>

        <div className="flex-1" />

        {/* Bottom row: theme toggle + account chip */}
        {adminEmail && (
          <div className={`mb-3 rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold uppercase ${theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-gray-900 text-white'}`}>
                {adminEmail[0]}
              </div>
              <div className="min-w-0">
                <p className={`truncate text-[13px] font-medium tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`} title={adminEmail}>{adminEmail}</p>
                <p className={`mt-0.5 text-[11px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-black/55'}`}>{adminRole || 'Administrator'}</p>
              </div>
            </div>
          </div>
        )}

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className={`mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-primary hover:bg-white/10' : 'bg-black/5 text-nike-black hover:bg-black/10'}`}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        )}

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className={`h-10 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
          >
            Logout
          </button>
        )}
      </aside>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className={`fixed right-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full transition-spring-fast active:scale-90 md:hidden ${theme === 'dark' ? 'bg-white/10 text-dark-text-primary backdrop-blur-md' : 'bg-black/5 text-nike-black backdrop-blur-md'}`}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <aside className={`absolute inset-y-0 right-0 flex h-full w-[280px] max-w-[85vw] flex-col overflow-y-auto px-4 py-4 shadow-ios-xl ${theme === 'dark' ? 'bg-dark-850' : 'bg-white'}`}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                  <Image src="/favicon.ico" alt="Smandapura Exam App" width={32} height={32} />
                </div>
                <div className={`text-[15px] font-semibold leading-tight tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`}>
                  Smandapura
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-spring-fast active:scale-90 ${theme === 'dark' ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-black/55 hover:bg-black/10'}`}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {visibleTabs.map((tab) => (
                <NavButton key={tab.id} tab={tab} activeTab={activeTab} onTabChange={handleMobileTab} theme={theme} />
              ))}
            </nav>

            <div className="flex-1" />

            {adminEmail && (
              <div className={`mt-4 mb-3 rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold uppercase ${theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-gray-900 text-white'}`}>
                    {adminEmail[0]}
                  </div>
                  <div className="min-w-0">
                    <p className={`truncate text-[13px] font-medium tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-nike-black'}`} title={adminEmail}>{adminEmail}</p>
                    <p className={`mt-0.5 text-[11px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-black/55'}`}>{adminRole || 'Administrator'}</p>
                  </div>
                </div>
              </div>
            )}

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className={`mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-white/5 text-dark-text-primary hover:bg-white/10' : 'bg-black/5 text-nike-black hover:bg-black/10'}`}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                onClick={() => { onLogout(); setMobileOpen(false); }}
                className={`h-10 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
              >
                Logout
              </button>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
