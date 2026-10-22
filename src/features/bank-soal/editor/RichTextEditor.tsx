'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { buildEditorExtensions } from './extensions';
import Toolbar from './Toolbar';
import MathDialog from './MathDialog';
import TableDialog from './TableDialog';
import { uploadQuestionImage } from './ImageUploader';
import { sanitizeHtml } from '@/src/lib/sanitizer';
import type { RichTextEditorProps } from './types';

import 'katex/dist/katex.min.css';

export default function RichTextEditor({
  label,
  value,
  onChange,
  description,
  compactToolbar = false,
  placeholder = 'Ketik isi soal di sini...',
}: RichTextEditorProps) {
  const [mathOpen, setMathOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const extensions = useMemo(() => buildEditorExtensions(), []);

  const editor = useEditor({
    extensions,
    content: value || '<p></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap-editor focus:outline-none min-h-[140px] p-3 text-sm text-fg leading-relaxed',
        placeholder,
      },
      transformPastedHTML(html) {
        // Retain supported Word/Docs styling through our strict sanitizer
        return sanitizeHtml(html);
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  // Sync external value changes (e.g. form reset or question selection change)
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    const cleanCurrent = currentHtml === '<p></p>' ? '' : currentHtml;
    const cleanNext = value === '<p></p>' ? '' : (value || '');
    if (cleanCurrent !== cleanNext) {
      editor.commands.setContent(cleanNext || '<p></p>', { emitUpdate: false });
    }
  }, [value, editor]);

  const handleInsertMath = (latex: string, isBlock: boolean) => {
    if (!editor) return;
    if (isBlock) {
      // Block math: wrap in container or paragraph
      editor.chain().focus().insertContent(`<p class="tiptap-mathematics-render" data-type="block-math" data-latex="${latex}">$$${latex}$$</p>`).run();
    } else {
      editor.chain().focus().insertContent(`<span class="tiptap-mathematics-render" data-type="inline-math" data-latex="${latex}">$${latex}$</span>`).run();
    }
  };

  const handleSelectImage = async (file: File) => {
    if (!editor) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadQuestionImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-fg-muted">{label}</label>
          {uploading && <span className="text-xs text-primary font-medium animate-pulse">Mengunggah gambar...</span>}
        </div>
      )}

      {description && <p className="text-xs text-fg-subtle mb-1">{description}</p>}

      {uploadError && (
        <div className="p-2 rounded-lg bg-brick-50 text-danger text-xs border border-brick-200">
          {uploadError}
        </div>
      )}

      <div className="rounded-2xl well border border-line-strong overflow-hidden focus-within:border-primary transition-colors flex flex-col bg-canvas/40">
        <Toolbar
          editor={editor}
          onOpenMath={() => setMathOpen(true)}
          onOpenTable={() => setTableOpen(true)}
          onSelectImage={handleSelectImage}
          compact={compactToolbar}
        />
        <div className="min-h-[140px] max-h-[460px] overflow-y-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      <MathDialog
        isOpen={mathOpen}
        onClose={() => setMathOpen(false)}
        onInsert={handleInsertMath}
      />

      <TableDialog
        isOpen={tableOpen}
        onClose={() => setTableOpen(false)}
        editor={editor}
      />
    </div>
  );
}
