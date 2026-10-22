import type { HorseColors } from '@/app/components/HorseAvatar';

export const HORSE_SKIN_IDS = [
  'ember', 'storm', 'dune', 'forest', 'aurora', 'midnight', 'rose', 'glacier',
] as const;

export type HorseSkinId = (typeof HORSE_SKIN_IDS)[number];

// Mount (tunggangan) options. The 'horse' mount keeps the original full
// horse+jockey rendering. Other mounts render the animal SVG with a small
// jockey emblem overlay so the jockey colors stay meaningful.
export const MOUNT_IDS = [
  'horse', 'angsa', 'citah', 'dino', 'kalkun', 'kebo', 'llama', 'macan', 'mamot', 'sapi', 'udang', 'ulat',
] as const;

export type MountId = (typeof MOUNT_IDS)[number];

export const MOUNT_OPTIONS: { id: MountId; name: string; src: string | null }[] = [
  { id: 'horse', name: 'Kuda', src: '/horse.svg' },
  { id: 'angsa', name: 'Angsa', src: '/angsa.svg' },
  { id: 'citah', name: 'Citah', src: '/citah.svg' },
  { id: 'dino', name: 'Dino', src: '/dino.svg' },
  { id: 'kalkun', name: 'Kalkun', src: '/kalkun.svg' },
  { id: 'kebo', name: 'Kebo', src: '/kebo.svg' },
  { id: 'llama', name: 'Llama', src: '/llama.svg' },
  { id: 'macan', name: 'Macan', src: '/macan.svg' },
  { id: 'mamot', name: 'Mamot', src: '/mamot.svg' },
  { id: 'sapi', name: 'Sapi', src: '/sapi.svg' },
  { id: 'udang', name: 'Udang', src: '/udang.svg' },
  { id: 'ulat', name: 'Ulat', src: '/ulat.svg' },
];

export function isMountId(v: string | null | undefined): v is MountId {
  return Boolean(v && (MOUNT_IDS as readonly string[]).includes(v));
}

export function getMountSrc(id: MountId | null | undefined): string | null {
  if (!id) return null;
  return MOUNT_OPTIONS.find((m) => m.id === id)?.src ?? null;
}

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
  mount: MountId;
};

// Presets draw every color from the four DESIGN.md families (Pine, Ink,
// Amber, Brick). The class fields are flat tints; the race lane itself uses
// the theme's primary tint, so skins differ by mount colors only.
const CALM_SKIN_CLASSES = {
  avatarClass: 'clay text-fg',
  accentClass: 'bg-ink-100',
  ringClass: 'ring-line-strong',
  cardClass: 'border-line bg-white/60 text-fg',
  trackFillClass: 'bg-primary/15',
  trackGlowClass: 'bg-transparent',
} as const;

export const HORSE_SKINS: HorseSkin[] = [
  {
    id: 'ember', name: 'Ember', ...CALM_SKIN_CLASSES,
    horse: { jersey: '#c4503c', pants: '#5c2821', saddle: '#df9a3f' },
    mount: 'horse',
  },
  {
    id: 'storm', name: 'Storm', ...CALM_SKIN_CLASSES,
    horse: { jersey: '#3f4c50', pants: '#182023', saddle: '#aebbbc' },
    mount: 'horse',
  },
  {
    id: 'dune', name: 'Dune', ...CALM_SKIN_CLASSES,
    horse: { jersey: '#df9a3f', pants: '#6b411c', saddle: '#f2d09a' },
    mount: 'horse',
  },
  {
    id: 'forest', name: 'Forest', ...CALM_SKIN_CLASSES,
    horse: { jersey: '#36806c', pants: '#183831', saddle: '#7fbca9' },
    mount: 'horse',
  },
  {
    id: 'aurora', name: 'Aurora', ...CALM_SKIN_CLASSES,
    horse: { jersey: '#7fbca9', pants: '#313c40', saddle: '#e9b567' },
    mount: 'horse',
  },
  {
    id: 'midnight', name: 'Midnight', ...CALM_SKIN_CLASSES,
    horse: { jersey: '#232d31', pants: '#0e1416', saddle: '#529d88' },
    mount: 'horse',
  },
  {
    id: 'rose', name: 'Rose', ...CALM_SKIN_CLASSES,
    horse: { jersey: '#e59384', pants: '#873327', saddle: '#e8eeee' },
    mount: 'horse',
  },
  {
    id: 'glacier', name: 'Glacier', ...CALM_SKIN_CLASSES,
    horse: { jersey: '#d3dcdc', pants: '#1d443a', saddle: '#aed7c9' },
    mount: 'horse',
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
    // Legacy: custom:<j>:<p>:<s>           (4 parts, mount defaults to 'horse')
    // New:    custom:<j>:<p>:<s>:<mount>   (5 parts)
    if (parts.length === 4 || parts.length === 5) {
      const candidateMount = parts.length === 5 ? parts[4]! : 'horse';
      const mount = isMountId(candidateMount) ? (candidateMount as MountId) : 'horse';
      return {
        id: v as HorseSkinId,
        name: 'Custom',
        ...CALM_SKIN_CLASSES,
        horse: { jersey: parts[1]!, pants: parts[2]!, saddle: parts[3]! },
        mount,
      };
    }
  }
  return HORSE_SKIN_MAP.get(getHorseSkinId(v, seed)) || HORSE_SKINS[0];
}
