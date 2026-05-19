"use client";

import React from 'react';

type SettingsSaveBarProps = {
  settingsDirty: boolean;
  settingsSaving: boolean;
  onSave: () => void;
  theme?: 'light' | 'dark';
};

export default function SettingsSaveBar({
  settingsDirty,
  settingsSaving,
  onSave,
  theme = 'dark',
}: SettingsSaveBarProps) {
  return (
    <div className={`flex items-center justify-between px-5 py-4 ${theme === 'dark' ? 'border-t border-white/[0.04]' : 'border-t border-black/[0.04]'}`}>
      {settingsDirty ? (
        <span className={`text-[11px] font-medium ${theme === 'dark' ? 'text-accent-orange' : 'text-amber-600'}`}>● Unsaved changes</span>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={settingsSaving || !settingsDirty}
        className={`h-9 rounded-full px-5 text-[12px] font-medium transition-spring-fast active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${settingsDirty && !settingsSaving ? (theme === 'dark' ? 'bg-white text-gray-900 hover:bg-white/90' : 'bg-gray-900 text-white hover:bg-gray-800') : (theme === 'dark' ? 'bg-white/5 text-dark-text-tertiary' : 'bg-black/5 text-gray-500')}`}
      >
        {settingsSaving ? 'Saving...' : 'Save settings'}
      </button>
    </div>
  );
}
