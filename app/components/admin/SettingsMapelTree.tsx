"use client";

import React from 'react';
import { type BabInfo, type SubBabInfo, type VisibilitySettings } from '@/lib/questions';
import { normalizeCategorySlug } from '@/lib/categories';

type SettingsMapelTreeProps = {
  allMapels: BabInfo[];
  allBabs: BabInfo[];
  allSubBabsAdmin: SubBabInfo[];
  expandedBabs: string[];
  visibilitySettings: VisibilitySettings;
  deletingTopic: boolean;
  mapelBabSubBabMap: Map<string, Map<string, Set<string>>>;
  onToggleExpanded: (slug: string) => void;
  onVisibilityChange: (type: 'mapels' | 'babs' | 'sub_babs', slug: string, state: 'visible' | 'admin_only' | 'hidden') => void;
  canDeleteTopic: boolean;
  onDeleteTopic: (type: 'mapels' | 'babs' | 'sub_babs', slug: string) => void;
  theme?: 'light' | 'dark';
};

export default function SettingsMapelTree({
  allMapels,
  allBabs,
  allSubBabsAdmin,
  expandedBabs,
  visibilitySettings,
  deletingTopic,
  mapelBabSubBabMap,
  onToggleExpanded,
  onVisibilityChange,
  canDeleteTopic,
  onDeleteTopic,
  theme = 'dark',
}: SettingsMapelTreeProps) {
  return (
    <div className="space-y-2.5 p-5">
      {allMapels.length === 0 && (
        <p className={`text-sm ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>No Mapel found. Add questions first.</p>
      )}
      {allMapels.map(mapel => {
        const mapelSlug = normalizeCategorySlug(mapel.value);
        const isMapelExpanded = expandedBabs.includes(mapelSlug);
        const mapelState = visibilitySettings.hidden_mapels.includes(mapelSlug)
          ? 'hidden'
          : visibilitySettings.admin_only_mapels.includes(mapelSlug)
            ? 'admin_only'
            : 'visible';

        return (
          <div key={mapelSlug} className={`overflow-hidden rounded-2xl ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
            <div
              className={`flex cursor-pointer items-center justify-between px-4 py-3.5 transition-spring-fast ${theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.015]'}`}
              onClick={() => onToggleExpanded(mapelSlug)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <svg className={`h-4 w-4 shrink-0 transition-transform ${isMapelExpanded ? 'rotate-90' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="min-w-0">
                  <h3 className={`truncate text-[14px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>{mapel.label}</h3>
                  <p className={`truncate text-[11px] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>{mapelSlug}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <div className={`inline-flex h-8 rounded-full p-0.5 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => onVisibilityChange('mapels', mapelSlug, 'hidden')}
                    className={`flex h-7 w-9 items-center justify-center rounded-full transition-spring-fast ${mapelState === 'hidden' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary hover:text-dark-text-secondary' : 'text-gray-500 hover:text-gray-700')}`}
                    title="Hidden"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onVisibilityChange('mapels', mapelSlug, 'admin_only')}
                    className={`flex h-7 w-9 items-center justify-center rounded-full transition-spring-fast ${mapelState === 'admin_only' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary hover:text-dark-text-secondary' : 'text-gray-500 hover:text-gray-700')}`}
                    title="Admin only"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onVisibilityChange('mapels', mapelSlug, 'visible')}
                    className={`flex h-7 w-9 items-center justify-center rounded-full transition-spring-fast ${mapelState === 'visible' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary hover:text-dark-text-secondary' : 'text-gray-500 hover:text-gray-700')}`}
                    title="Visible"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  </button>
                </div>
                {canDeleteTopic && (
                  <button
                    type="button"
                    onClick={() => onDeleteTopic('mapels', mapelSlug)}
                    disabled={deletingTopic}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-spring-fast disabled:opacity-50 ${theme === 'dark' ? 'text-dark-text-tertiary hover:bg-white/[0.05] hover:text-accent-red' : 'text-gray-400 hover:bg-black/[0.04] hover:text-red-600'}`}
                    title="Hapus Mapel"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>

            {isMapelExpanded && (
              <div className={`border-t ${theme === 'dark' ? 'border-white/[0.04]' : 'border-black/[0.04]'}`}>
                {Array.from(mapelBabSubBabMap.get(mapelSlug)?.entries() ?? []).map(([babSlug, subBabsSet]) => {
                  const babLabel = allBabs.find(b => normalizeCategorySlug(b.value) === babSlug)?.label || babSlug;
                  const babKey = `${mapelSlug}:${babSlug}`;
                  const isBabExpanded = expandedBabs.includes(babKey);
                  const babState = visibilitySettings.hidden_babs.includes(babSlug) ? 'hidden' : visibilitySettings.admin_only_babs.includes(babSlug) ? 'admin_only' : 'visible';

                  return (
                    <div key={babSlug} className="pl-7">
                      <div
                        className={`flex cursor-pointer items-center justify-between px-3 py-2.5 transition-spring-fast ${theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.015]'}`}
                        onClick={() => onToggleExpanded(babKey)}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <svg className={`h-3.5 w-3.5 shrink-0 transition-transform ${isBabExpanded ? 'rotate-90' : ''} ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <h4 className={`truncate text-[13px] font-medium tracking-tight ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>{babLabel}</h4>
                        </div>
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <div className={`inline-flex h-7 rounded-full p-0.5 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => onVisibilityChange('babs', babSlug, 'hidden')}
                              className={`flex h-6 w-8 items-center justify-center rounded-full transition-spring-fast ${babState === 'hidden' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary hover:text-dark-text-secondary' : 'text-gray-500 hover:text-gray-700')}`}
                              title="Hidden"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => onVisibilityChange('babs', babSlug, 'admin_only')}
                              className={`flex h-6 w-8 items-center justify-center rounded-full transition-spring-fast ${babState === 'admin_only' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary hover:text-dark-text-secondary' : 'text-gray-500 hover:text-gray-700')}`}
                              title="Admin only"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => onVisibilityChange('babs', babSlug, 'visible')}
                              className={`flex h-6 w-8 items-center justify-center rounded-full transition-spring-fast ${babState === 'visible' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary hover:text-dark-text-secondary' : 'text-gray-500 hover:text-gray-700')}`}
                              title="Visible"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            </button>
                          </div>
                          {canDeleteTopic && (
                            <button
                              type="button"
                              onClick={() => onDeleteTopic('babs', babSlug)}
                              disabled={deletingTopic}
                              className={`flex h-7 w-7 items-center justify-center rounded-full transition-spring-fast disabled:opacity-50 ${theme === 'dark' ? 'text-dark-text-tertiary hover:bg-white/[0.05] hover:text-accent-red' : 'text-gray-400 hover:bg-black/[0.04] hover:text-red-600'}`}
                              title="Hapus Bab"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {isBabExpanded && (
                        <div className={`border-t pl-7 ${theme === 'dark' ? 'border-white/[0.04]' : 'border-black/[0.04]'}`}>
                          {subBabsSet.size === 0 ? (
                            <div className={`px-3 py-2.5 text-xs ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>No sub-babs.</div>
                          ) : (
                            Array.from(subBabsSet).sort().map(subSlug => {
                              const subLabel = allSubBabsAdmin.find(s => normalizeCategorySlug(s.value) === subSlug)?.label || subSlug;
                              const subState = visibilitySettings.hidden_sub_babs.includes(subSlug) ? 'hidden' : visibilitySettings.admin_only_sub_babs.includes(subSlug) ? 'admin_only' : 'visible';
                              return (
                                <div key={subSlug} className={`flex items-center justify-between px-3 py-2 transition-spring-fast ${theme === 'dark' ? 'hover:bg-white/[0.02]' : 'hover:bg-black/[0.015]'}`}>
                                  <p className={`truncate text-[12px] font-medium capitalize ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>{subLabel}</p>
                                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                    <div className={`inline-flex h-7 rounded-full p-0.5 ${theme === 'dark' ? 'bg-white/5' : 'bg-black/5'}`} onClick={e => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => onVisibilityChange('sub_babs', subSlug, 'hidden')}
                                        className={`flex h-6 w-7 items-center justify-center rounded-full transition-spring-fast ${subState === 'hidden' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary hover:text-dark-text-secondary' : 'text-gray-500 hover:text-gray-700')}`}
                                        title="Hidden"
                                      >
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onVisibilityChange('sub_babs', subSlug, 'admin_only')}
                                        className={`flex h-6 w-7 items-center justify-center rounded-full transition-spring-fast ${subState === 'admin_only' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary hover:text-dark-text-secondary' : 'text-gray-500 hover:text-gray-700')}`}
                                        title="Admin only"
                                      >
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onVisibilityChange('sub_babs', subSlug, 'visible')}
                                        className={`flex h-6 w-7 items-center justify-center rounded-full transition-spring-fast ${subState === 'visible' ? (theme === 'dark' ? 'bg-white/10 text-dark-text-primary' : 'bg-white text-gray-900 shadow-ios-sm') : (theme === 'dark' ? 'text-dark-text-tertiary hover:text-dark-text-secondary' : 'text-gray-500 hover:text-gray-700')}`}
                                        title="Visible"
                                      >
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                      </button>
                                    </div>
                                    {canDeleteTopic && (
                                      <button
                                        type="button"
                                        onClick={() => onDeleteTopic('sub_babs', subSlug)}
                                        disabled={deletingTopic}
                                        className={`flex h-6 w-6 items-center justify-center rounded-full transition-spring-fast disabled:opacity-50 ${theme === 'dark' ? 'text-dark-text-tertiary hover:bg-white/[0.05] hover:text-accent-red' : 'text-gray-400 hover:bg-black/[0.04] hover:text-red-600'}`}
                                        title="Hapus Sub-bab"
                                      >
                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
