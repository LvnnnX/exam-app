import type { HorseColors } from '@/app/components/HorseAvatar';

export const HORSE_SKIN_IDS = [
  'ember', 'storm', 'dune', 'forest', 'aurora', 'midnight', 'rose', 'glacier',
] as const;

export type HorseSkinId = (typeof HORSE_SKIN_IDS)[number];

export type HorseSkin = {
  id: HorseSkinId;
  name: string;
  avatarClass: string;
  accentClass: string;
  ringClass: string;
  cardClass: string;
  trackFillClass: string;
  trackGlowClass: string;
  horse: HorseColors;
};

export const HORSE_SKINS: HorseSkin[] = [
  {
    id: 'ember', name: 'Ember',
    avatarClass: 'bg-gradient-to-br from-orange-400 via-rose-500 to-red-600 text-white',
    accentClass: 'bg-yellow-100', ringClass: 'ring-orange-200/80',
    cardClass: 'border-orange-200 bg-orange-50/80 text-orange-800',
    trackFillClass: 'from-orange-400 via-red-500 to-rose-600',
    trackGlowClass: 'from-orange-200/45 via-rose-100/25 to-transparent',
    horse: { jersey: '#ef4444', pants: '#7f1d1d', saddle: '#f97316' },
  },
  {
    id: 'storm', name: 'Storm',
    avatarClass: 'bg-gradient-to-br from-slate-700 via-slate-900 to-indigo-950 text-white',
    accentClass: 'bg-sky-300', ringClass: 'ring-slate-200/80',
    cardClass: 'border-slate-200 bg-slate-50/85 text-slate-700',
    trackFillClass: 'from-slate-500 via-slate-700 to-indigo-900',
    trackGlowClass: 'from-slate-200/45 via-slate-100/25 to-transparent',
    horse: { jersey: '#6366f1', pants: '#1e1b4b', saddle: '#818cf8' },
  },
  {
    id: 'dune', name: 'Dune',
    avatarClass: 'bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-600 text-white',
    accentClass: 'bg-emerald-200', ringClass: 'ring-yellow-200/80',
    cardClass: 'border-yellow-200 bg-yellow-50/85 text-yellow-800',
    trackFillClass: 'from-yellow-400 via-amber-500 to-orange-600',
    trackGlowClass: 'from-yellow-100/55 via-amber-100/30 to-transparent',
    horse: { jersey: '#eab308', pants: '#713f12', saddle: '#f59e0b' },
  },
  {
    id: 'forest', name: 'Forest',
    avatarClass: 'bg-gradient-to-br from-emerald-500 via-green-600 to-lime-700 text-white',
    accentClass: 'bg-lime-200', ringClass: 'ring-emerald-200/80',
    cardClass: 'border-emerald-200 bg-emerald-50/85 text-emerald-800',
    trackFillClass: 'from-emerald-400 via-green-500 to-lime-600',
    trackGlowClass: 'from-emerald-200/50 via-lime-100/25 to-transparent',
    horse: { jersey: '#22c55e', pants: '#14532d', saddle: '#4ade80' },
  },
  {
    id: 'aurora', name: 'Aurora',
    avatarClass: 'bg-gradient-to-br from-cyan-400 via-sky-500 to-fuchsia-500 text-white',
    accentClass: 'bg-white/90', ringClass: 'ring-cyan-200/80',
    cardClass: 'border-cyan-200 bg-cyan-50/85 text-cyan-800',
    trackFillClass: 'from-cyan-400 via-sky-500 to-fuchsia-500',
    trackGlowClass: 'from-cyan-200/50 via-sky-100/25 to-transparent',
    horse: { jersey: '#06b6d4', pants: '#164e63', saddle: '#a78bfa' },
  },
  {
    id: 'midnight', name: 'Midnight',
    avatarClass: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white',
    accentClass: 'bg-violet-200', ringClass: 'ring-slate-300/70',
    cardClass: 'border-slate-300 bg-slate-50/90 text-slate-700',
    trackFillClass: 'from-slate-700 via-slate-800 to-slate-950',
    trackGlowClass: 'from-slate-200/40 via-violet-100/20 to-transparent',
    horse: { jersey: '#7c3aed', pants: '#1e1b4b', saddle: '#a78bfa' },
  },
  {
    id: 'rose', name: 'Rose',
    avatarClass: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-pink-600 text-white',
    accentClass: 'bg-white/90', ringClass: 'ring-fuchsia-200/80',
    cardClass: 'border-fuchsia-200 bg-fuchsia-50/85 text-fuchsia-800',
    trackFillClass: 'from-fuchsia-400 via-rose-500 to-pink-600',
    trackGlowClass: 'from-fuchsia-200/45 via-rose-100/25 to-transparent',
    horse: { jersey: '#ec4899', pants: '#831843', saddle: '#f472b6' },
  },
  {
    id: 'glacier', name: 'Glacier',
    avatarClass: 'bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-600 text-white',
    accentClass: 'bg-white/90', ringClass: 'ring-sky-200/80',
    cardClass: 'border-sky-200 bg-sky-50/85 text-sky-800',
    trackFillClass: 'from-sky-400 via-cyan-500 to-blue-600',
    trackGlowClass: 'from-sky-200/45 via-cyan-100/25 to-transparent',
    horse: { jersey: '#0ea5e9', pants: '#0c4a6e', saddle: '#38bdf8' },
  },
];

const HORSE_SKIN_MAP = new Map<HorseSkinId, HorseSkin>(HORSE_SKINS.map((s) => [s.id, s]));

function hashString(v: string): number {
  let h = 0;
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) >>> 0;
  return h;
}

export function isHorseSkinId(v: string | null | undefined): v is HorseSkinId {
  if (v?.startsWith('custom:')) return true;
  return Boolean(v && HORSE_SKIN_MAP.has(v as HorseSkinId));
}

export function getHorseSkinId(v: string | null | undefined, seed?: string): HorseSkinId {
  if (isHorseSkinId(v)) return v as HorseSkinId;
  if (seed) return HORSE_SKIN_IDS[hashString(seed) % HORSE_SKIN_IDS.length];
  return HORSE_SKIN_IDS[0];
}

export function getHorseSkin(v: string | null | undefined, seed?: string): HorseSkin {
  if (v?.startsWith('custom:')) {
    const parts = v.split(':');
    if (parts.length === 4) {
      return {
        id: v as HorseSkinId,
        name: 'Custom',
        avatarClass: 'bg-slate-100 text-slate-800',
        accentClass: 'bg-slate-300',
        ringClass: 'ring-slate-200/80',
        cardClass: 'border-slate-200 bg-white text-slate-800',
        trackFillClass: 'from-slate-400 via-slate-500 to-slate-600',
        trackGlowClass: 'from-slate-200/45 via-slate-100/25 to-transparent',
        horse: { jersey: parts[1]!, pants: parts[2]!, saddle: parts[3]! }
      };
    }
  }
  return HORSE_SKIN_MAP.get(getHorseSkinId(v, seed)) || HORSE_SKINS[0];
}
