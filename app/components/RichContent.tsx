"use client";

import React, { useEffect, useMemo, useRef } from 'react';
import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify';
import hljs from 'highlight.js';
import katex from 'katex';
import { ensureHtmlDocument } from '@/lib/rich-text';

import 'katex/dist/katex.min.css';

type RichContentProps = {
  html: string;
  className?: string;
};

const SANITIZE_OPTIONS: DomPurifyConfig = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'src',
    'alt',
    'title',
    'class',
    'data-language',
    'data-type',
    'data-latex',
    'loading',
    'decoding',
    'referrerpolicy',
  ],
  // Block any URI scheme that can execute script. Allow http(s), mailto,
  // tel, relative paths, fragments, and data: only for image bytes.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[#/?]|data:image\/(?:png|jpeg|gif|webp|svg\+xml);)/i,
  ADD_ATTR: ['target', 'rel'],
  KEEP_CONTENT: true,
};

let domPurifyHooksInstalled = false;
function ensureDomPurifyHooks() {
  if (domPurifyHooksInstalled) return;
  domPurifyHooksInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (!(node instanceof Element)) return;
    if (node.tagName === 'A') {
      // Force safe target/rel on every anchor to block reverse tabnabbing.
      const href = node.getAttribute('href') || '';
      if (/^\s*javascript:/i.test(href) || /^\s*vbscript:/i.test(href)) {
        node.removeAttribute('href');
      }
      if (node.hasAttribute('target')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
    if (node.tagName === 'IMG') {
      // Allow only http(s) and data:image; strip anything else.
      const src = node.getAttribute('src') || '';
      if (!/^(?:https?:\/\/|data:image\/(?:png|jpeg|gif|webp|svg\+xml);)/i.test(src) && !src.startsWith('/')) {
        node.removeAttribute('src');
      }
    }
  });
}

function RichContent({ html, className = '' }: RichContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const safeHtml = useMemo(() => {
    ensureDomPurifyHooks();
    const normalized = ensureHtmlDocument(html);
    return String(DOMPurify.sanitize(normalized, SANITIZE_OPTIONS));
  }, [html]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const codeBlocks = containerRef.current.querySelectorAll('pre code');
    codeBlocks.forEach((block) => {
      const element = block as HTMLElement;
      if (element.className.includes('language-pseudocode')) {
        element.classList.remove('language-pseudocode');
        element.classList.add('language-plaintext');
      }

      if (!element.dataset.hljsDone) {
        hljs.highlightElement(element);
        element.dataset.hljsDone = 'true';
      }
    });

    const images = containerRef.current.querySelectorAll('img');
    images.forEach((image) => {
      image.setAttribute('loading', 'lazy');
      image.setAttribute('decoding', 'async');
      image.setAttribute('referrerpolicy', 'no-referrer');
    });

    // Render KaTeX math nodes that come from TipTap's Mathematics extension
    const mathNodes = containerRef.current.querySelectorAll('[data-type="inline-math"], [data-type="block-math"]');
    mathNodes.forEach((node) => {
      const element = node as HTMLElement;
      const latex = element.getAttribute('data-latex') || element.textContent || '';
      const isBlock = element.getAttribute('data-type') === 'block-math';

      if (latex && !element.dataset.katexDone) {
        try {
          element.innerHTML = katex.renderToString(latex, {
            throwOnError: false,
            displayMode: isBlock,
          });
          element.dataset.katexDone = 'true';
        } catch {
          // Leave content as-is if KaTeX fails
        }
      }
    });
  }, [safeHtml]);

  return (
    <div
      ref={containerRef}
      className={`rich-content ${className} [&_img]:mx-auto [&_img]:block [&_img]:max-w-full [&_img]:h-auto [&_ul]:list-disc [&_ul]:ml-6 [&_ol]:list-decimal [&_ol]:ml-6`.trim()}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
export default React.memo(RichContent);
