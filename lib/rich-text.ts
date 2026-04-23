const HTML_TAG_PATTERN = /<\s*[a-z][^>]*>/i;

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
  if (content.startsWith('[') && content.endsWith(']')) {
    try {
      const parsed = JSON.parse(content);
      return parsed.map((n: any) => n.children?.map((c: any) => c.text).join('')).join(' ').trim();
    } catch {
      return content;
    }
  }
  return content
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPlateEmpty(content: string): boolean {
  if (!content) return true;
  if (content === '<p></p>' || content === '<p>&nbsp;</p>') return true;
  if (content.startsWith('[') && content.endsWith(']')) {
    try {
      const parsed = JSON.parse(content);
      return parsed.every((node: any) => 
        !node.children || node.children.every((child: any) => !child.text?.trim() && !child.url)
      );
    } catch {
      return false;
    }
  }
  return stripHtml(content).length === 0;
}