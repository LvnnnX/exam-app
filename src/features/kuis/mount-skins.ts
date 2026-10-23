export const MOUNT_IDS = [
  'horse', 'angsa', 'citah', 'dino', 'kalkun', 'kebo', 'llama', 'macan', 'mamot', 'sapi', 'udang', 'ulat',
] as const;

export type MountId = (typeof MOUNT_IDS)[number];

export const MOUNT_OPTIONS: { id: MountId; name: string; src: string }[] = [
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

export const PRESET_COLOR_IDS = [
  'ember', 'storm', 'dune', 'forest', 'aurora', 'midnight', 'rose', 'glacier',
] as const;

export type PresetColorId = (typeof PRESET_COLOR_IDS)[number];

export interface MountColors {
  jersey: string;
  pants: string;
  saddle: string;
}

export const PRESET_COLORS: Record<PresetColorId, { name: string; colors: MountColors }> = {
  ember: { name: 'Ember', colors: { jersey: '#c4503c', pants: '#5c2821', saddle: '#df9a3f' } },
  storm: { name: 'Storm', colors: { jersey: '#3f4c50', pants: '#182023', saddle: '#aebbbc' } },
  dune: { name: 'Dune', colors: { jersey: '#df9a3f', pants: '#6b411c', saddle: '#f2d09a' } },
  forest: { name: 'Forest', colors: { jersey: '#36806c', pants: '#183831', saddle: '#7fbca9' } },
  aurora: { name: 'Aurora', colors: { jersey: '#7fbca9', pants: '#313c40', saddle: '#e9b567' } },
  midnight: { name: 'Midnight', colors: { jersey: '#232d31', pants: '#0e1416', saddle: '#529d88' } },
  rose: { name: 'Rose', colors: { jersey: '#e59384', pants: '#873327', saddle: '#e8eeee' } },
  glacier: { name: 'Glacier', colors: { jersey: '#d3dcdc', pants: '#1d443a', saddle: '#aed7c9' } },
};

export function parseSkin(skinStr: string | null | undefined): { mount: MountId; colors: MountColors; name: string } {
  if (!skinStr) {
    return { mount: 'horse', colors: PRESET_COLORS.ember.colors, name: 'Ember' };
  }

  // Format: "preset:mount" or "custom:jersey:pants:saddle:mount" or just "preset"
  if (skinStr.startsWith('custom:')) {
    const parts = skinStr.split(':');
    const mount = (parts[4] && MOUNT_IDS.includes(parts[4] as MountId)) ? (parts[4] as MountId) : 'horse';
    return {
      mount,
      colors: { jersey: parts[1] || '#c4503c', pants: parts[2] || '#5c2821', saddle: parts[3] || '#df9a3f' },
      name: 'Custom',
    };
  }

  const [presetOrMount, mountPart] = skinStr.split(':');
  const mount = (mountPart && MOUNT_IDS.includes(mountPart as MountId))
    ? (mountPart as MountId)
    : (MOUNT_IDS.includes(presetOrMount as MountId) ? (presetOrMount as MountId) : 'horse');

  const presetId = (presetOrMount && PRESET_COLOR_IDS.includes(presetOrMount as PresetColorId))
    ? (presetOrMount as PresetColorId)
    : 'ember';

  const preset = PRESET_COLORS[presetId] || PRESET_COLORS.ember;
  return {
    mount,
    colors: preset.colors,
    name: preset.name,
  };
}

export function buildSkinString(preset: PresetColorId, mount: MountId): string {
  return `${preset}:${mount}`;
}
