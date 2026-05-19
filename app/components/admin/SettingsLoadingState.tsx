"use client";

import React from 'react';

type SettingsLoadingStateProps = {
  theme?: 'light' | 'dark';
};

export default function SettingsLoadingState({ theme = 'dark' }: SettingsLoadingStateProps) {
  return <div className={`p-6 text-sm animate-pulse ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Loading settings...</div>;
}
