"use client";

import React from 'react';
import { type BabInfo, type SubBabInfo, type VisibilitySettings } from '@/lib/questions';
import { normalizeCategorySlug } from '@/lib/categories';

type VisibilityState = 'visible' | 'admin_only' | 'hidden';
type TopicType = 'mapels' | 'babs' | 'sub_babs';

type SettingsMapelTreeProps = {
  allMapels: BabInfo[];
  allBabs: BabInfo[];
  allSubBabsAdmin: SubBabInfo[];
  expandedBabs: string[];
  visibilitySettings: VisibilitySettings;
  deletingTopic: boolean;
  mapelBabSubBabMap: Map<string, Map<string, Set<string>>>;
  onToggleExpanded: (slug: string) => void;
  onVisibilityChange: (type: TopicType, slug: string, state: VisibilityState) => void;
  canDeleteTopic: boolean;
  onDeleteTopic: (type: TopicType, slug: string) => void;
  theme?: 'light' | 'dark';
};

const VISIBILITY_OPTIONS: Array<{ state: VisibilityState; label: string; icon: React.ReactNode }> = [
  {
    state: 'hidden',
    label: 'Hidden',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />,
  },
  {
    state: 'admin_only',
    label: 'Admin only',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  },
  {
    state: 'visible',
    label: 'Visible',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />,
  },
];

function VisibilityControl({ name, current, onChange }: { name: string; current: VisibilityState; onChange: (state: VisibilityState) => void }) {
  return (
    <div className="well inline-flex rounded-xl p-1" role="group" aria-label={`Visibility ${name}`}>
      {VISIBILITY_OPTIONS.map((option) => {
        const active = current === option.state;
        return (
          <button
            key={option.state}
            type="button"
            onClick={() => onChange(option.state)}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition-calm md:h-8 md:w-9 ${active ? 'clay' : 'text-fg-subtle hover:text-fg'}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">{option.icon}</svg>
          </button>
        );
      })}
    </div>
  );
}

function DeleteTopicButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-fg-subtle transition-calm hover:bg-danger/10 hover:text-danger disabled:opacity-50 md:h-9 md:w-9"
      title={label}
      aria-label={label}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
    </button>
  );
}

function Chevron({ open, small = false }: { open: boolean; small?: boolean }) {
  return (
    <svg className={`${small ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 text-fg-subtle transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

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
}: SettingsMapelTreeProps) {
  return (
    <div className="space-y-2.5 p-4 sm:p-5">
      {allMapels.length === 0 && (
        <div className="well rounded-2xl px-4 py-8 text-center">
          <p className="text-[14px] font-semibold text-fg">No mapel found.</p>
          <p className="mt-1 text-[13px] text-fg-muted">Add questions first. Topics appear here once a question uses them.</p>
        </div>
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
          <div key={mapelSlug} className="well overflow-hidden rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2 sm:flex-nowrap">
              <button
                type="button"
                aria-expanded={isMapelExpanded}
                onClick={() => onToggleExpanded(mapelSlug)}
                className="well-hover flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-calm"
              >
                <Chevron open={isMapelExpanded} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold tracking-tight text-fg">{mapel.label}</span>
                  <span className="block truncate text-[12px] text-fg-muted">{mapelSlug}</span>
                </span>
              </button>
              <div className="flex items-center gap-1.5">
                <VisibilityControl name={mapel.label} current={mapelState} onChange={(state) => onVisibilityChange('mapels', mapelSlug, state)} />
                {canDeleteTopic && (
                  <DeleteTopicButton label="Hapus Mapel" disabled={deletingTopic} onClick={() => onDeleteTopic('mapels', mapelSlug)} />
                )}
              </div>
            </div>

            {isMapelExpanded && (
              <div className="border-t border-line py-1">
                {Array.from(mapelBabSubBabMap.get(mapelSlug)?.entries() ?? []).map(([babSlug, subBabsSet]) => {
                  const babLabel = allBabs.find(b => normalizeCategorySlug(b.value) === babSlug)?.label || babSlug;
                  const babKey = `${mapelSlug}:${babSlug}`;
                  const isBabExpanded = expandedBabs.includes(babKey);
                  const babState = visibilitySettings.hidden_babs.includes(babSlug) ? 'hidden' : visibilitySettings.admin_only_babs.includes(babSlug) ? 'admin_only' : 'visible';

                  return (
                    <div key={babSlug} className="pl-5 sm:pl-7">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 sm:flex-nowrap">
                        <button
                          type="button"
                          aria-expanded={isBabExpanded}
                          onClick={() => onToggleExpanded(babKey)}
                          className="well-hover flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 text-left transition-calm"
                        >
                          <Chevron open={isBabExpanded} small />
                          <span className="truncate text-[14px] font-medium text-fg">{babLabel}</span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <VisibilityControl name={babLabel} current={babState} onChange={(state) => onVisibilityChange('babs', babSlug, state)} />
                          {canDeleteTopic && (
                            <DeleteTopicButton label="Hapus Bab" disabled={deletingTopic} onClick={() => onDeleteTopic('babs', babSlug)} />
                          )}
                        </div>
                      </div>

                      {isBabExpanded && (
                        <div className="ml-4 border-l border-line pl-3 sm:ml-5">
                          {subBabsSet.size === 0 ? (
                            <div className="px-3 py-2.5 text-[13px] text-fg-muted">No sub-babs.</div>
                          ) : (
                            Array.from(subBabsSet).sort().map(subSlug => {
                              const subLabel = allSubBabsAdmin.find(s => normalizeCategorySlug(s.value) === subSlug)?.label || subSlug;
                              const subState = visibilitySettings.hidden_sub_babs.includes(subSlug) ? 'hidden' : visibilitySettings.admin_only_sub_babs.includes(subSlug) ? 'admin_only' : 'visible';
                              return (
                                <div key={subSlug} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-1.5 transition-calm hover:bg-[var(--well-bg)] sm:flex-nowrap">
                                  <p className="min-w-0 truncate text-[13px] font-medium capitalize text-fg-muted">{subLabel}</p>
                                  <div className="flex items-center gap-1.5">
                                    <VisibilityControl name={subLabel} current={subState} onChange={(state) => onVisibilityChange('sub_babs', subSlug, state)} />
                                    {canDeleteTopic && (
                                      <DeleteTopicButton label="Hapus Sub-bab" disabled={deletingTopic} onClick={() => onDeleteTopic('sub_babs', subSlug)} />
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
