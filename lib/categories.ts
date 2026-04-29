const CATEGORY_SLUG_PATTERN = /^[a-z0-9_]+$/;

export function normalizeCategorySlug(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function categorySlugToLabel(slug: string): string {
  const normalized = normalizeCategorySlug(slug);

  if (!normalized) {
    return '';
  }

  return normalized
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function isSafeCategorySlug(value: string): boolean {
  return CATEGORY_SLUG_PATTERN.test(value);
}