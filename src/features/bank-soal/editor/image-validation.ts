export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // PRD BS-07

// Same signatures as BUCKET_RULES['exam-images'] in scripts/local-stack/gateway.mjs.
const IMAGE_RULES: Record<string, { ext: string; match: (b: Uint8Array) => boolean }> = {
  'image/png': { ext: 'png', match: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v) },
  'image/jpeg': { ext: 'jpg', match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/gif': { ext: 'gif', match: (b) => ['GIF87a', 'GIF89a'].includes(ascii(b, 0, 6)) },
  'image/webp': { ext: 'webp', match: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' },
};

function ascii(b: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...b.subarray(start, end));
}

/** Returns the storage extension for a validated image, or throws an Indonesian error message. */
export function validateImage(type: string, size: number, head: Uint8Array): string {
  const rule = IMAGE_RULES[type];
  if (!rule) throw new Error('Format gambar tidak didukung. Gunakan PNG, JPG, WebP, atau GIF.');
  if (size > MAX_IMAGE_BYTES) throw new Error('Ukuran gambar melebihi batas maksimal 2 MB.');
  if (size === 0) throw new Error('File gambar kosong.');
  if (!rule.match(head)) throw new Error('Isi file tidak sesuai format gambar. Pastikan file benar-benar PNG, JPG, WebP, atau GIF.');
  return rule.ext;
}
