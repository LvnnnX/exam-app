'use client';

import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { parseSkin, MOUNT_OPTIONS, type MountId, type MountColors } from '../mount-skins';

interface MountAvatarProps {
  skin?: string | null;
  mount?: MountId;
  colors?: MountColors;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBadge?: boolean;
  /** No glass box: for repeated race lanes, where blur on every row is too costly. */
  bare?: boolean;
}

const SIZES = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
  xl: 'w-22 h-22',
};

const svgCache = new Map<string, string>();

function darken(hex: string, n: number): string {
  const v = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (v >> 16) - n);
  const g = Math.max(0, ((v >> 8) & 0xff) - n);
  const b = Math.max(0, (v & 0xff) - n);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function recolorHorseSvg(svg: string, c: MountColors): string {
  return svg
    .replace(/#0468a6/gi, darken(c.jersey, 50))
    .replace(/#37b5e1/gi, c.jersey)
    .replace(/#ff8e00/gi, c.saddle)
    .replace(/#444444/gi, c.pants)
    .replace(/"#444"/g, `"${c.pants}"`)
    .replace(/'#444'/g, `'${c.pants}'`)
    .replace(/:#444\b/gi, `:${c.pants}`);
}

function recolorAnimalSvg(svg: string, c: MountColors): string {
  return svg
    .replace(/#0468a6/gi, darken(c.saddle, 50))
    .replace(/#37b5e1/gi, c.saddle)
    .replace(/#ff8e00/gi, c.jersey)
    .replace(/#c8c8c8/gi, c.pants);
}

export default function MountAvatar({
  skin,
  mount: propMount,
  colors: propColors,
  size = 'md',
  className = '',
  bare = false,
}: MountAvatarProps) {
  const [svgHtml, setSvgHtml] = useState<string | null>(null);

  const parsed = parseSkin(skin);
  const activeMount = propMount || parsed.mount;
  const activeColors = propColors || parsed.colors;
  const mountOpt = MOUNT_OPTIONS.find((m) => m.id === activeMount) || MOUNT_OPTIONS[0];

  useEffect(() => {
    let active = true;
    const fetchSvg = async () => {
      const src = mountOpt.src;
      let raw = svgCache.get(src);
      if (!raw) {
        try {
          const res = await fetch(src);
          raw = await res.text();
          svgCache.set(src, raw);
        } catch {
          return;
        }
      }

      if (!active || !raw) return;

      const recolored = activeMount === 'horse'
        ? recolorHorseSvg(raw, activeColors)
        : recolorAnimalSvg(raw, activeColors);

      const clean = DOMPurify.sanitize(recolored, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ['script', 'iframe', 'foreignObject'],
        FORBID_ATTR: ['onload', 'onerror', 'onclick'],
      });

      setSvgHtml(clean);
    };

    fetchSvg();
    return () => {
      active = false;
    };
  }, [activeMount, activeColors, mountOpt.src]);

  return (
    <div
      className={`relative inline-flex items-center justify-center overflow-hidden ${bare ? '' : 'rounded-2xl glass border border-line shadow-xs'} ${SIZES[size]} ${className}`}
      title={mountOpt.name}
    >
      {svgHtml ? (
        <div
          className="w-full h-full flex items-center justify-center p-1"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-well/50 text-[10px] font-bold text-fg-subtle">
          {mountOpt.name.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}
