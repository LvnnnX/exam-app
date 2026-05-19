"use client";

import React from 'react';

type SettingsIntroCardProps = {
  theme?: 'light' | 'dark';
};

export default function SettingsIntroCard({ theme = 'dark' }: SettingsIntroCardProps) {
  return (
    <div className={`px-5 pb-5 pt-6 ${theme === 'dark' ? 'border-b border-white/[0.04]' : 'border-b border-black/[0.04]'}`}>
      <h2 className={`text-[20px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Visibility settings</h2>
      <p className={`mt-1 text-[12px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>
        Configure visibility for Bab and Sub-bab. &quot;Hidden&quot; removes it completely. &quot;Only Admin&quot; allows admins to select it but hides it from users.
      </p>
    </div>
  );
}
