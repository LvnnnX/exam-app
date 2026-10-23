"use client";

import React from 'react';

type SettingsLoadingStateProps = {
  theme?: 'light' | 'dark';
};

export default function SettingsLoadingState({ theme = 'dark' }: SettingsLoadingStateProps) {
  return (
    <div data-theme={theme} className="flex items-center gap-2 p-6 text-[14px] font-medium text-fg-muted" role="status">
      <span className="spinner-calm h-4 w-4" aria-hidden="true" />
      Loading settings...
    </div>
  );
}
