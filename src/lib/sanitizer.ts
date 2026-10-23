// Strict HTML sanitizer for Exam App v2 (PRD BS-03, BS-07).
// Runs in browser (native window) or Node.js server (via jsdom).
// ALLOWS style attribute, but PRUNES style declarations to ONLY:
//   color, background-color, font-family, font-size, line-height, text-align.
// Blocks url(), javascript:, expression, behavior, fixed positioning, etc.
import { createRequire } from 'node:module';
import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify';

const esmRequire = createRequire(import.meta.url);

export const ALLOWED_STYLE_PROPERTIES = new Set([
  'color',
  'background-color',
  'font-family',
  'font-size',
  'line-height',
  'text-align',
]);

const ALLOWED_TAGS = [
  'p', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'sub', 'sup', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'hr',
  'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col',
  'img', 'mark',
];

const ALLOWED_ATTRS = [
  'style',
  'class',
  'src', 'alt', 'title', 'loading', 'decoding', 'width', 'height',
  'colspan', 'rowspan', 'colwidth',
  'data-language', 'data-type', 'data-latex',
];

// Clean a CSS style string: only keep whitelisted properties with safe values.
// Drops anything containing url(), javascript:, expression, bindings, or non-whitelisted props.
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
    // Reject dangerous value vectors: url(), expression(), javascript:, @import, behaviors
    if (/url\s*\(|expression\s*\(|javascript\s*:|@import|behavior\s*:/i.test(val)) continue;
    // Basic character filter for CSS values (alphanumeric, spaces, quotes, %, px, pt, rem, em, #, commas, dashes)
    if (!/^[a-zA-Z0-9#.,%_\s'"\-()]+$/.test(val)) continue;

    safeDeclarations.push(`${prop}: ${val}`);
  }

  return safeDeclarations.join('; ');
}

// Hook to scrub element styles and force safe attributes
function installHooks(purifier: typeof DOMPurify) {
  purifier.addHook('afterSanitizeAttributes', (node) => {
    // Check if element node (works in both browser and jsdom)
    if (!node || (node as Node).nodeType !== 1) return;
    const el = node as unknown as Element;

    // Prune inline style attribute to strictly allowed properties
    if (typeof el.hasAttribute === 'function' && el.hasAttribute('style')) {
      const raw = el.getAttribute('style') || '';
      const cleaned = sanitizeStyleString(raw);
      if (cleaned) {
        el.setAttribute('style', cleaned);
      } else {
        el.removeAttribute('style');
      }
    }

    // Anchor tags: not allowed to link outside in v2 questions, but if present strip javascript
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || '';
      if (/^\s*(javascript|vbscript|data):/i.test(href)) {
        el.removeAttribute('href');
      }
    }

    // Images: only allow https:// or /relative or data:image/ safe types
    if (el.tagName === 'IMG') {
      const src = el.getAttribute('src') || '';
      const isAllowed =
        /^(?:https:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(src) ||
        src.startsWith('/');
      if (!isAllowed) {
        // Strip the entire element if src is invalid or dangerous
        el.remove();
      }
    }
  });
}

let purifyInstance: ReturnType<typeof DOMPurify> | null = null;

export function getPurifier(): ReturnType<typeof DOMPurify> {
  if (purifyInstance) return purifyInstance;

  if (typeof window !== 'undefined' && window.document) {
    purifyInstance = DOMPurify(window);
    installHooks(purifyInstance);
  } else {
    // Node.js SSR/server action environment
    const { JSDOM } = esmRequire('jsdom') as typeof import('jsdom');
    const dom = new JSDOM('<!DOCTYPE html>');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    purifyInstance = DOMPurify(dom.window as any);
    installHooks(purifyInstance);
  }

  return purifyInstance;
}

const SANITIZE_CONFIG: DomPurifyConfig = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: ALLOWED_ATTRS,
  ADD_ATTR: ['colspan', 'rowspan', 'colwidth', 'data-language', 'data-type', 'data-latex'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta', 'link'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction'],
  KEEP_CONTENT: true,
};

export function sanitizeHtml(html: string | null | undefined): string {
  const input = String(html ?? '').trim();
  if (!input) return '';
  const purifier = getPurifier();
  return String(purifier.sanitize(input, SANITIZE_CONFIG));
}
