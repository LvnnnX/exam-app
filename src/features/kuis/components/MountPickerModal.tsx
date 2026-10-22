'use client';

import React, { useState } from 'react';
import {
  MOUNT_OPTIONS,
  PRESET_COLOR_IDS,
  PRESET_COLORS,
  type MountId,
  type PresetColorId,
  buildSkinString,
  parseSkin,
} from '../mount-skins';
import MountAvatar from './MountAvatar';
import { Check, X } from 'lucide-react';

interface MountPickerModalProps {
  currentSkin: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (newSkin: string) => void;
}

export default function MountPickerModal({
  currentSkin,
  isOpen,
  onClose,
  onSelect,
}: MountPickerModalProps) {
  const initial = parseSkin(currentSkin);
  const [selectedMount, setSelectedMount] = useState<MountId>(initial.mount);
  const [selectedPreset, setSelectedPreset] = useState<PresetColorId>('ember');

  if (!isOpen) return null;

  const handleSave = () => {
    const skinStr = buildSkinString(selectedPreset, selectedMount);
    onSelect(skinStr);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl glass-card border border-line p-6 shadow-xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div>
            <h3 className="font-bold text-fg text-lg">Pilih Hewan Tunggangan</h3>
            <p className="text-xs text-fg-subtle">Pilih hewan dan warna favoritmu untuk balapan</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl well hover:bg-brick-50 text-fg-subtle hover:text-danger transition-colors border border-line"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Preview */}
        <div className="flex items-center justify-center gap-4 p-4 rounded-2xl well border border-line">
          <MountAvatar
            mount={selectedMount}
            colors={PRESET_COLORS[selectedPreset].colors}
            size="xl"
          />
          <div>
            <div className="text-base font-bold text-fg">
              {MOUNT_OPTIONS.find((m) => m.id === selectedMount)?.name}
            </div>
            <div className="text-xs font-semibold text-primary">
              Warna: {PRESET_COLORS[selectedPreset].name}
            </div>
          </div>
        </div>

        {/* Mount selection (12 animals) */}
        <div>
          <label className="text-xs font-bold text-fg-subtle uppercase tracking-wider block mb-2.5">
            Pilihan Hewan (12 Jenis)
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
            {MOUNT_OPTIONS.map((mount) => {
              const isSelected = selectedMount === mount.id;
              return (
                <button
                  key={mount.id}
                  type="button"
                  onClick={() => setSelectedMount(mount.id)}
                  className={`p-2 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-xs ring-2 ring-primary/30'
                      : 'border-line glass hover:bg-well'
                  }`}
                >
                  <MountAvatar
                    mount={mount.id}
                    colors={PRESET_COLORS[selectedPreset].colors}
                    size="sm"
                  />
                  <span className="text-[11px] font-semibold text-fg truncate w-full">
                    {mount.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preset color selection */}
        <div>
          <label className="text-xs font-bold text-fg-subtle uppercase tracking-wider block mb-2.5">
            Pilihan Warna
          </label>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_COLOR_IDS.map((pid) => {
              const isSelected = selectedPreset === pid;
              const p = PRESET_COLORS[pid];
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => setSelectedPreset(pid)}
                  className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                      : 'border-line glass hover:bg-well'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: p.colors.jersey }}
                  />
                  <span className="text-xs font-semibold text-fg truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-line mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl text-xs font-semibold text-fg-subtle hover:bg-well transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold clay-primary hover:opacity-95 transition-opacity flex items-center gap-1.5 shadow-sm"
          >
            <Check size={16} />
            <span>Terapkan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
