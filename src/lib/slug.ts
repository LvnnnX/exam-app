// Strict slug normalizer matching DB function public.normalize_slug(val text).
// Trailing/leading underscores trimmed, lowercase, spaces to _, non-alphanumeric removed.
export function normalizeSlug(val: string | null | undefined): string {
  const str = String(val ?? '').trim().toLowerCase();
  const withUnderscores = str.replace(/\s+/g, '_');
  const cleaned = withUnderscores.replace(/[^a-z0-9_]/g, '');
  return cleaned.replace(/^_+|_+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9_]+$/.test(slug) && !slug.startsWith('_') && !slug.endsWith('_');
}
