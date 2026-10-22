'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import hljs from 'highlight.js';
import katex from 'katex';
import { sanitizeHtml } from '@/src/lib/sanitizer';

import 'katex/dist/katex.min.css';

type RichContentProps = {
  html: string;
  className?: string;
};

export default function RichContent({ html, className = '' }: RichContentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const cleanHtml = useMemo(() => {
    return sanitizeHtml(html);
  }, [html]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Render KaTeX for math containers
    const mathNodes = el.querySelectorAll<HTMLElement>('.tiptap-mathematics-render, [data-latex]');
    mathNodes.forEach((node) => {
      const latex = node.getAttribute('data-latex') || node.textContent?.replace(/^\$+|\$+$/g, '') || '';
      const isBlock = node.getAttribute('data-type') === 'block-math' || node.tagName === 'P';
      if (latex.trim()) {
        try {
          katex.render(latex.trim(), node, {
            displayMode: isBlock,
            throwOnError: false,
          });
        } catch {
          // ignore katex render errors
        }
      }
    });

    // Highlight code blocks
    const codeBlocks = el.querySelectorAll<HTMLElement>('pre code');
    codeBlocks.forEach((block) => {
      try {
        hljs.highlightElement(block);
      } catch {
        // ignore highlight errors
      }
    });
  }, [cleanHtml]);

  return (
    <div
      ref={containerRef}
      className={`rich-content prose max-w-none text-fg ${className}`}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
}
