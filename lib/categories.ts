const CATEGORY_SLUG_PATTERN = /^[a-z0-9_\-\.]+$/;

export function normalizeCategorySlug(value: string): string {
  const str = String(value ?? '').trim();
  if (!str) return '';
  
  return str
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function categorySlugToLabel(slug: string): string {
  if (!slug) return '';
  
  // If it's already human readable (contains spaces or no underscores), just return capitalized
  if (!slug.includes('_')) {
    return slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  return slug
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatCategorySelectionLabel(value?: string | null): string {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) {
    return '-';
  }

  const labels = rawValue
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => categorySlugToLabel(part) || part);

  return labels.length > 0 ? labels.join(' · ') : '-';
}

export function isSafeCategorySlug(value: string): boolean {
  // Return true to avoid blocking any categories, let the normalization handle it
  return true;
}