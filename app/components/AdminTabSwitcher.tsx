"use client";

import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { FileQuestion, BarChart3, TrendingUp, Settings, PlayCircle, Shield, Sun, Moon, Menu, X, LogOut } from 'lucide-react';

type AdminTab = 'questions' | 'results' | 'analytics' | 'settings' | 'quiz' | 'access';

type AdminTabSwitcherProps = {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLogout?: () => void;
  onAddQuestion?: () => void;
  onCreateQuiz?: () => void;
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
  { id: 'settings', label: 'Settings', icon: Settings, settingsOnly: true },
  { id: 'access', label: 'Access', icon: Shield, accessOnly: true },
];

const tips: Record<AdminTab, string> = {
  questions: 'Filter topic first before batch hide/show.',
  results: 'Use History for completed exams, Live for active users.',
  analytics: 'Find weak topics, difficult questions, and score trends.',
  quiz: 'Create sessions from curated topics, then track players live.',
  settings: 'Save visibility changes after editing topic access.',
  access: 'Manage admin roles carefully; avoid removing your own access.',
};

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

export default function AdminTabSwitcher({ activeTab, onTabChange, onLogout, onAddQuestion, onCreateQuiz, adminEmail, adminRole, canAccessManage, canViewSettings, theme = 'dark', onToggleTheme }: AdminTabSwitcherProps) {
  const visibleTabs = tabs.filter((tab) => (!tab.accessOnly || canAccessManage) && (!tab.settingsOnly || canViewSettings));
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? 'Admin';

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

  const secondaryAction = 'well well-hover flex h-11 w-full items-center gap-2.5 rounded-xl px-3.5 text-left text-[13px] font-medium text-fg transition-calm';

  return (
    <>
      <aside className="glass fixed inset-y-3 left-3 z-40 hidden w-[228px] shrink-0 flex-col overflow-y-auto rounded-4xl px-3 py-4 md:flex">
        <div className="mb-5 flex items-center gap-2.5 px-1.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center">
            <Image src="/favicon.ico" alt="" width={36} height={36} priority />
          </div>
          <div className="min-w-0 text-[15px] font-bold leading-tight tracking-tight text-fg">
            Smandapura<br />Exam App
          </div>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Admin">
          {visibleTabs.map((tab) => (
            <NavButton key={tab.id} tab={tab} activeTab={activeTab} onTabChange={onTabChange} />
          ))}
        </nav>

        {(onAddQuestion || onCreateQuiz) && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 px-1.5 text-[12px] font-medium text-fg-muted">Quick action</p>
            <div className="space-y-1.5">
              {onAddQuestion && (
                <button type="button" onClick={onAddQuestion} className={secondaryAction}>
                  <FileQuestion size={16} className="shrink-0 text-fg-subtle" />
                  Add question
                </button>
              )}
              {onCreateQuiz && (
                <button type="button" onClick={onCreateQuiz} className={secondaryAction}>
                  <PlayCircle size={16} className="shrink-0 text-fg-subtle" />
                  Create quiz
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 px-1.5">
          <p className="mb-1 text-[12px] font-medium text-fg-muted">Tip</p>
          <p className="text-[13px] leading-relaxed text-fg">{tips[activeTab]}</p>
        </div>

        <div className="flex-1" />

        <div className="mt-5 space-y-3 border-t border-line pt-4">
          {adminEmail && <IdentityRow adminEmail={adminEmail} adminRole={adminRole} />}

          <div className="flex gap-1.5">
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="well well-hover flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-medium text-fg transition-calm"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            )}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-danger/10 text-[13px] font-semibold text-danger transition-calm hover:bg-danger/15"
              >
                <LogOut size={16} />
                Logout
              </button>
            )}
          </div>

          <p className="px-1.5 text-[12px] font-medium text-fg-subtle">
            Smandapura Exam App v1.0
          </p>
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
          aria-label="Open menu"
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
          aria-label="Admin menu"
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
                  Smandapura
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="well well-hover flex h-11 w-11 items-center justify-center rounded-xl text-fg transition-calm"
                aria-label="Close menu"
                autoFocus
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex flex-col gap-1" aria-label="Admin">
              {visibleTabs.map((tab) => (
                <NavButton key={tab.id} tab={tab} activeTab={activeTab} onTabChange={handleMobileTab} />
              ))}
            </nav>

            {(onAddQuestion || onCreateQuiz) && (
              <div className="mt-4 space-y-1.5 border-t border-line pt-4">
                <p className="px-1.5 text-[12px] font-medium text-fg-muted">Quick action</p>
                {onAddQuestion && (
                  <button
                    type="button"
                    onClick={() => { onAddQuestion(); setMobileOpen(false); }}
                    className={secondaryAction}
                  >
                    <FileQuestion size={16} className="shrink-0 text-fg-subtle" />
                    Add question
                  </button>
                )}
                {onCreateQuiz && (
                  <button
                    type="button"
                    onClick={() => { onCreateQuiz(); setMobileOpen(false); }}
                    className={secondaryAction}
                  >
                    <PlayCircle size={16} className="shrink-0 text-fg-subtle" />
                    Create quiz
                  </button>
                )}
              </div>
            )}

            <div className="flex-1" />

            <div className="mt-4 space-y-3 border-t border-line pt-4">
              {adminEmail && <IdentityRow adminEmail={adminEmail} adminRole={adminRole} />}

              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="well well-hover flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-medium text-fg transition-calm"
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  onClick={() => { onLogout(); setMobileOpen(false); }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-danger/10 text-[13px] font-semibold text-danger transition-calm hover:bg-danger/15"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
