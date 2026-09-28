"use client";

import React from 'react';

type SettingsIntroCardProps = {
  theme?: 'light' | 'dark';
};

const LEGEND = [
  { label: 'Visible', detail: 'Students can pick it.' },
  { label: 'Admin only', detail: 'Admins can pick it, students cannot see it.' },
  { label: 'Hidden', detail: 'Removed from every picker.' },
];

export default function SettingsIntroCard({ theme = 'dark' }: SettingsIntroCardProps) {
  return (
    <div data-theme={theme} className="border-b border-line px-5 pb-5 pt-6">
      <h2 className="text-[22px] font-bold tracking-tight text-fg">Visibility settings</h2>
      <p className="mt-1 text-[13px] text-fg-muted">
        Configure visibility for mapel, bab, and sub-bab.
      </p>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-baseline gap-1.5 text-[13px]">
            <dt className="font-semibold text-fg">{item.label}</dt>
            <dd className="text-fg-muted">{item.detail}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
