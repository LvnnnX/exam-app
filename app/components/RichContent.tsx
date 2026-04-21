"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify';
import hljs from 'highlight.js';
import { ensureHtmlDocument } from '@/lib/rich-text';

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
    'loading',
    'decoding',
    'referrerpolicy',
  ],
};

export default function RichContent({ html, className = '' }: RichContentProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const safeHtml = useMemo(() => {
    if (!mounted) {
      return '';
    }
    const normalized = ensureHtmlDocument(html);
    return String(DOMPurify.sanitize(normalized, SANITIZE_OPTIONS));
  }, [html, mounted]);

  useEffect(() => {
    if (!mounted || !containerRef.current) {
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
  }, [safeHtml, mounted]);

  return (
    <div
      ref={containerRef}
      className={`rich-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}