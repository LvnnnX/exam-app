"use client";

import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { type MountId, getMountSrc } from '@/lib/horse-skins';

export type HorseColors = {
  jersey: string;
  pants: string;
  saddle: string;
};

type HorseAvatarProps = {
  colors: HorseColors;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  animate?: boolean;
  mount?: MountId;
};

const SIZES = { xs: 20, sm: 28, md: 40, lg: 56 } as const;

function darken(hex: string, n: number): string {
  const v = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (v >> 16) - n);
  const g = Math.max(0, ((v >> 8) & 0xff) - n);
  const b = Math.max(0, (v & 0xff) - n);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const svgCache = new Map<string, string>();
function fetchSvgText(src: string): Promise<string> {
  const cached = svgCache.get(src);
  if (cached !== undefined) return Promise.resolve(cached);
  return fetch(src).then((r) => r.text()).then((t) => {
    // Mount SVGs are bundled assets, but they go through innerHTML so we
    // sanitize defensively to block script/foreignObject/event handlers.
    const safe = String(
      DOMPurify.sanitize(t, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ['script', 'foreignObject', 'iframe'],
        FORBID_ATTR: ['onload', 'onerror', 'onclick'],
      })
    );
    svgCache.set(src, safe);
    return safe;
  });
}

// horse.svg uses different placeholder hexes than the animal SVGs:
//   horse.svg     : jersey=#37b5e1, jersey-dark=#0468a6, pants=#444, saddle=#ff8e00
//   animal SVGs   : jersey=#ff8e00, pants=#c8c8c8, saddle=#37b5e1, saddle-dark=#0468a6
// So #0468a6 / #37b5e1 / #ff8e00 swap meaning between horse and animal.
// Recolor with a per-mount mapping to avoid cross-talk.

function recolorHorseSvg(svg: string, c: HorseColors): string {
  return svg
    .replace(/#0468a6/gi, darken(c.jersey, 50))   // jersey dark accent
    .replace(/#37b5e1/gi, c.jersey)
    .replace(/#ff8e00/gi, c.saddle)
    .replace(/#444444/gi, c.pants)
    .replace(/"#444"/g, `"${c.pants}"`)
    .replace(/'#444'/g, `'${c.pants}'`)
    .replace(/:#444\b/gi, `:${c.pants}`);
}

function recolorAnimalSvg(svg: string, c: HorseColors): string {
  return svg
    .replace(/#0468a6/gi, darken(c.saddle, 50))   // saddle dark accent
    .replace(/#37b5e1/gi, c.saddle)
    .replace(/#ff8e00/gi, c.jersey)
    .replace(/#c8c8c8/gi, c.pants);
}

export default function HorseAvatar({
  colors,
  size = 'md',
  className = '',
  animate = false,
  mount = 'horse',
}: HorseAvatarProps) {
  const px = SIZES[size];
  const [svg, setSvg] = useState<string | null>(null);
  const src = getMountSrc(mount);

  useEffect(() => {
    if (!src) {
      setSvg(null);
      return;
    }
    let cancelled = false;
    fetchSvgText(src).then((raw) => {
      if (cancelled) return;
      const colored = mount === 'horse'
        ? recolorHorseSvg(raw, colors)
        : recolorAnimalSvg(raw, colors);
      setSvg(colored);
    }).catch(() => {
      if (!cancelled) setSvg(null);
    });
    return () => { cancelled = true; };
  }, [src, mount, colors.jersey, colors.pants, colors.saddle]);

  return (
    <div
      className={`${animate ? 'horse-avatar-bounce' : ''} ${className} [&>svg]:w-full [&>svg]:h-full`}
      style={{ width: px, height: px }}
      dangerouslySetInnerHTML={{ __html: svg ?? '' }}
    />
  );
}
