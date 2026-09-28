"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { HORSE_SKINS, getHorseSkin, MOUNT_OPTIONS, isMountId, type MountId } from '@/lib/horse-skins';
import HorseAvatar from './HorseAvatar';

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
  const [jersey, setJersey] = useState(HORSE_SKINS[0].horse.jersey);
  const [pants, setPants] = useState(HORSE_SKINS[0].horse.pants);
  const [saddle, setSaddle] = useState(HORSE_SKINS[0].horse.saddle);
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const tileBase = 'flex h-14 w-full items-center justify-center rounded-2xl transition-calm';
  const tileActive = 'clay ring-2 ring-primary ring-offset-2 ring-offset-canvas';
  const tileIdle = 'well well-hover';

  return (
    <div className="glass-scrim fixed inset-0 z-[100] flex items-center justify-center p-3" onClick={onClose}>
      {/* Grows out of the "Ubah" button in the waiting room (shared layoutId). */}
      <motion.div
        layoutId="edit-horse-expandable"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-mount-title"
        className="glass-sheet flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h3 id="edit-mount-title" className="text-[18px] font-bold tracking-tight text-fg">Ubah avatar</h3>
            <p className="text-[13px] text-fg-muted">Pilih preset atau atur warnamu sendiri.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="well well-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-calm"
            aria-label="Tutup"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Preview: the mount standing on its clay pedestal */}
          <div className="clay relative flex items-center justify-center rounded-3xl px-5 pt-7 pb-8">
            <span className="absolute bottom-6 left-1/2 h-3 w-28 -translate-x-1/2 rounded-full bg-black/10 blur-[2px]" aria-hidden="true" />
            <div className="relative flex h-24 w-24 items-center justify-center">
              <HorseAvatar
                colors={{ jersey, pants, saddle }}
                mount={mount}
                size="lg"
                animate={true}
                className="scale-[2]"
              />
            </div>
          </div>

          {/* Presets */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-fg">Preset</p>
              <span className="text-[12px] font-medium text-fg-muted">
                {matchedPresetId
                  ? (HORSE_SKINS.find((s) => s.id === matchedPresetId)?.name ?? matchedPresetId)
                  : 'Custom'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {HORSE_SKINS.map((skin) => {
                const isActive = matchedPresetId === skin.id;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => handlePresetClick(skin.id)}
                    title={skin.name}
                    aria-label={`Preset ${skin.name}`}
                    aria-pressed={isActive}
                    className={`${tileBase} ${isActive ? tileActive : tileIdle}`}
                  >
                    <HorseAvatar colors={skin.horse} size="sm" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mount picker */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-fg">Tunggangan</p>
              <span className="text-[12px] font-medium text-fg-muted">
                {MOUNT_OPTIONS.find((m) => m.id === mount)?.name ?? 'Kuda'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
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
                    aria-label={opt.name}
                    aria-pressed={isActive}
                    className={`${tileBase} ${isActive ? tileActive : tileIdle}`}
                  >
                    {opt.id === 'horse' ? (
                      <HorseAvatar colors={{ jersey, pants, saddle }} size="sm" />
                    ) : opt.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opt.src} alt="" className="h-9 w-9 object-contain" draggable={false} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Colors */}
          <div>
            <p className="mb-2.5 text-[13px] font-semibold text-fg">Warna kustom</p>
            <div className="well divide-y divide-line rounded-2xl">
              <ColorRow label="Baju joki" value={jersey} onChange={setJersey} />
              <ColorRow label="Celana joki" value={pants} onChange={setPants} />
              <ColorRow label="Sadel kuda" value={saddle} onChange={setSaddle} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-2 border-t border-line px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="well well-hover h-11 flex-1 rounded-xl text-[14px] font-medium text-fg transition-calm"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="clay-primary h-11 flex-1 rounded-xl text-[14px] font-semibold"
          >
            Simpan
          </button>
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
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-fg">{label}</p>
      <div className="flex shrink-0 items-center gap-2">
        <input
          type="text"
          aria-label={`${label}, kode hex`}
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
          className="h-11 w-[84px] rounded-lg md:h-9 border border-line-strong bg-transparent px-2.5 text-[13px] font-semibold tabular-nums uppercase text-fg-muted transition-calm focus:text-fg"
        />
        <label className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-line-strong transition-calm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]" style={{ backgroundColor: value }}>
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
