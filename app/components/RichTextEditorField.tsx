"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Mathematics } from '@tiptap/extension-mathematics';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { common, createLowlight } from 'lowlight';
import { ensureHtmlDocument } from '@/lib/rich-text';
import { supabase } from '@/lib/supabase';

import 'katex/dist/katex.min.css';

type RichTextEditorFieldProps = {
  label: string;
  value: string;
  onChange: (html: string) => void;
  description?: string;
  density?: 'compact' | 'comfortable';
};

const lowlight = createLowlight(common);

const CODE_LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'pseudocode', label: 'Pseudocode' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML/HTML' },
  { value: 'markdown', label: 'Markdown' },
];

export default function RichTextEditorField({
  label,
  value,
  onChange,
  description,
  density = 'compact',
}: RichTextEditorFieldProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('plaintext');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const normalizedValue = useMemo(() => ensureHtmlDocument(value), [value]);
  const isCompact = density === 'compact';

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Image,
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Mathematics.configure({
        katexOptions: {
          throwOnError: false,
        },
        inlineOptions: {
          onClick: (node, pos) => {
            const latex = prompt('Edit LaTeX formula (inline):', node.attrs.latex);
            if (latex !== null && editor) {
              editor.chain().setNodeSelection(pos).updateInlineMath({ latex }).focus().run();
            }
          },
        },
        blockOptions: {
          onClick: (node, pos) => {
            const latex = prompt('Edit LaTeX formula (block):', node.attrs.latex);
            if (latex !== null && editor) {
              editor.chain().setNodeSelection(pos).updateBlockMath({ latex }).focus().run();
            }
          },
        },
      }),
    ],
    content: normalizedValue,
    editorProps: {
      attributes: {
        class: `tiptap-editor ${isCompact ? 'min-h-[120px] px-3 py-2 text-sm' : 'min-h-[160px] p-4'}`,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isFocused) {
      return;
    }

    const editorHtml = editor.getHTML();
    if (editorHtml !== normalizedValue) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false });
    }
  }, [editor, normalizedValue]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    try {
      setIsUploading(true);
      
      // Attempt to delete existing if it's an overwrite, but typically these are novel file names
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('exam-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('exam-images').getPublicUrl(filePath);

      if (data?.publicUrl) {
        editor.chain().focus().setImage({ src: data.publicUrl, alt: file.name }).run();
      }
    } catch (err: any) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const insertImage = () => {
    fileInputRef.current?.click();
  };

  const applyCodeBlock = () => {
    if (!editor) {
      return;
    }

    const language = selectedLanguage === 'pseudocode' ? 'plaintext' : selectedLanguage;
    editor.chain().focus().toggleCodeBlock({ language }).run();
  };

  const insertInlineMath = () => {
    if (!editor) return;
    const latex = prompt('Enter inline LaTeX formula:', '\\frac{a}{b}');
    if (latex) {
      editor.chain().focus().insertInlineMath({ latex }).run();
    }
  };

  const insertBlockMath = () => {
    if (!editor) return;
    const latex = prompt('Enter block LaTeX formula:', '\\sum_{i=1}^{n} x_i');
    if (latex) {
      editor.chain().focus().insertBlockMath({ latex }).run();
    }
  };

  if (!editor) {
    return <div className="p-4 border rounded-lg bg-gray-50 animate-pulse">Initializing editor...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rich Text</span>
      </div>
      {description && (
        <p className="text-[11px] text-gray-400 mb-2">{description}</p>
      )}

      <div className={`tiptap-shell border border-slate-200 ${isCompact ? 'rounded-xl' : 'rounded-2xl'} bg-white overflow-hidden shadow-sm transition-all focus-within:border-nike-black`}>
        <div className={`tiptap-toolbar border-b bg-slate-50/70 ${isCompact ? 'p-1.5 gap-1' : 'p-2 gap-1.5'} flex flex-wrap items-center sticky top-0 z-10 backdrop-blur-md`}>
          <div className="flex flex-wrap gap-1 items-center">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('bold') ? 'is-active' : ''}`}
              title="Bold"
            >
              <span className="font-bold px-1">B</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('italic') ? 'is-active' : ''}`}
              title="Italic"
            >
              <span className="italic px-1">I</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('strike') ? 'is-active' : ''}`}
              title="Strikethrough"
            >
              <span className="line-through px-1">S</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('code') ? 'is-active' : ''}`}
              title="Inline Code"
            >
              <span className="font-mono px-1 text-xs">{`<>`}</span>
            </button>
          </div>
          
          <div className="h-6 w-[1px] bg-gray-300 mx-0.5 hidden sm:block" />

          <div className="flex flex-wrap gap-1 items-center">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('bulletList') ? 'is-active' : ''}`}
              title="Bullet List"
            >
              • Bullets
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('orderedList') ? 'is-active' : ''}`}
              title="Ordered List"
            >
              1. List
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('blockquote') ? 'is-active' : ''}`}
              title="Blockquote"
            >
              ❝ Quote
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''}`}
              title="Horizontal Rule"
            >
              ― HR
            </button>
          </div>

          <div className="h-6 w-[1px] bg-gray-300 mx-0.5 hidden sm:block" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={insertImage}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} flex items-center gap-2 text-xs font-bold`}
              disabled={isUploading}
            >
              {isUploading ? '...' : '🖼️ IMAGE'}
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          <div className="h-6 w-[1px] bg-gray-300 mx-0.5 hidden sm:block" />

          {/* Table Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs font-bold whitespace-nowrap`}
              title="Insert Table"
            >
              ▦ TBL
            </button>
            {editor.isActive('table') && (
              <>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs`}
                  title="Add Column"
                >
                  +C
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs`}
                  title="Add Row"
                >
                  +R
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs text-red-600`}
                  title="Delete Column"
                >
                  -C
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs text-red-600`}
                  title="Delete Row"
                >
                  -R
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs text-red-600 font-bold`}
                  title="Delete Table"
                >
                  Del
                </button>
              </>
            )}
          </div>

          <div className="h-6 w-[1px] bg-gray-300 mx-0.5 hidden sm:block" />

          {/* LaTeX / Math Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={insertInlineMath}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs font-bold whitespace-nowrap`}
              title="Insert inline LaTeX formula"
            >
              Σ Inline
            </button>
            <button
              type="button"
              onClick={insertBlockMath}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs font-bold whitespace-nowrap`}
              title="Insert block LaTeX formula"
            >
              Σ Block
            </button>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <select
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(event.target.value)}
              className={`text-[10px] sm:text-xs font-bold border border-gray-200 rounded-lg px-2 ${isCompact ? 'h-[28px]' : 'h-[32px]'} bg-white focus:border-nike-black outline-none transition-colors uppercase tracking-wider`}
            >
              {CODE_LANGUAGES.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyCodeBlock}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs font-bold ${editor.isActive('codeBlock') ? 'is-active' : ''} whitespace-nowrap`}
            >
              {'</>'} CODE
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} text-nike-red hover:bg-red-50 border-red-100 font-bold`}
              title="Clear Formatting"
            >
              ×
            </button>
          </div>
        </div>

        <EditorContent editor={editor} />
      </div>
    </div>
  );
}