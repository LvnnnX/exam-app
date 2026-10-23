"use client";

import React from 'react';
import AdminQuizTab from '@/app/components/AdminQuizTab';
import { type BabInfo, type SubBabInfo, type VisibilitySettings } from '@/lib/questions';
import { normalizeCategorySlug } from '@/lib/categories';

type AdminQuizTabPanelProps = {
  allMapels: BabInfo[];
  allBabs: BabInfo[];
  allSubBabsAdmin: SubBabInfo[];
  visibilitySettings: VisibilitySettings;
  theme?: 'light' | 'dark';
};

export default function AdminQuizTabPanel({
  allMapels,
  allBabs,
  allSubBabsAdmin,
  visibilitySettings,
  theme = 'dark',
}: AdminQuizTabPanelProps) {
  return (
    <AdminQuizTab
      mapels={allMapels.filter(m => !visibilitySettings.hidden_mapels.includes(normalizeCategorySlug(m.value))).map(m => m.value)}
      babs={allBabs.filter(b => !visibilitySettings.hidden_babs.includes(normalizeCategorySlug(b.value))).map(hb => hb.value)}
      subBabs={allSubBabsAdmin.filter(c => !visibilitySettings.hidden_sub_babs.includes(normalizeCategorySlug(c.value)))}
      theme={theme}
    />
  );
}
