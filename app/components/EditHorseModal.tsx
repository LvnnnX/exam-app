"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { HORSE_SKINS, getHorseSkin, MOUNT_OPTIONS, isMountId, type MountId } from '@/lib/horse-skins';
import HorseAvatar from './HorseAvatar';
import NeumorphButton from '@/app/components/ui/neumorph-button';

type EditHorseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (skinId: string) => void;
  currentSkinId: string | null;
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (HEX_RE.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

export default function EditHorseModal({ isOpen, onClose, onSave, currentSkinId }: EditHorseModalProps) {
  const [jersey, setJersey] = useState('#ef4444');
  const [pants, setPants] = useState('#7f1d1d');
  const [saddle, setSaddle] = useState('#f97316');
  const [mount, setMount] = useState<MountId>('horse');

  useEffect(() => {
    if (!isOpen) return;
    const skin = getHorseSkin(currentSkinId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJersey(skin.horse.jersey);
    setPants(skin.horse.pants);
    setSaddle(skin.horse.saddle);
    setMount(skin.mount);
  }, [isOpen, currentSkinId]);

  const matchedPresetId = useMemo(() => {
    // Presets only count when riding a horse, since they don't define a mount.
    if (mount !== 'horse') return null;
    const j = jersey.toLowerCase();
    const p = pants.toLowerCase();
    const s = saddle.toLowerCase();
    return HORSE_SKINS.find(
      (skin) =>
        skin.horse.jersey.toLowerCase() === j &&
        skin.horse.pants.toLowerCase() === p &&
        skin.horse.saddle.toLowerCase() === s,
    )?.id ?? null;
  }, [jersey, pants, saddle, mount]);

  if (!isOpen) return null;

  const handlePresetClick = (skinId: string) => {
    const skin = getHorseSkin(skinId);
    setJersey(skin.horse.jersey);
    setPants(skin.horse.pants);
    setSaddle(skin.horse.saddle);
    setMount(skin.mount);
  };

  const handleSave = () => {
    if (matchedPresetId && mount === 'horse') {
      onSave(matchedPresetId);
    } else {
      // Always include mount as 5th part. Legacy 4-part 'custom:' values
      // still parse correctly because the helper treats them as horse mount.
      onSave(`custom:${jersey}:${pants}:${saddle}:${mount}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111111]/95 backdrop-blur-2xl p-3 animate-in fade-in duration-200">
      <motion.div
        layoutId="edit-horse-expandable"
        transition={{ type: 'spring', stiffness: 180, damping: 24, mass: 0.9 }}
        className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-[32px] bg-[#f7f7f2] shadow-[0_30px_80px_rgba(0,0,0,0.42)] flex flex-col"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-5 border-b border-black/[0.06]">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-nike-grey-500/70">Avatar</p>
            <h3 className="text-[22px] font-semibold tracking-[-0.04em] text-nike-black">Ubah tampilan</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-nike-grey-500 hover:bg-black/10 hover:text-nike-black transition-spring-fast active:scale-90 shrink-0"
            aria-label="Close"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            {/* Preview */}
            <div className="rounded-[28px] bg-white px-6 py-8 shadow-[0_18px_45px_rgba(0,0,0,0.10)] lg:sticky lg:top-0 lg:self-start">
              <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-nike-grey-500/70">Preview</p>
              <div className="flex min-h-[300px] items-center justify-center rounded-[24px] bg-[#f7f7f2]">
                <div className="flex h-28 w-28 items-center justify-center">
                  <HorseAvatar
                    colors={{ jersey, pants, saddle }}
                    mount={mount}
                    size="lg"
                    animate={true}
                    className="scale-[2.6]"
                  />
                </div>
              </div>
              <div className="mt-5 rounded-[20px] bg-[#f7f7f2] px-4 py-3">
                <p className="text-[11px] font-medium text-nike-grey-500">Pilihan aktif</p>
                <p className="mt-1 text-[14px] font-semibold tracking-tight text-nike-black">
                  {matchedPresetId ? HORSE_SKINS.find((s) => s.id === matchedPresetId)?.name ?? matchedPresetId : 'Custom'} · {MOUNT_OPTIONS.find((m) => m.id === mount)?.name ?? 'Kuda'}
                </p>
              </div>
            </div>

            <div className="flex min-h-[460px] flex-col">
              <div className="space-y-6">
                {/* Presets */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase">Preset</p>
                    {matchedPresetId ? (
                      <span className="text-[10px] font-medium text-nike-grey-500 tracking-tight">
                        {HORSE_SKINS.find((s) => s.id === matchedPresetId)?.name ?? matchedPresetId}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-nike-grey-500 tracking-tight">Custom</span>
                    )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {HORSE_SKINS.map((skin) => {
                      const isActive = matchedPresetId === skin.id;
                      return (
                        <button
                          key={skin.id}
                          type="button"
                          onClick={() => handlePresetClick(skin.id)}
                          title={skin.name}
                          className={`group shrink-0 flex h-14 w-14 items-center justify-center rounded-2xl transition-spring-fast hover:scale-[1.03] active:scale-95 ${
                            isActive
                              ? 'bg-white ring-2 ring-nike-black ring-offset-2 ring-offset-[#f7f7f2] shadow-[0_10px_24px_rgba(0,0,0,0.10)]'
                              : 'bg-white/70 hover:bg-white shadow-[0_8px_20px_rgba(0,0,0,0.06)]'
                          }`}
                        >
                          <HorseAvatar colors={skin.horse} size="sm" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mount picker */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase">Tunggangan</p>
                    <span className="text-[10px] font-medium text-nike-grey-500 tracking-tight">
                      {MOUNT_OPTIONS.find((m) => m.id === mount)?.name ?? 'Kuda'}
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {MOUNT_OPTIONS.map((opt) => {
                      const isActive = mount === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            if (isMountId(opt.id)) setMount(opt.id);
                          }}
                          title={opt.name}
                          className={`shrink-0 flex h-14 w-14 items-center justify-center rounded-2xl transition-spring-fast hover:scale-[1.03] active:scale-95 ${
                            isActive
                              ? 'bg-white ring-2 ring-nike-black ring-offset-2 ring-offset-[#f7f7f2] shadow-[0_10px_24px_rgba(0,0,0,0.10)]'
                              : 'bg-white/70 hover:bg-white shadow-[0_8px_20px_rgba(0,0,0,0.06)]'
                          }`}
                        >
                          {opt.id === 'horse' ? (
                            <HorseAvatar colors={{ jersey, pants, saddle }} size="sm" />
                          ) : opt.src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={opt.src} alt={opt.name} className="h-9 w-9 object-contain" draggable={false} />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Colors */}
                <div>
                  <p className="text-[10px] font-medium text-nike-grey-500/80 tracking-tight uppercase mb-2.5">Edit warna kustom</p>
                  <div className="rounded-[22px] bg-white divide-y divide-black/[0.05] shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
                    <ColorRow label="Baju joki" value={jersey} onChange={setJersey} />
                    <ColorRow label="Celana joki" value={pants} onChange={setPants} />
                    <ColorRow label="Sadel kuda" value={saddle} onChange={setSaddle} />
                  </div>
                </div>
              </div>

              <div className="mt-auto flex justify-end gap-3 pt-6">
                <NeumorphButton
                  type="button"
                  intent="secondary"
                  size="medium"
                  onClick={onClose}
                  className="h-11 min-w-[120px]"
                >
                  Batal
                </NeumorphButton>
                <NeumorphButton
                  type="button"
                  intent="primary"
                  size="medium"
                  onClick={handleSave}
                  className="h-11 min-w-[120px]"
                >
                  Simpan
                </NeumorphButton>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value);
  }, [value]);

  const handleHexBlur = () => {
    const next = normalizeHex(draft);
    if (next) {
      onChange(next);
    } else {
      setDraft(value);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <p className="text-[13px] font-medium text-nike-black tracking-tight min-w-0 flex-1 truncate">{label}</p>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleHexBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setDraft(value);
              e.currentTarget.blur();
            }
          }}
          maxLength={7}
          spellCheck={false}
          className="w-[78px] h-8 rounded-lg bg-white px-2.5 text-[12px] font-mono tabular-nums uppercase text-nike-grey-500 focus:outline-none focus:text-nike-black tracking-tight"
        />
        <label className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden cursor-pointer transition-spring-fast active:scale-95 ring-1 ring-black/[0.06]" style={{ backgroundColor: value }}>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label={label}
          />
        </label>
      </div>
    </div>
  );
}
