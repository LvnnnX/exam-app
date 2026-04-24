const HTML_TAG_PATTERN = /<\s*[a-z][^>]*>/i;

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function ensureHtmlDocument(content: string): string {
  const normalized = (content ?? '').trim();
  if (!normalized) {
    return '<p></p>';
  }

  if (HTML_TAG_PATTERN.test(normalized)) {
    return normalized;
  }

  return `<p>${escapeHtml(normalized)}</p>`;
}

export function stripHtml(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}