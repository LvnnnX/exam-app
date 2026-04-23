"use client";

import React, { useMemo, useEffect } from 'react';
import { Plate, PlateContent, usePlateEditor, PlateElement, type PlateElementProps } from 'platejs/react';
import { ParagraphPlugin } from 'platejs/react';
import { 
  BoldPlugin, 
  ItalicPlugin, 
  StrikethroughPlugin, 
  CodePlugin,
  HeadingPlugin,
  BlockquotePlugin,
  HorizontalRulePlugin
} from '@platejs/basic-nodes/react';
import { ListPlugin } from '@platejs/list-classic/react';
import { ImagePlugin } from '@platejs/media/react';
import { CodeBlockPlugin } from '@platejs/code-block/react';
import { EquationPlugin, InlineEquationPlugin, useEquationElement } from '@platejs/math/react';
import DOMPurify from 'dompurify';

import 'katex/dist/katex.min.css';

type RichContentProps = {
  html: string; // Now this might be stringified JSON
  className?: string;
};

const isJson = (str: string) => {
  if (!str) return false;
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed);
  } catch (e) {
    return false;
  }
};

function ReadOnlyEquation(props: PlateElementProps) {
  const katexRef = React.useRef<HTMLDivElement>(null);
  useEquationElement({ element: props.element as any, katexRef });
  return (
    <PlateElement as="div" className="my-4 flex justify-center" {...props}>
      <div ref={katexRef} className="text-lg" />
      {props.children}
    </PlateElement>
  );
}

function ReadOnlyInlineEquation(props: PlateElementProps) {
  const katexRef = React.useRef<HTMLDivElement>(null);
  useEquationElement({ element: props.element as any, katexRef });
  return (
    <PlateElement as="span" className="inline-block mx-1 align-middle" {...props}>
      <span ref={katexRef} className="text-base" />
      {props.children}
    </PlateElement>
  );
}

export default function RichContent({ html, className = '' }: RichContentProps) {
  const isPlate = useMemo(() => isJson(html), [html]);

  const editorValue = useMemo(() => {
    if (isPlate) return JSON.parse(html);
    return [];
  }, [html, isPlate]);

  const editor = usePlateEditor({
    value: editorValue,
    plugins: [
      ParagraphPlugin,
      HeadingPlugin,
      BlockquotePlugin,
      BoldPlugin,
      ItalicPlugin,
      StrikethroughPlugin,
      CodePlugin,
      ListPlugin,
      HorizontalRulePlugin,
      ImagePlugin,
      CodeBlockPlugin,
      EquationPlugin,
      InlineEquationPlugin,
    ],
    override: {
      components: {
        blockquote: (props: PlateElementProps) => (
          <PlateElement as="blockquote" className="border-l-4 border-gray-200 pl-4 italic text-gray-600 my-4" {...props} />
        ),
        h1: (props: PlateElementProps) => <PlateElement as="h1" className="text-3xl font-bold my-4" {...props} />,
        h2: (props: PlateElementProps) => <PlateElement as="h2" className="text-2xl font-bold my-3" {...props} />,
        h3: (props: PlateElementProps) => <PlateElement as="h3" className="text-xl font-bold my-2" {...props} />,
        hr: (props: PlateElementProps) => {
          const { children, ...rest } = props;
          return (
            <PlateElement as="div" {...rest}>
              <hr className="my-4 border-t-2 border-gray-200" />
              {children}
            </PlateElement>
          );
        },
        img: (props: PlateElementProps) => (
          <PlateElement as="div" className="my-4" {...props}>
            <img src={props.element.url as string} alt="" className="max-w-full rounded-lg shadow-sm" />
            {props.children}
          </PlateElement>
        ),
        code_block: (props: PlateElementProps) => (
          <PlateElement as="pre" className="bg-gray-900 text-gray-100 p-4 rounded-lg my-4 font-mono text-sm overflow-x-auto" {...props}>
            <code>{props.children}</code>
          </PlateElement>
        ),
        code_line: (props: PlateElementProps) => (
          <PlateElement as="div" {...props} />
        ),
        equation: ReadOnlyEquation,
        inline_equation: ReadOnlyInlineEquation,
      }
    }
  });

  // Sync value for read-only editor
  useEffect(() => {
    if (isPlate && editor) {
      editor.tf.setValue(editorValue);
    }
  }, [editorValue, editor, isPlate]);

  // If it's legacy HTML, we still use the old sanitizer + dangerouslySetInnerHTML
  const safeHtml = useMemo(() => {
    if (isPlate) return '';
    return DOMPurify.sanitize(html || '', {
      USE_PROFILES: { html: true },
    });
  }, [html, isPlate]);

  if (isPlate) {
    return (
      <div className={`rich-content-plate ${className}`}>
        <Plate editor={editor} readOnly>
          <PlateContent className="prose prose-slate max-w-none" />
        </Plate>
      </div>
    );
  }

  return (
    <div
      className={`rich-content-legacy ${className}`}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}