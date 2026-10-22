'use client';

import React, { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Superscript as SuperIcon, Subscript as SubIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent,
  Table as TableIcon, Sigma, Image as ImageIcon,
  RemoveFormatting, Code, Heading1, Heading2, Heading3,
} from 'lucide-react';
import {
  FONT_FAMILIES, FONT_SIZES, LINE_HEIGHTS,
  TEXT_COLORS, HIGHLIGHT_COLORS,
} from './types';

type ToolbarProps = {
  editor: Editor | null;
  onOpenMath: () => void;
  onOpenTable: () => void;
  onSelectImage: (file: File) => void;
  compact?: boolean;
};

export default function Toolbar({
  editor,
  onOpenMath,
  onOpenTable,
  onSelectImage,
  compact = false,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `p-1.5 rounded-lg text-sm transition-colors border ${
      active
        ? 'bg-primary text-white border-primary shadow-xs'
        : 'text-fg-muted hover:text-fg hover:bg-well border-transparent'
    }`;

  const handleClearFormat = () => {
    editor.chain().focus().clearNodes().unsetAllMarks().unsetFontFamily().unsetLineHeight().run();
    // remove text style attributes if any remain
    editor.commands.resetAttributes('textStyle', ['fontSize', 'color', 'backgroundColor', 'lineHeight', 'fontFamily']);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-1.5 border-b border-line bg-glass/60 text-xs">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onSelectImage(file);
            e.target.value = '';
          }
        }}
      />

      {/* Font Family */}
      {!compact && (
        <select
          onChange={(e) => {
            if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
          className="p-1 px-1.5 rounded-lg well border border-line text-xs text-fg focus:outline-none"
          title="Jenis Font"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>
      )}

      {/* Font Size */}
      {!compact && (
        <select
          onChange={(e) => {
            const sz = e.target.value;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const chain = editor.chain().focus() as any;
            if (sz && chain.setFontSize) chain.setFontSize(sz).run();
            else if (chain.unsetFontSize) chain.unsetFontSize().run();
          }}
          className="p-1 px-1.5 rounded-lg well border border-line text-xs text-fg focus:outline-none"
          title="Ukuran Font"
        >
          <option value="">Ukuran</option>
          {FONT_SIZES.map((s) => (
            <option key={s.label} value={s.value}>{s.label}</option>
          ))}
        </select>
      )}

      {/* Headings */}
      {!compact && (
        <div className="flex items-center gap-0.5 border-r border-line pr-1 mr-0.5">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={btnClass(editor.isActive('heading', { level: 1 }))}
            title="Heading 1"
          >
            <Heading1 size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={btnClass(editor.isActive('heading', { level: 2 }))}
            title="Heading 2"
          >
            <Heading2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={btnClass(editor.isActive('heading', { level: 3 }))}
            title="Heading 3"
          >
            <Heading3 size={15} />
          </button>
        </div>
      )}

      {/* Basic text formatting */}
      <div className="flex items-center gap-0.5 border-r border-line pr-1 mr-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive('bold'))}
          title="Tebal (Ctrl+B)"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive('italic'))}
          title="Miring (Ctrl+I)"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btnClass(editor.isActive('underline'))}
          title="Garis Bawah (Ctrl+U)"
        >
          <UnderlineIcon size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={btnClass(editor.isActive('strike'))}
          title="Coret"
        >
          <Strikethrough size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          className={btnClass(editor.isActive('superscript'))}
          title="Superskrip"
        >
          <SuperIcon size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          className={btnClass(editor.isActive('subscript'))}
          title="Subskrip"
        >
          <SubIcon size={15} />
        </button>
      </div>

      {/* Colors & Highlight */}
      {!compact && (
        <div className="flex items-center gap-1 border-r border-line pr-1 mr-0.5">
          <select
            onChange={(e) => {
              const c = e.target.value;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const chain = editor.chain().focus() as any;
              if (c && chain.setColor) chain.setColor(c).run();
              else if (chain.unsetColor) chain.unsetColor().run();
            }}
            className="p-1 rounded-lg well border border-line text-xs text-fg focus:outline-none"
            title="Warna Teks"
          >
            <option value="">Warna Teks</option>
            {TEXT_COLORS.filter((tc) => tc.value).map((c) => (
              <option key={c.label} value={c.value}>{c.label}</option>
            ))}
          </select>

          <select
            onChange={(e) => {
              const h = e.target.value;
              if (h) editor.chain().focus().setHighlight({ color: h }).run();
              else editor.chain().focus().unsetHighlight().run();
            }}
            className="p-1 rounded-lg well border border-line text-xs text-fg focus:outline-none"
            title="Warna Stabilo"
          >
            <option value="">Stabilo</option>
            {HIGHLIGHT_COLORS.filter((hc) => hc.value).map((c) => (
              <option key={c.label} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Text Align */}
      <div className="flex items-center gap-0.5 border-r border-line pr-1 mr-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={btnClass(editor.isActive({ textAlign: 'left' }))}
          title="Rata Kiri"
        >
          <AlignLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={btnClass(editor.isActive({ textAlign: 'center' }))}
          title="Rata Tengah"
        >
          <AlignCenter size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={btnClass(editor.isActive({ textAlign: 'right' }))}
          title="Rata Kanan"
        >
          <AlignRight size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={btnClass(editor.isActive({ textAlign: 'justify' }))}
          title="Rata Kiri Kanan"
        >
          <AlignJustify size={15} />
        </button>
      </div>

      {/* Line Height */}
      {!compact && (
        <select
          onChange={(e) => {
            const lh = e.target.value;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const chain = editor.chain().focus() as any;
            if (lh && chain.setLineHeight) chain.setLineHeight(lh).run();
            else if (chain.unsetLineHeight) chain.unsetLineHeight().run();
          }}
          className="p-1 rounded-lg well border border-line text-xs text-fg focus:outline-none mr-1"
          title="Spasi Baris"
        >
          <option value="">Spasi</option>
          {LINE_HEIGHTS.map((lh) => (
            <option key={lh.label} value={lh.value}>{lh.label}</option>
          ))}
        </select>
      )}

      {/* Lists & Indent */}
      <div className="flex items-center gap-0.5 border-r border-line pr-1 mr-0.5">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive('bulletList'))}
          title="Daftar Bullet"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive('orderedList'))}
          title="Daftar Nomor"
        >
          <ListOrdered size={15} />
        </button>
        {!compact && (
          <>
            <button
              type="button"
              onClick={() => editor.commands.command(({ tr }) => { tr.insertText('    '); return true; })}
              className={btnClass(false)}
              title="Indent (Tab)"
            >
              <Indent size={15} />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().liftListItem('listItem').run()}
              className={btnClass(false)}
              title="Outdent"
            >
              <Outdent size={15} />
            </button>
          </>
        )}
      </div>

      {/* Inserts: Math, Table, Image, Code Block */}
      <div className="flex items-center gap-0.5 border-r border-line pr-1 mr-0.5">
        <button
          type="button"
          onClick={onOpenMath}
          className={btnClass(false)}
          title="Rumus Matematika (KaTeX)"
        >
          <Sigma size={15} className="text-primary font-bold" />
        </button>
        {!compact && (
          <button
            type="button"
            onClick={onOpenTable}
            className={btnClass(editor.isActive('table'))}
            title="Tabel"
          >
            <TableIcon size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={btnClass(false)}
          title="Upload Gambar (Maks 2MB)"
        >
          <ImageIcon size={15} />
        </button>
        {!compact && (
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={btnClass(editor.isActive('codeBlock'))}
            title="Blok Kode Program"
          >
            <Code size={15} />
          </button>
        )}
      </div>

      {/* Clear Formatting */}
      <button
        type="button"
        onClick={handleClearFormat}
        className={btnClass(false)}
        title="Hapus Semua Format"
      >
        <RemoveFormatting size={15} className="text-danger" />
      </button>
    </div>
  );
}
