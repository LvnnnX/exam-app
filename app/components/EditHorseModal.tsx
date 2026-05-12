"use client";

import React, { useState, useEffect } from 'react';
import { HORSE_SKINS, getHorseSkin } from '@/lib/horse-skins';
import HorseAvatar from './HorseAvatar';

type EditHorseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (skinId: string) => void;
  currentSkinId: string | null;
};

export default function EditHorseModal({ isOpen, onClose, onSave, currentSkinId }: EditHorseModalProps) {
  // State for the custom colors
  const [jersey, setJersey] = useState('#ef4444');
  const [pants, setPants] = useState('#7f1d1d');
  const [saddle, setSaddle] = useState('#f97316');

  // Load initial colors when modal opens
  useEffect(() => {
    if (isOpen) {
      const skin = getHorseSkin(currentSkinId);
      setJersey(skin.horse.jersey);
      setPants(skin.horse.pants);
      setSaddle(skin.horse.saddle);
    }
  }, [isOpen, currentSkinId]);

  if (!isOpen) return null;

  const handlePresetClick = (skinId: string) => {
    const skin = getHorseSkin(skinId);
    setJersey(skin.horse.jersey);
    setPants(skin.horse.pants);
    setSaddle(skin.horse.saddle);
  };

  const handleSave = () => {
    // Check if the current colors perfectly match any preset
    const matchedPreset = HORSE_SKINS.find(
      s => s.horse.jersey.toLowerCase() === jersey.toLowerCase() &&
        s.horse.pants.toLowerCase() === pants.toLowerCase() &&
        s.horse.saddle.toLowerCase() === saddle.toLowerCase()
    );

    if (matchedPreset) {
      onSave(matchedPreset.id);
    } else {
      // Return custom format
      onSave(`custom:${jersey}:${pants}:${saddle}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5">
          <div>
            <h3 className="font-display text-lg uppercase text-slate-800">Edit Horse</h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Customize your avatar</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {/* Preview Area */}
          <div className="mb-6 flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-100 shadow-inner overflow-hidden">
            <div className="flex h-32 w-32 items-center justify-center">
              <HorseAvatar
                colors={{ jersey, pants, saddle }}
                size="lg"
                animate={true}
                className="scale-[2.5]"
              />
            </div>

          </div>

          {/* Presets */}
          <div className="mb-6">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Presets</p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {HORSE_SKINS.map(skin => (
                <button
                  key={skin.id}
                  onClick={() => handlePresetClick(skin.id)}
                  className="group flex-shrink-0 rounded-xl border border-slate-200 bg-white p-2 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm transition-all"
                  title={skin.name}
                >
                  <HorseAvatar colors={skin.horse} size="sm" className="group-hover:scale-110 transition-transform" />
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div>
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Custom Colors</p>
            <div className="space-y-3">
              <label className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <span className="text-sm font-bold text-slate-700">Baju Joki (Jersey)</span>
                <input
                  type="color"
                  value={jersey}
                  onChange={(e) => setJersey(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded bg-transparent p-0 border-0"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <span className="text-sm font-bold text-slate-700">Celana Joki (Pants)</span>
                <input
                  type="color"
                  value={pants}
                  onChange={(e) => setPants(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded bg-transparent p-0 border-0"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <span className="text-sm font-bold text-slate-700">Sadel Kuda (Saddle)</span>
                <input
                  type="color"
                  value={saddle}
                  onChange={(e) => setSaddle(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded bg-transparent p-0 border-0"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/50 p-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-black text-white hover:bg-slate-800 shadow-md transition-colors"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
