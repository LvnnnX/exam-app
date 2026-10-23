// Browser-only DOMPurify sanitizer for Client Components (RichContent, etc.)
// Zero node:module / jsdom dependencies, completely safe for Next.js Turbopack client bundling.
import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify';
import { ALLOWED_STYLE_PROPERTIES, sanitizeStyleString } from './sanitizer-common';

export { ALLOWED_STYLE_PROPERTIES, sanitizeStyleString };

function installHooks(purifier: typeof DOMPurify) {
  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (!node || (node as Node).nodeType !== 1) return;
    const el = node as unknown as Element;
    if (typeof el.hasAttribute === 'function' && el.hasAttribute('style')) {
      const raw = el.getAttribute('style') || '';
      const cleaned = sanitizeStyleString(raw);
      if (cleaned) el.setAttribute('style', cleaned);
      else el.removeAttribute('style');
    }
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || '';
      if (/^\s*(javascript|vbscript|data):/i.test(href)) el.removeAttribute('href');
    }
    if (el.tagName === 'IMG') {
      const src = el.getAttribute('src') || '';
      const isAllowed = /^(?:https:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(src) || src.startsWith('/');
      if (!isAllowed) el.remove();
    }
  });
}

let clientPurifier: ReturnType<typeof DOMPurify> | null = null;

function getClientPurifier(): ReturnType<typeof DOMPurify> | null {
  if (clientPurifier) return clientPurifier;
  if (typeof window !== 'undefined') {
    clientPurifier = DOMPurify(window);
    installHooks(clientPurifier);
  }
  return clientPurifier;
}

const SANITIZE_CONFIG: DomPurifyConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'sub', 'sup', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'hr',
    'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col',
    'img', 'mark',
  ],
  ALLOWED_ATTR: [
    'style', 'class', 'src', 'alt', 'title', 'loading', 'decoding', 'width', 'height',
    'colspan', 'rowspan', 'colwidth', 'data-language', 'data-type', 'data-latex',
  ],
  ADD_ATTR: ['colspan', 'rowspan', 'colwidth', 'data-language', 'data-type', 'data-latex'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta', 'link'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction'],
  KEEP_CONTENT: true,
};

function basicSsrSanitize(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi, 'href=""');
}

export function sanitizeHtml(html: string | null | undefined): string {
  const input = String(html ?? '').trim();
  if (!input) return '';
  const purifier = getClientPurifier();
  if (!purifier) return basicSsrSanitize(input);
  return String(purifier.sanitize(input, SANITIZE_CONFIG));
}
