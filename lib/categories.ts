
export function normalizeCategorySlug(value: string): string {
  const str = String(value ?? '').trim();
  if (!str) return '';

  return str
    .toLowerCase()
    // Expand "&" to "dan" so "Kurs & Inflasi" stays meaningful as "kurs_dan_inflasi"
    // instead of silently merging into "kurs_inflasi".
    .replace(/&/g, ' dan ')
    // Any character that is not a-z, 0-9 becomes a separator. This folds spaces,
    // parentheses, slashes, hyphens, dots, and other punctuation into underscores
    // so labels like "Teori Perilaku Konsumen (Utilitas Marginal)" or
    // "Kebijakan Kurs (Revaluasi/Devaluasi)" produce a clean slug.
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    // Hard cap to match isSafeCategorySlug's 80-char ceiling. Trim a trailing
    // underscore if the cut lands on one.
    .slice(0, 80)
    .replace(/_+$/g, '');
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
  return /^[a-z0-9_]{1,80}$/.test(value);
}
