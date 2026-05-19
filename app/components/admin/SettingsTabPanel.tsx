"use client";

import React from 'react';
import { type BabInfo, type SubBabInfo, type VisibilitySettings } from '@/lib/questions';
import SettingsIntroCard from '@/app/components/admin/SettingsIntroCard';
import SettingsLoadingState from '@/app/components/admin/SettingsLoadingState';
import SettingsMapelTree from '@/app/components/admin/SettingsMapelTree';
import SettingsSaveBar from '@/app/components/admin/SettingsSaveBar';

type SettingsTabPanelProps = {
  settingsLoading: boolean;
  allMapels: BabInfo[];
  allBabs: BabInfo[];
  allSubBabsAdmin: SubBabInfo[];
  expandedBabs: string[];
  visibilitySettings: VisibilitySettings;
  deletingTopic: boolean;
  mapelBabSubBabMap: Map<string, Map<string, Set<string>>>;
  settingsDirty: boolean;
  settingsSaving: boolean;
  onToggleExpanded: (slug: string) => void;
  onVisibilityChange: (type: 'mapels' | 'babs' | 'sub_babs', slug: string, state: 'visible' | 'admin_only' | 'hidden') => void;
  canDeleteTopic: boolean;
  canSaveSettings: boolean;
  onDeleteTopic: (type: 'mapels' | 'babs' | 'sub_babs', slug: string) => void;
  onSaveSettings: () => void;
  theme?: 'light' | 'dark';
};

export default function SettingsTabPanel({
  settingsLoading,
  allMapels,
  allBabs,
  allSubBabsAdmin,
  expandedBabs,
  visibilitySettings,
  deletingTopic,
  mapelBabSubBabMap,
  settingsDirty,
  settingsSaving,
  onToggleExpanded,
  onVisibilityChange,
  canDeleteTopic,
  canSaveSettings,
  onDeleteTopic,
  onSaveSettings,
  theme = 'dark',
}: SettingsTabPanelProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className={`overflow-hidden rounded-3xl ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`}>
        <SettingsIntroCard theme={theme} />

        {settingsLoading ? (
          <SettingsLoadingState theme={theme} />
        ) : (
          <SettingsMapelTree
            allMapels={allMapels}
            allBabs={allBabs}
            allSubBabsAdmin={allSubBabsAdmin}
            expandedBabs={expandedBabs}
            visibilitySettings={visibilitySettings}
            deletingTopic={deletingTopic}
            mapelBabSubBabMap={mapelBabSubBabMap}
            onToggleExpanded={onToggleExpanded}
            onVisibilityChange={onVisibilityChange}
            canDeleteTopic={canDeleteTopic}
            onDeleteTopic={onDeleteTopic}
            theme={theme}
          />
        )}
        <SettingsSaveBar
          settingsDirty={settingsDirty}
          settingsSaving={settingsSaving || !canSaveSettings}
          onSave={canSaveSettings ? onSaveSettings : () => undefined}
          theme={theme}
        />
      </div>
    </div>
  );
}
