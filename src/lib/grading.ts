// Server-side grading for short_answer questions (PRD BS-09).
// Whitespace insensitive, case insensitive, HTML stripped before comparison.
// Identical to PostgreSQL RPC: regexp_replace(lower(public.strip_html(val)), '\s+', '', 'g').
export function stripHtml(html: string | null | undefined): string {
  const s = String(html ?? '');
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeShortAnswer(val: string | null | undefined): string {
  const stripped = stripHtml(val);
  return stripped.toLowerCase().replace(/\s+/g, '');
}

export function checkShortAnswer(userAnswer: string | null | undefined, answerKey: string | null | undefined): boolean {
  const u = normalizeShortAnswer(userAnswer);
  const k = normalizeShortAnswer(answerKey);
  if (!k) return false;
  return u === k;
}
