export const ALLOWED_STYLE_PROPERTIES = new Set([
  'color',
  'background-color',
  'font-family',
  'font-size',
  'line-height',
  'text-align',
]);

export function sanitizeStyleString(rawStyle: string): string {
  if (!rawStyle || typeof rawStyle !== 'string') return '';
  const declarations = rawStyle.split(';');
  const safeDeclarations: string[] = [];

  for (const decl of declarations) {
    const trimmed = decl.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const prop = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const val = trimmed.slice(colonIdx + 1).trim();

    if (!ALLOWED_STYLE_PROPERTIES.has(prop)) continue;
    if (/url\s*\(|expression\s*\(|javascript\s*:|@import|behavior\s*:/i.test(val)) continue;
    if (!/^[a-zA-Z0-9#.,%_\s'"\-()]+$/.test(val)) continue;

    safeDeclarations.push(`${prop}: ${val}`);
  }

  return safeDeclarations.join('; ');
}
