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
    return <div className="p-4 border rounded-lg bg-gray-50 animate-pulse">Initializing editor...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className={`block text-sm font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-700'}`}>{label}</label>
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rich Text</span>
      </div>
      {description && (
        <p className="text-[11px] text-gray-400 mb-2">{description}</p>
      )}

      <div className={`tiptap-shell border ${theme === 'dark' ? 'border-dark-border-medium' : 'border-slate-300'} ${isCompact ? 'rounded-xl' : 'rounded-2xl'} ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'} overflow-hidden shadow-sm transition-all ${theme === 'dark' ? 'focus-within:border-accent-blue' : 'focus-within:border-nike-black'}`}>
        <div className={`tiptap-toolbar tiptap-toolbar-scroll border-b ${theme === 'dark' ? 'bg-dark-800/95 border-dark-border-medium' : 'bg-white/95 border-slate-300'} ${isCompact ? 'px-2 pt-1.5 pb-2' : 'px-3 pt-2 pb-2.5'} flex items-center gap-1 sticky top-0 z-10 overflow-x-auto overflow-y-hidden whitespace-nowrap backdrop-blur-md`}>
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

          <div className={`h-5 w-px mx-1 ${theme === 'dark' ? 'bg-dark-border-medium' : 'bg-slate-300'}`} />

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

          <div className={`h-5 w-px mx-1 ${theme === 'dark' ? 'bg-dark-border-medium' : 'bg-slate-300'}`} />

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

          <div className={`h-5 w-px mx-1 ${theme === 'dark' ? 'bg-dark-border-medium' : 'bg-slate-300'}`} />

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

          <div className={`h-5 w-px mx-1 ${theme === 'dark' ? 'bg-dark-border-medium' : 'bg-slate-300'}`} />

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

          <div className={`h-5 w-px mx-1 ${theme === 'dark' ? 'bg-dark-border-medium' : 'bg-slate-300'}`} />

          <div className="flex items-center gap-1">
            <select
              value={selectedLanguage}
              onChange={(event) => setSelectedLanguage(event.target.value)}
              className={`text-xs border rounded-lg px-2.5 ${isCompact ? 'h-[28px]' : 'h-[32px]'} ${theme === 'dark' ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary focus:border-accent-blue' : 'border-slate-300 bg-white focus:border-nike-black'} outline-none transition-colors`}
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
              className={`toolbar-btn ${isCompact ? 'compact' : ''} ${theme === 'dark' ? 'text-accent-red hover:bg-accent-red/10' : 'text-red-600 hover:bg-red-50'}`}
              title="Clear Formatting"
            >
              <span className="text-lg">×</span>
            </button>
          </div>
        </div>

        <EditorContent
          editor={editor}
          className={`tiptap-editor ${isCompact ? 'p-3' : 'p-4'} min-h-[200px] ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}
        />
      </div>

      {mathModalMode && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
          <div className={`w-full max-w-xl overflow-hidden rounded-[24px] border shadow-ios-xl ${theme === 'dark' ? 'border-dark-border-strong bg-dark-800 text-dark-text-primary' : 'border-slate-300 bg-white text-slate-900'}`}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-800/95' : 'border-slate-300 bg-white/95'}`}>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>LaTeX</p>
                <h3 className="text-base font-semibold">{mathModalMode === 'inline' ? 'Inline Math' : 'Block Math'}</h3>
              </div>
              <button type="button" onClick={closeMathModal} className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition-colors ${theme === 'dark' ? 'text-dark-text-secondary hover:bg-dark-700' : 'text-slate-500 hover:bg-slate-100'}`} title="Close">×</button>
            </div>

            <div className="space-y-4 p-5">
              {/* Tab Navigation */}
              <div className={`flex gap-1 rounded-xl border p-1 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700/50' : 'border-slate-300 bg-slate-100'}`}>
                {(['functions', 'operators', 'colors', 'sizes', 'matrices', 'reference'] as MathModalTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMathModalTab(tab)}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${mathModalTab === tab ? (theme === 'dark' ? 'bg-accent-blue text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm') : (theme === 'dark' ? 'text-dark-text-tertiary hover:text-dark-text-secondary' : 'text-slate-500 hover:text-slate-700')}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Quick Insert Buttons */}
              <div className={`rounded-2xl border p-3 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700/50' : 'border-slate-300 bg-slate-50'}`}>
                <div className={`mb-2 text-[10px] font-bold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>Quick Insert</div>

                {mathModalTab === 'functions' && (
                  <div className="grid grid-cols-3 gap-1.5 max-h-[150px] overflow-y-auto quick-insert-scroll">
                    {MATH_FUNCTIONS.map((fn) => {
                      const preview = katex.renderToString(fn.latex, { displayMode: false, throwOnError: false, strict: false });
                      return (
                        <button
                          key={fn.label}
                          type="button"
                          onClick={() => insertLatexSnippet(fn.latex)}
                          className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-dark-800 text-dark-text-primary hover:bg-dark-600' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                          title={fn.latex}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{fn.label}</span>
                          <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {mathModalTab === 'operators' && (
                  <div className="grid grid-cols-2 gap-1.5 max-h-[150px] overflow-y-auto quick-insert-scroll">
                    {MATH_OPERATORS.map((op) => {
                      const preview = katex.renderToString(op.latex, { displayMode: false, throwOnError: false, strict: false });
                      return (
                        <button
                          key={op.label}
                          type="button"
                          onClick={() => insertLatexSnippet(op.latex)}
                          className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-dark-800 text-dark-text-primary hover:bg-dark-600' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                          title={op.latex}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{op.label}</span>
                          <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {mathModalTab === 'colors' && (
                  <div className="grid grid-cols-3 gap-1.5 max-h-[150px] overflow-y-auto quick-insert-scroll">
                    {MATH_COLORS.map((color) => {
                      const preview = katex.renderToString(color.latex, { displayMode: false, throwOnError: false, strict: false });
                      return (
                        <button
                          key={color.label}
                          type="button"
                          onClick={() => insertLatexSnippet(color.latex)}
                          className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-dark-800 text-dark-text-primary hover:bg-dark-600' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                          title={color.latex}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{color.label}</span>
                          <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {mathModalTab === 'sizes' && (
                  <div className="grid grid-cols-3 gap-1.5 max-h-[150px] overflow-y-auto quick-insert-scroll">
                    {MATH_SIZES.map((size) => {
                      const preview = katex.renderToString(size.latex + 'text', { displayMode: false, throwOnError: false, strict: false });
                      return (
                        <button
                          key={size.label}
                          type="button"
                          onClick={() => insertLatexSnippet(size.latex)}
                          className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-dark-800 text-dark-text-primary hover:bg-dark-600' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                          title={size.latex}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{size.label}</span>
                          <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {mathModalTab === 'matrices' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-slate-600'}`}>Rows:</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={matrixRows}
                          onChange={(e) => setMatrixRows(parseInt(e.target.value) || 2)}
                          className={`w-16 rounded-lg border px-2 py-1 text-xs outline-none transition-colors ${theme === 'dark' ? 'border-dark-border bg-dark-800 text-dark-text-primary focus:border-accent-blue' : 'border-slate-200 bg-white text-slate-900 focus:border-slate-400'}`}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className={`text-xs font-medium ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-slate-600'}`}>Cols:</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={matrixCols}
                          onChange={(e) => setMatrixCols(parseInt(e.target.value) || 2)}
                          className={`w-16 rounded-lg border px-2 py-1 text-xs outline-none transition-colors ${theme === 'dark' ? 'border-dark-border bg-dark-800 text-dark-text-primary focus:border-accent-blue' : 'border-slate-200 bg-white text-slate-900 focus:border-slate-400'}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={generateMatrix}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${theme === 'dark' ? 'bg-accent-blue text-white hover:bg-accent-blue/90' : 'bg-slate-900 text-white hover:bg-slate-700'}`}
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                )}

                {mathModalTab === 'reference' && (
                  <div className="grid grid-cols-2 gap-1.5 max-h-[150px] overflow-y-auto quick-insert-scroll">
                    {MATH_REFERENCE.map((ref) => {
                      const preview = katex.renderToString(ref.latex, { displayMode: false, throwOnError: false, strict: false });
                      return (
                        <button
                          key={ref.label}
                          type="button"
                          onClick={() => insertLatexSnippet(ref.latex)}
                          className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-dark-800 text-dark-text-primary hover:bg-dark-600' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                          title={ref.latex}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{ref.label}</span>
                          <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* LaTeX Input */}
              <div>
                <label className={`mb-2 block text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-slate-600'}`}>Formula</label>
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
                  className={`min-h-[104px] w-full resize-y rounded-2xl border px-4 py-3 font-mono text-sm outline-none transition-colors quick-insert-scroll ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700 text-dark-text-primary focus:border-accent-blue placeholder:text-dark-text-tertiary' : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-slate-400 placeholder:text-slate-400'}`}
                  placeholder="\\frac{a}{b}"
                />
              </div>

              {/* Preview */}
              <div className={`rounded-2xl border p-4 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700/70' : 'border-slate-300 bg-slate-50'}`}>
                <div className={`mb-3 text-[10px] font-bold uppercase tracking-[0.18em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>Preview</div>
                <div className={`min-h-[64px] overflow-x-auto rounded-xl px-3 py-4 text-center quick-insert-scroll ${theme === 'dark' ? 'bg-dark-800 text-dark-text-primary' : 'bg-white text-slate-900'}`}>
                  {mathPreview ? (
                    <div dangerouslySetInnerHTML={{ __html: mathPreview }} />
                  ) : (
                    <span className={theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}>Preview will appear here.</span>
                  )}
                </div>
              </div>
            </div>

            <div className={`flex justify-end gap-2 border-t px-5 py-4 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-800/95' : 'border-slate-300 bg-white/95'}`}>
              <button type="button" onClick={closeMathModal} className={`h-10 rounded-full border px-5 text-xs font-semibold transition-colors ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700 text-dark-text-primary hover:bg-dark-600' : 'border-slate-400 bg-white text-slate-700 hover:bg-slate-50'}`}>Cancel</button>
              <button type="button" onClick={insertMathFromModal} disabled={!mathLatex.trim()} className={`h-10 rounded-full px-6 text-xs font-semibold text-white transition-colors disabled:opacity-50 ${theme === 'dark' ? 'bg-accent-blue hover:bg-accent-blue/90' : 'bg-slate-900 hover:bg-slate-700'}`}>Insert</button>
            </div>
          </div>
        </div>
      )}

      {tableModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
          <div className={`w-full max-w-md overflow-hidden rounded-[24px] border shadow-ios-xl ${theme === 'dark' ? 'border-dark-border-strong bg-dark-800 text-dark-text-primary' : 'border-slate-300 bg-white text-slate-900'}`}>
            <div className={`flex items-center justify-between border-b px-5 py-4 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-800/95' : 'border-slate-300 bg-white/95'}`}>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-slate-400'}`}>Table</p>
                <h3 className="text-base font-semibold">Insert Table</h3>
              </div>
              <button type="button" onClick={closeTableModal} className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition-colors ${theme === 'dark' ? 'text-dark-text-secondary hover:bg-dark-700' : 'text-slate-500 hover:bg-slate-100'}`} title="Close">×</button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wide mb-2 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-slate-700'}`}>Rows</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={tableRows}
                    onChange={(e) => setTableRows(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                    className={`w-full px-3 h-10 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700 text-dark-text-primary focus:ring-accent-blue/20 focus:border-accent-blue' : 'border-slate-300 bg-white text-slate-900 focus:ring-slate-900/10 focus:border-slate-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wide mb-2 ${theme === 'dark' ? 'text-dark-text-primary' : 'text-slate-700'}`}>Columns</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={tableCols}
                    onChange={(e) => setTableCols(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className={`w-full px-3 h-10 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700 text-dark-text-primary focus:ring-accent-blue/20 focus:border-accent-blue' : 'border-slate-300 bg-white text-slate-900 focus:ring-slate-900/10 focus:border-slate-900'}`}
                  />
                </div>
              </div>

              <label className={`flex items-center gap-3 cursor-pointer rounded-xl border p-4 transition-colors ${tableHasHeader ? (theme === 'dark' ? 'border-accent-blue/30 bg-accent-blue/10' : 'border-slate-300 bg-slate-50') : (theme === 'dark' ? 'border-dark-border-medium bg-dark-700/50' : 'border-slate-300 bg-white')}`}>
                <input
                  type="checkbox"
                  checked={tableHasHeader}
                  onChange={(e) => setTableHasHeader(e.target.checked)}
                  className="sr-only"
                />
                <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${tableHasHeader ? (theme === 'dark' ? 'bg-accent-blue' : 'bg-slate-900') : (theme === 'dark' ? 'bg-dark-600' : 'bg-slate-300')}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tableHasHeader ? 'translate-x-6' : 'translate-x-1'}`} />
                </span>
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-dark-text-primary' : 'text-slate-900'}`}>First row as header</span>
              </label>
            </div>

            <div className={`flex justify-end gap-2 border-t px-5 py-4 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-800/95' : 'border-slate-300 bg-white/95'}`}>
              <button type="button" onClick={closeTableModal} className={`h-10 rounded-full border px-5 text-xs font-semibold transition-colors ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700 text-dark-text-primary hover:bg-dark-600' : 'border-slate-400 bg-white text-slate-700 hover:bg-slate-50'}`}>Cancel</button>
              <button type="button" onClick={insertTableFromModal} className={`h-10 rounded-full px-6 text-xs font-semibold text-white transition-colors ${theme === 'dark' ? 'bg-accent-blue hover:bg-accent-blue/90' : 'bg-slate-900 hover:bg-slate-700'}`}>Insert Table</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}