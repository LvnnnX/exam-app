"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Mathematics } from '@tiptap/extension-mathematics';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { common, createLowlight } from 'lowlight';
import katex from 'katex';
import { ensureHtmlDocument } from '@/lib/rich-text';
import { supabase } from '@/lib/supabase';

import 'katex/dist/katex.min.css';

type RichTextEditorFieldProps = {
  label: string;
  value: string;
  onChange: (html: string) => void;
  description?: string;
  density?: 'compact' | 'comfortable';
  theme?: 'light' | 'dark';
};

const lowlight = createLowlight(common);

const CodeBlockTabHandler = Extension.create({
  name: 'codeBlockTabHandler',

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive('codeBlock')) {
          return this.editor.commands.insertContent('  ');
        }
        return false;
      },
    };
  },
});

type MathModalMode = 'inline' | 'block';
type MathModalTab = 'functions' | 'operators' | 'colors' | 'sizes' | 'matrices' | 'reference';

const MATH_FUNCTIONS = [
  { label: 'ln', latex: '\\ln' },
  { label: 'log', latex: '\\log' },
  { label: 'exp', latex: '\\exp' },
  { label: 'sin', latex: '\\sin' },
  { label: 'cos', latex: '\\cos' },
  { label: 'tan', latex: '\\tan' },
  { label: 'sinh', latex: '\\sinh' },
  { label: 'cosh', latex: '\\cosh' },
  { label: 'tanh', latex: '\\tanh' },
  { label: 'arcsin', latex: '\\arcsin' },
  { label: 'arccos', latex: '\\arccos' },
  { label: 'arctan', latex: '\\arctan' },
];

const MATH_OPERATORS = [
  { label: 'lim', latex: '\\lim_{x \\to \\infty}' },
  { label: 'sum', latex: '\\sum_{i=1}^{n}' },
  { label: 'prod', latex: '\\prod_{i=1}^{n}' },
  { label: 'int', latex: '\\int_{a}^{b}' },
  { label: 'max', latex: '\\max' },
  { label: 'min', latex: '\\min' },
  { label: 'sup', latex: '\\sup' },
  { label: 'inf', latex: '\\inf' },
  { label: 'det', latex: '\\det' },
  { label: 'dim', latex: '\\dim' },
  { label: 'gcd', latex: '\\gcd' },
  { label: 'ker', latex: '\\ker' },
];

const MATH_COLORS = [
  { label: 'red', latex: '\\textcolor{red}{text}' },
  { label: 'blue', latex: '\\textcolor{blue}{text}' },
  { label: 'green', latex: '\\textcolor{green}{text}' },
  { label: 'yellow', latex: '\\textcolor{yellow}{text}' },
  { label: 'cyan', latex: '\\textcolor{cyan}{text}' },
  { label: 'magenta', latex: '\\textcolor{magenta}{text}' },
  { label: 'orange', latex: '\\textcolor{orange}{text}' },
  { label: 'purple', latex: '\\textcolor{purple}{text}' },
];

const MATH_SIZES = [
  { label: 'Huge', latex: '\\Huge ' },
  { label: 'huge', latex: '\\huge ' },
  { label: 'Large', latex: '\\Large ' },
  { label: 'large', latex: '\\large ' },
  { label: 'small', latex: '\\small ' },
  { label: 'tiny', latex: '\\tiny ' },
];

const MATH_REFERENCE = [
  { label: 'Fraction', latex: '\\frac{a}{b}' },
  { label: 'Square root', latex: '\\sqrt{x}' },
  { label: 'N-th root', latex: '\\sqrt[n]{x}' },
  { label: 'Power', latex: 'x^{n}' },
  { label: 'Subscript', latex: 'x_{i}' },
  { label: 'Parentheses', latex: '\\left( \\frac{a}{b} \\right)' },
  { label: 'Brackets', latex: '\\left[ \\frac{a}{b} \\right]' },
  { label: 'Braces', latex: '\\left\\{ \\frac{a}{b} \\right\\}' },
  { label: 'Greek α', latex: '\\alpha' },
  { label: 'Greek β', latex: '\\beta' },
  { label: 'Greek γ', latex: '\\gamma' },
  { label: 'Greek Δ', latex: '\\Delta' },
];

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
  theme = 'dark',
}: RichTextEditorFieldProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('plaintext');
  const [isUploading, setIsUploading] = useState(false);
  const [mathModalMode, setMathModalMode] = useState<MathModalMode | null>(null);
  const [mathModalTab, setMathModalTab] = useState<MathModalTab>('functions');
  const [mathLatex, setMathLatex] = useState('');
  const [matrixRows, setMatrixRows] = useState(2);
  const [matrixCols, setMatrixCols] = useState(2);
  const [, setToolbarVersion] = useState(0);
  const [editingMathPos, setEditingMathPos] = useState<number | null>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableHasHeader, setTableHasHeader] = useState(true);
  const mathTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const normalizedValue = useMemo(() => ensureHtmlDocument(value), [value]);
  const isCompact = density === 'compact';

  const uploadImageFile = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('exam-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('exam-images').getPublicUrl(filePath);
      return data?.publicUrl || null;
    } catch (err: unknown) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image. Please try again.');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

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
      TextAlign.configure({
        types: ['heading', 'paragraph', 'tableCell', 'tableHeader'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
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
            setEditingMathPos(pos);
            setMathModalMode('inline');
            setMathModalTab('functions');
            setMathLatex(node.attrs.latex || '');
          },
        },
        blockOptions: {
          onClick: (node, pos) => {
            setEditingMathPos(pos);
            setMathModalMode('block');
            setMathModalTab('functions');
            setMathLatex(node.attrs.latex || '');
          },
        },
      }),
      CodeBlockTabHandler,
    ],
    content: normalizedValue,
    editorProps: {
      attributes: {
        class: `tiptap-editor ${isCompact ? 'min-h-[120px] px-3 py-2 text-sm' : 'min-h-[160px] p-4'}`,
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            event.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
              uploadImageFile(file).then((url) => {
                if (url && editor) {
                  editor.chain().focus().setImage({ src: url, alt: file.name || 'pasted-image' }).run();
                }
              });
            }
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const file = files[0];
        if (file.type.startsWith('image/')) {
          event.preventDefault();
          uploadImageFile(file).then((url) => {
            if (url && editor) {
              editor.chain().focus().setImage({ src: url, alt: file.name }).run();
            }
          });
          return true;
        }
        return false;
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

  useEffect(() => {
    if (!editor) return;

    const refreshToolbar = () => setToolbarVersion((version) => version + 1);
    editor.on('selectionUpdate', refreshToolbar);
    editor.on('transaction', refreshToolbar);
    return () => {
      editor.off('selectionUpdate', refreshToolbar);
      editor.off('transaction', refreshToolbar);
    };
  }, [editor]);

  useEffect(() => {
    if (mathModalMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mathModalMode]);

  // Escape closes the math or table dialog; the question draft is left untouched.
  useEffect(() => {
    if (!mathModalMode && !tableModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMathModalMode(null);
      setMathLatex('');
      setEditingMathPos(null);
      setTableModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mathModalMode, tableModalOpen]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    const url = await uploadImageFile(file);
    if (url) {
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const openMathModal = (mode: MathModalMode) => {
    setEditingMathPos(null);
    setMathModalMode(mode);
    setMathModalTab('functions');
    setMathLatex(mode === 'inline' ? '\\frac{a}{b}' : '\\sum_{i=1}^{n} x_i');
  };

  const closeMathModal = () => {
    setMathModalMode(null);
    setMathLatex('');
    setEditingMathPos(null);
  };

  const insertLatexSnippet = (snippet: string) => {
    const textarea = mathTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = mathLatex.substring(0, start);
    const after = mathLatex.substring(end);
    const newLatex = before + snippet + after;

    setMathLatex(newLatex);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + snippet.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const generateMatrix = () => {
    const rows = Math.max(1, Math.min(10, matrixRows));
    const cols = Math.max(1, Math.min(10, matrixCols));
    const cells = Array(rows).fill(0).map(() => Array(cols).fill('a').join(' & ')).join(' \\\\ ');
    const matrixLatex = `\\begin{bmatrix} ${cells} \\end{bmatrix}`;
    insertLatexSnippet(matrixLatex);
  };

  const insertMathFromModal = () => {
    if (!editor || !mathModalMode || !mathLatex.trim()) return;
    const latex = mathLatex.trim();

    if (editingMathPos !== null) {
      // Update existing formula
      if (mathModalMode === 'inline') {
        editor.chain().setNodeSelection(editingMathPos).updateInlineMath({ latex }).focus().run();
      } else {
        editor.chain().setNodeSelection(editingMathPos).updateBlockMath({ latex }).focus().run();
      }
    } else {
      // Insert new formula
      if (mathModalMode === 'inline') {
        editor.chain().focus().insertInlineMath({ latex }).run();
      } else {
        editor.chain().focus().insertBlockMath({ latex }).run();
      }
    }

    closeMathModal();
  };

  const openTableModal = () => {
    setTableModalOpen(true);
    setTableRows(3);
    setTableCols(3);
    setTableHasHeader(true);
  };

  const closeTableModal = () => {
    setTableModalOpen(false);
  };

  const insertTableFromModal = () => {
    if (!editor) return;
    editor.chain().focus().insertTable({
      rows: tableRows,
      cols: tableCols,
      withHeaderRow: tableHasHeader
    }).run();
    closeTableModal();
  };

  const mathPreview = useMemo(() => {
    if (!mathModalMode || !mathLatex.trim()) return '';
    try {
      return katex.renderToString(mathLatex, {
        displayMode: mathModalMode === 'block',
        throwOnError: false,
        strict: false,
      });
    } catch {
      return '';
    }
  }, [mathLatex, mathModalMode]);

  if (!editor) {
    return <div className="well rounded-xl p-4 text-[13px] font-medium text-fg-muted" role="status">Initializing editor...</div>;
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="block text-[13px] font-semibold text-fg">{label}</label>
        <span className="text-[12px] font-medium text-fg-muted">Rich text</span>
      </div>
      {description && (
        <p className="mb-2 text-[12px] text-fg-muted">{description}</p>
      )}

      <div className={`tiptap-shell well overflow-hidden border border-line transition-calm focus-within:border-primary ${isCompact ? 'rounded-xl' : 'rounded-2xl'}`}>
        <div className={`tiptap-toolbar tiptap-toolbar-scroll sticky top-0 z-10 flex items-center gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-line bg-[var(--glass-solid)] ${isCompact ? 'px-2 pt-1.5 pb-2' : 'px-3 pt-2 pb-2.5'}`}>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('bold') ? 'is-active' : ''}`}
              title="Bold (Ctrl+B)"
            >
              <span className="font-bold">B</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('italic') ? 'is-active' : ''}`}
              title="Italic (Ctrl+I)"
            >
              <span className="italic">I</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('strike') ? 'is-active' : ''}`}
              title="Strikethrough"
            >
              <span className="line-through">S</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('code') ? 'is-active' : ''}`}
              title="Code"
            >
              <span className="font-mono text-xs">{`<>`}</span>
            </button>
          </div>

          <div className="mx-1 h-5 w-px bg-line-strong" aria-hidden="true" />

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}`}
              title="Align Left"
            >
              <span className="text-xs">⬅</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}`}
              title="Align Center"
            >
              <span className="text-xs">↔</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}`}
              title="Align Right"
            >
              <span className="text-xs">➡</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive({ textAlign: 'justify' }) ? 'is-active' : ''}`}
              title="Justify"
            >
              <span className="text-xs">⬌</span>
            </button>
          </div>

          <div className="mx-1 h-5 w-px bg-line-strong" aria-hidden="true" />

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('bulletList') ? 'is-active' : ''}`}
              title="Bullet List"
            >
              <span className="text-sm">•</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('orderedList') ? 'is-active' : ''}`}
              title="Numbered List"
            >
              <span className="text-xs font-semibold">1.</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('blockquote') ? 'is-active' : ''}`}
              title="Quote"
            >
              <span className="text-sm">❝</span>
            </button>
          </div>

          <div className="mx-1 h-5 w-px bg-line-strong" aria-hidden="true" />

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={insertImage}
              className={`toolbar-btn ${isCompact ? 'compact' : ''}`}
              disabled={isUploading}
              title="Image"
            >
              <span className="text-xs font-semibold">{isUploading ? '⋯' : 'Img'}</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            <button
              type="button"
              onClick={openTableModal}
              className={`toolbar-btn ${isCompact ? 'compact' : ''}`}
              title="Table"
            >
              <span className="text-xs font-semibold">Tbl</span>
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
                  className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs text-danger`}
                  title="Delete Column"
                >
                  -C
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs text-danger`}
                  title="Delete Row"
                >
                  -R
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className={`toolbar-btn ${isCompact ? 'compact' : ''} text-xs text-danger font-bold`}
                  title="Delete Table"
                >
                  Del
                </button>
              </>
            )}
          </div>

          <div className="mx-1 h-5 w-px bg-line-strong" aria-hidden="true" />

          {/* LaTeX / Math Buttons */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => openMathModal('inline')}
              className={`toolbar-btn ${isCompact ? 'compact' : ''}`}
              title="Inline Math"
            >
              <span className="text-xs font-semibold">Σ In</span>
            </button>
            <button
              type="button"
              onClick={() => openMathModal('block')}
              className={`toolbar-btn ${isCompact ? 'compact' : ''}`}
              title="Block Math"
            >
              <span className="text-xs font-semibold">Σ Blk</span>
            </button>
          </div>

          <div className="mx-1 h-5 w-px bg-line-strong" aria-hidden="true" />

          <div className="flex items-center gap-1">
            <select
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(event.target.value)}
              aria-label="Code language"
              className={`rounded-lg border border-line-strong bg-transparent px-2.5 text-xs text-fg transition-calm ${isCompact ? 'h-[28px]' : 'h-[32px]'}`}
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
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${editor.isActive('codeBlock') ? 'is-active' : ''}`}
              title="Code Block"
            >
              <span className="text-xs font-semibold">Code</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
              className={`toolbar-btn ${isCompact ? 'compact' : ''} text-danger`}
              title="Clear Formatting"
              aria-label="Clear formatting"
            >
              <span className="text-lg">×</span>
            </button>
          </div>
        </div>

        <EditorContent
          editor={editor}
          className={`tiptap-editor min-h-[200px] text-fg ${isCompact ? 'p-3' : 'p-4'}`}
        />
      </div>

      {mathModalMode && (
        <div data-theme={theme} className="glass-scrim fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={mathModalMode === 'inline' ? 'Inline math' : 'Block math'}>
          <div className="glass-sheet animate-in w-full max-w-sm overflow-hidden rounded-4xl text-fg sm:max-w-md">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h3 className="text-[17px] font-bold tracking-tight">{mathModalMode === 'inline' ? 'Inline math.' : 'Block math.'}</h3>
              <button
                type="button"
                onClick={closeMathModal}
                aria-label="Tutup"
                className="well well-hover flex h-11 w-11 items-center justify-center rounded-xl text-fg transition-calm"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="quick-insert-scroll well flex gap-1 overflow-x-auto rounded-xl p-1">
                {(['functions', 'operators', 'colors', 'sizes', 'matrices', 'reference'] as MathModalTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={mathModalTab === tab}
                    onClick={() => setMathModalTab(tab)}
                    className={`h-11 md:h-9 shrink-0 rounded-lg px-3 text-[12px] font-semibold capitalize transition-calm ${
                      mathModalTab === tab ? 'clay' : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="well rounded-2xl p-2">
                {mathModalTab === 'functions' && (
                  <div className="grid grid-cols-3 gap-1.5 max-h-[140px] overflow-y-auto quick-insert-scroll">
                    {MATH_FUNCTIONS.map((fn) => {
                      const preview = katex.renderToString(fn.latex, { displayMode: false, throwOnError: false, strict: false });
                      return (
                        <button
                          key={fn.label}
                          type="button"
                          onClick={() => insertLatexSnippet(fn.latex)}
                          className="flex min-h-11 flex-col items-center gap-0.5 rounded-xl border border-line px-1.5 py-2 transition-calm hover:border-line-strong hover:bg-[var(--well-bg-hover)]"
                          title={fn.latex}
                        >
                          <span className="text-[11px] font-semibold text-fg-muted">{fn.label}</span>
                          <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {mathModalTab === 'operators' && (
                  <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto quick-insert-scroll">
                    {MATH_OPERATORS.map((op) => {
                      const preview = katex.renderToString(op.latex, { displayMode: false, throwOnError: false, strict: false });
                      return (
                        <button
                          key={op.label}
                          type="button"
                          onClick={() => insertLatexSnippet(op.latex)}
                          className="flex min-h-11 flex-col items-center gap-0.5 rounded-xl border border-line px-1.5 py-2 transition-calm hover:border-line-strong hover:bg-[var(--well-bg-hover)]"
                          title={op.latex}
                        >
                          <span className="text-[11px] font-semibold text-fg-muted">{op.label}</span>
                          <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {mathModalTab === 'colors' && (
                  <div className="grid grid-cols-3 gap-1.5 max-h-[140px] overflow-y-auto quick-insert-scroll">
                    {MATH_COLORS.map((color) => {
                      const preview = katex.renderToString(color.latex, { displayMode: false, throwOnError: false, strict: false });
                      return (
                        <button
                          key={color.label}
                          type="button"
                          onClick={() => insertLatexSnippet(color.latex)}
                          className="flex min-h-11 flex-col items-center gap-0.5 rounded-xl border border-line px-1.5 py-2 transition-calm hover:border-line-strong hover:bg-[var(--well-bg-hover)]"
                          title={color.latex}
                        >
                          <span className="text-[11px] font-semibold text-fg-muted">{color.label}</span>
                          <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {mathModalTab === 'sizes' && (
                  <div className="grid grid-cols-3 gap-1.5 max-h-[140px] overflow-y-auto quick-insert-scroll">
                    {MATH_SIZES.map((size) => {
                      const preview = katex.renderToString(size.latex + 'text', { displayMode: false, throwOnError: false, strict: false });
                      return (
                        <button
                          key={size.label}
                          type="button"
                          onClick={() => insertLatexSnippet(size.latex)}
                          className="flex min-h-11 flex-col items-center gap-0.5 rounded-xl border border-line px-1.5 py-2 transition-calm hover:border-line-strong hover:bg-[var(--well-bg-hover)]"
                          title={size.latex}
                        >
                          <span className="text-[11px] font-semibold text-fg-muted">{size.label}</span>
                          <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {mathModalTab === 'matrices' && (
                  <div className="flex flex-wrap items-center gap-2 px-1 py-1">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[12px] font-medium text-fg-muted">Baris</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={matrixRows}
                        onChange={(e) => setMatrixRows(parseInt(e.target.value) || 2)}
                        className="h-11 w-14 rounded-lg border border-line-strong bg-transparent px-2 text-[13px] text-fg transition-calm md:h-9"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[12px] font-medium text-fg-muted">Kolom</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={matrixCols}
                        onChange={(e) => setMatrixCols(parseInt(e.target.value) || 2)}
                        className="h-11 md:h-9 w-14 rounded-lg border border-line-strong bg-transparent px-2 text-[13px] text-fg transition-calm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={generateMatrix}
                      className="ml-auto h-11 md:h-9 rounded-lg bg-primary/12 px-3 text-[12px] font-semibold text-primary transition-calm hover:bg-primary/18"
                    >
                      Buat
                    </button>
                  </div>
                )}

                {mathModalTab === 'reference' && (
                  <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto quick-insert-scroll">
                    {MATH_REFERENCE.map((ref) => {
                      const preview = katex.renderToString(ref.latex, { displayMode: false, throwOnError: false, strict: false });
                      return (
                        <button
                          key={ref.label}
                          type="button"
                          onClick={() => insertLatexSnippet(ref.latex)}
                          className="flex min-h-11 flex-col items-center gap-0.5 rounded-xl border border-line px-1.5 py-2 transition-calm hover:border-line-strong hover:bg-[var(--well-bg-hover)]"
                          title={ref.latex}
                        >
                          <span className="text-[11px] font-semibold text-fg-muted">{ref.label}</span>
                          <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <textarea
                ref={mathTextareaRef}
                value={mathLatex}
                onChange={(event) => setMathLatex(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault();
                    insertMathFromModal();
                  }
                }}
                aria-label="LaTeX"
                className="quick-insert-scroll well min-h-[72px] w-full resize-none rounded-xl px-4 py-3 font-mono text-sm text-fg placeholder:text-fg-subtle transition-calm"
                placeholder="\\frac{a}{b}"
              />

              <div className="quick-insert-scroll well flex min-h-[56px] items-center justify-center overflow-x-auto rounded-xl px-3 py-3" aria-live="polite">
                {mathPreview ? (
                  <div dangerouslySetInnerHTML={{ __html: mathPreview }} />
                ) : (
                  <span className="text-[12px] text-fg-muted">Preview muncul di sini.</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeMathModal}
                  className="well well-hover h-11 rounded-xl text-[14px] font-medium text-fg transition-calm"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={insertMathFromModal}
                  disabled={!mathLatex.trim()}
                  className="clay-primary h-11 rounded-xl text-[14px] font-semibold"
                >
                  Sisipkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tableModalOpen && (
        <div data-theme={theme} className="glass-scrim fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="insert-table-title">
          <div className="glass-sheet animate-in w-full max-w-md overflow-hidden rounded-4xl text-fg">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <p className="text-[12px] font-medium text-fg-muted">Table</p>
                <h3 id="insert-table-title" className="text-[17px] font-bold tracking-tight">Insert table</h3>
              </div>
              <button type="button" onClick={closeTableModal} className="well well-hover flex h-11 w-11 items-center justify-center rounded-xl text-lg text-fg transition-calm" aria-label="Close">×</button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="insert-table-rows" className="mb-2 block text-[13px] font-semibold text-fg">Rows</label>
                  <input
                    id="insert-table-rows"
                    type="number"
                    min="1"
                    max="20"
                    value={tableRows}
                    onChange={(e) => setTableRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                    className="well h-11 w-full rounded-xl px-3 text-[14px] font-medium text-fg transition-calm"
                  />
                </div>
                <div>
                  <label htmlFor="insert-table-cols" className="mb-2 block text-[13px] font-semibold text-fg">Columns</label>
                  <input
                    id="insert-table-cols"
                    type="number"
                    min="1"
                    max="10"
                    value={tableCols}
                    onChange={(e) => setTableCols(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="well h-11 w-full rounded-xl px-3 text-[14px] font-medium text-fg transition-calm"
                  />
                </div>
              </div>

              <label className={`flex cursor-pointer items-center gap-3 rounded-xl p-4 transition-calm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)] ${tableHasHeader ? 'bg-primary/10' : 'well'}`}>
                <input
                  type="checkbox"
                  checked={tableHasHeader}
                  onChange={(e) => setTableHasHeader(e.target.checked)}
                  className="sr-only"
                />
                <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-calm ${tableHasHeader ? 'bg-primary' : 'bg-line-strong'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${tableHasHeader ? 'translate-x-6' : 'translate-x-1'}`} />
                </span>
                <span className="text-[14px] font-semibold text-fg">First row as header</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
              <button type="button" onClick={closeTableModal} className="well well-hover h-11 rounded-xl px-5 text-[14px] font-medium text-fg transition-calm">Cancel</button>
              <button type="button" onClick={insertTableFromModal} className="clay-primary h-11 rounded-xl px-6 text-[14px] font-semibold">Insert table</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}