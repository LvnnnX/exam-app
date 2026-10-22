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
}: SettingsSaveBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
      {settingsDirty ? (
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-highlight-fg" role="status">
          <span className="h-1.5 w-1.5 rounded-full bg-highlight" aria-hidden="true" />
          Unsaved changes
        </span>
      ) : (
        <span className="text-[13px] text-fg-muted">All changes saved.</span>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={settingsSaving || !settingsDirty}
        className="clay-primary h-11 rounded-xl px-6 text-[14px] font-semibold"
      >
        {settingsSaving ? 'Saving...' : 'Save settings'}
      </button>
    </div>
  );
}
