"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
  Plate, 
  PlateContent, 
  usePlateEditor, 
  PlateElement, 
  type PlateElementProps,
  useEditorSelector,
  useEditorRef,
} from 'platejs/react';
import { type TElement } from '@platejs/slate';
import { ParagraphPlugin } from 'platejs/react';
import { 
  BoldPlugin, 
  ItalicPlugin, 
  StrikethroughPlugin, 
  CodePlugin,
  HeadingPlugin,
  BlockquotePlugin,
  HorizontalRulePlugin,
} from '@platejs/basic-nodes/react';
import { ListPlugin } from '@platejs/list-classic/react';
import { ImagePlugin } from '@platejs/media/react';
import { CodeBlockPlugin } from '@platejs/code-block/react';
import { EquationPlugin, InlineEquationPlugin, useEquationElement } from '@platejs/math/react';
import { supabase } from '@/lib/supabase';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  List, 
  ListOrdered, 
  Quote, 
  Image as ImageIcon, 
  Terminal, 
  Sigma,
  Eraser,
  Minus
} from 'lucide-react';

import 'katex/dist/katex.min.css';

type RichTextEditorFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

// Helper to check if string is valid JSON array (Plate format)
const isJson = (str: string) => {
  if (!str) return false;
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed);
  } catch (e) {
    return false;
  }
};

const DEFAULT_VALUE = [{ type: 'p', children: [{ text: '' }] }];

/**
 * Equation render components using KaTeX.
 * useEquationElement renders the LaTeX into the katexRef div.
 */
function EquationComponent(props: PlateElementProps) {
  const katexRef = React.useRef<HTMLDivElement>(null);
  useEquationElement({ element: props.element as any, katexRef });

  return (
    <PlateElement as="div" className="my-4 flex justify-center" {...props}>
      <div ref={katexRef} className="text-lg" />
      {props.children}
    </PlateElement>
  );
}

function InlineEquationComponent(props: PlateElementProps) {
  const katexRef = React.useRef<HTMLDivElement>(null);
  useEquationElement({ element: props.element as any, katexRef });

  return (
    <PlateElement as="span" className="inline-block mx-1 align-middle" {...props}>
      <span ref={katexRef} className="text-base" />
      {props.children}
    </PlateElement>
  );
}

export default function RichTextEditorField({
  label,
  value,
  onChange,
}: RichTextEditorFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = usePlateEditor({
    value: DEFAULT_VALUE,
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
          <PlateElement as="div" className="my-4 relative group" {...props}>
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
        equation: EquationComponent,
        inline_equation: InlineEquationComponent,
      }
    }
  });

  // Synchronize external value with editor
  useEffect(() => {
    if (!editor) return;
    
    let targetValue = DEFAULT_VALUE;
    if (value) {
      if (isJson(value)) {
        targetValue = JSON.parse(value);
      } else {
        // Fallback for legacy HTML: strip tags and use as text
        targetValue = [{ type: 'p', children: [{ text: value.replace(/<[^>]*>/g, '') }] }];
      }
    }

    // Only update if value is actually different to avoid cursor jumps
    const currentValue = editor.children;
    if (JSON.stringify(currentValue) !== JSON.stringify(targetValue)) {
      editor.tf.setValue(targetValue);
    }
  }, [value, editor]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('exam-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('exam-images').getPublicUrl(filePath);

      if (data?.publicUrl) {
        editor.tf.insertNodes({
          type: 'img',
          url: data.publicUrl,
          children: [{ text: '' }],
        } as TElement);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      
      <div className="border-2 border-gray-100 rounded-xl bg-white overflow-hidden shadow-sm transition-all focus-within:border-black">
        <Plate 
          editor={editor}
          onChange={({ value }) => {
            onChange(JSON.stringify(value));
          }}
        >
          {/* Toolbar rendered INSIDE <Plate> so hooks can access the editor context */}
          <EditorToolbar 
            isUploading={isUploading} 
            fileInputRef={fileInputRef} 
            editor={editor}
          />

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />

          <PlateContent 
            className="min-h-[200px] p-6 focus:outline-none prose prose-slate max-w-none"
            placeholder="Start typing..."
          />
        </Plate>
      </div>
    </div>
  );
}

/**
 * Toolbar component rendered INSIDE <Plate> so it can use
 * useEditorRef / useEditorSelector for reactive active-state detection.
 */
function EditorToolbar({ 
  isUploading, 
  fileInputRef,
  editor,
}: { 
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  editor: ReturnType<typeof usePlateEditor>;
}) {
  const editorRef = useEditorRef();
  const [showLatexInput, setShowLatexInput] = useState(false);
  const [latexValue, setLatexValue] = useState('');
  const latexInputRef = useRef<HTMLInputElement>(null);

  // Reactive mark state — re-renders only when the specific mark state changes
  const isBoldActive = useEditorSelector((e) => e.api.hasMark('bold'), []);
  const isItalicActive = useEditorSelector((e) => e.api.hasMark('italic'), []);
  const isStrikeActive = useEditorSelector((e) => e.api.hasMark('strikethrough'), []);
  const isCodeActive = useEditorSelector((e) => e.api.hasMark('code'), []);

  // Reactive block state
  const isBlockquoteActive = useEditorSelector(
    (e) => !!e.api.block({ match: { type: 'blockquote' } }), []
  );
  const isCodeBlockActive = useEditorSelector(
    (e) => !!e.api.block({ match: { type: 'code_block' } }), []
  );
  const isBulletListActive = useEditorSelector(
    (e) => !!e.api.block({ match: { type: 'ul' } }), []
  );
  const isOrderedListActive = useEditorSelector(
    (e) => !!e.api.block({ match: { type: 'ol' } }), []
  );

  // Mark toggle handler — uses the correct Plate v52 API: editor.tf.toggleMark(string)
  const toggleMark = useCallback((markType: string) => {
    editorRef.tf.toggleMark(markType);
    editorRef.tf.focus();
  }, [editorRef]);

  const insertLatex = useCallback(() => {
    const tex = latexValue.trim();
    if (tex) {
      (editorRef.tf as any).insert.inlineEquation(tex);
      editorRef.tf.focus();
    }
    setLatexValue('');
    setShowLatexInput(false);
  }, [editorRef, latexValue]);

  // Focus latex input when popup opens
  useEffect(() => {
    if (showLatexInput && latexInputRef.current) {
      latexInputRef.current.focus();
    }
  }, [showLatexInput]);

  return (
    <div className="border-b bg-gray-50/50 p-2 flex flex-wrap items-center gap-1 sticky top-0 z-10 backdrop-blur-md">
      {/* ── Mark buttons ── */}
      <ToolbarButton 
        onClick={() => toggleMark('bold')} 
        active={isBoldActive}
        title="Bold (Ctrl+B)"
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => toggleMark('italic')} 
        active={isItalicActive}
        title="Italic (Ctrl+I)"
      >
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => toggleMark('strikethrough')} 
        active={isStrikeActive}
        title="Strikethrough"
      >
        <Strikethrough size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => toggleMark('code')} 
        active={isCodeActive}
        title="Inline Code"
      >
        <Code size={16} />
      </ToolbarButton>

      <div className="h-4 w-[1px] bg-gray-300 mx-1" />

      {/* ── List buttons — use plugin-specific transforms ── */}
      <ToolbarButton 
        onClick={() => {
          (editorRef.tf as any).ul.toggle();
          editorRef.tf.focus();
        }} 
        active={isBulletListActive}
        title="Bullet List"
      >
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => {
          (editorRef.tf as any).ol.toggle();
          editorRef.tf.focus();
        }} 
        active={isOrderedListActive}
        title="Ordered List"
      >
        <ListOrdered size={16} />
      </ToolbarButton>

      {/* ── Block buttons ── */}
      <ToolbarButton 
        onClick={() => {
          (editorRef.tf as any).blockquote.toggle();
          editorRef.tf.focus();
        }}
        active={isBlockquoteActive}
        title="Quote"
      >
        <Quote size={16} />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => {
          editorRef.tf.insertNodes({ type: 'hr', children: [{ text: '' }] } as TElement);
          editorRef.tf.focus();
        }} 
        title="Divider"
      >
        <Minus size={16} />
      </ToolbarButton>

      <div className="h-4 w-[1px] bg-gray-300 mx-1" />

      {/* ── Media & code ── */}
      <ToolbarButton 
        onClick={() => fileInputRef.current?.click()} 
        disabled={isUploading}
        title="Image"
      >
        <ImageIcon size={16} />
      </ToolbarButton>

      <ToolbarButton 
        onClick={() => {
          const isActive = !!editorRef.api.block({ match: { type: 'code_block' } });
          if (isActive) {
            // Unwrap: convert code_line children back to paragraphs
            editorRef.tf.withoutNormalizing(() => {
              const codeBlockEntry = editorRef.api.above({ match: { type: 'code_block' } });
              if (codeBlockEntry) {
                const [, cbPath] = codeBlockEntry;
                // Set all code_line children to paragraph type
                const children: any[] = Array.from((editorRef as any).api.nodes({ 
                  at: cbPath, 
                  match: { type: 'code_line' } 
                }));
                for (const entry of children) {
                  editorRef.tf.setNodes({ type: 'p' }, { at: entry[1] });
                }
                // Unwrap the code_block wrapper
                editorRef.tf.unwrapNodes({ 
                  at: cbPath, 
                  match: { type: 'code_block' } 
                });
              }
            });
          } else {
            // Wrap: convert current block to code_block > code_line
            editorRef.tf.setNodes({ type: 'code_line' } as any);
            editorRef.tf.wrapNodes({ 
              type: 'code_block', 
              children: [] 
            } as TElement);
          }
          editorRef.tf.focus();
        }}
        active={isCodeBlockActive}
        title="Code Block"
      >
        <Terminal size={16} />
      </ToolbarButton>

      {/* ── LaTeX with inline input popup ── */}
      <div className="relative">
        <ToolbarButton 
          onClick={() => setShowLatexInput(!showLatexInput)} 
          active={showLatexInput}
          title="Math (LaTeX)"
        >
          <Sigma size={16} />
        </ToolbarButton>

        {showLatexInput && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[280px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              LaTeX Expression
            </label>
            <div className="flex gap-2">
              <input
                ref={latexInputRef}
                type="text"
                value={latexValue}
                onChange={(e) => setLatexValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    insertLatex();
                  }
                  if (e.key === 'Escape') {
                    setLatexValue('');
                    setShowLatexInput(false);
                    editorRef.tf.focus();
                  }
                }}
                placeholder="e.g. x^2 + y^2 = r^2"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent font-mono"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  insertLatex();
                }}
                disabled={!latexValue.trim()}
                className="px-3 py-1.5 text-sm bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Insert
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Press Enter to insert, Escape to cancel
            </p>
          </div>
        )}
      </div>

      <div className="ml-auto">
        <ToolbarButton 
          onClick={() => {
            editorRef.tf.setValue(DEFAULT_VALUE);
          }}
          className="text-red-500 hover:bg-red-50"
          title="Clear All"
        >
          <Eraser size={16} />
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarButton({ 
  children, 
  onClick, 
  active, 
  disabled,
  title,
  className = ''
}: { 
  children: React.ReactNode; 
  onClick: () => void; 
  active?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Use onMouseDown + preventDefault to keep editor focus
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
        active 
          ? 'bg-black text-white' 
          : 'text-gray-600 hover:bg-gray-100'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
}