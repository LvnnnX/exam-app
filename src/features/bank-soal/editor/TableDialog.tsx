'use client';

import React, { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { X, Check } from 'lucide-react';

type TableDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
};

export default function TableDialog({ isOpen, onClose, editor }: TableDialogProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [withHeader, setWithHeader] = useState(true);

  if (!isOpen || !editor) return null;

  const isTableActive = editor.isActive('table');

  const handleInsert = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: Math.max(1, rows), cols: Math.max(1, cols), withHeaderRow: withHeader })
      .run();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-glass-scrim backdrop-blur-xs">
      <div className="w-full max-w-sm p-5 rounded-2xl glass-sheet shadow-2xl border border-line-strong flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="font-semibold text-fg">
            {isTableActive ? 'Kelola Tabel Aktif' : 'Sisipkan Tabel Baru'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-well text-fg-subtle">
            <X size={18} />
          </button>
        </div>

        {isTableActive ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-fg-muted mb-2">Pilih aksi untuk tabel yang sedang aktif:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => { editor.chain().focus().addRowBefore().run(); onClose(); }}
                className="p-2 rounded-lg well hover:bg-white text-fg border border-line"
              >
                + Baris Di Atas
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().addRowAfter().run(); onClose(); }}
                className="p-2 rounded-lg well hover:bg-white text-fg border border-line"
              >
                + Baris Di Bawah
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().addColumnBefore().run(); onClose(); }}
                className="p-2 rounded-lg well hover:bg-white text-fg border border-line"
              >
                + Kolom Di Kiri
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().addColumnAfter().run(); onClose(); }}
                className="p-2 rounded-lg well hover:bg-white text-fg border border-line"
              >
                + Kolom Di Kanan
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().deleteRow().run(); onClose(); }}
                className="p-2 rounded-lg well hover:bg-brick-50 text-danger border border-line"
              >
                Hapus Baris
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().deleteColumn().run(); onClose(); }}
                className="p-2 rounded-lg well hover:bg-brick-50 text-danger border border-line"
              >
                Hapus Kolom
              </button>
            </div>
            <button
              type="button"
              onClick={() => { editor.chain().focus().deleteTable().run(); onClose(); }}
              className="mt-2 p-2 rounded-lg clay-danger text-xs font-semibold"
            >
              Hapus Seluruh Tabel
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-fg-muted block mb-1">Jumlah Baris:</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rows}
                  onChange={(e) => setRows(Number(e.target.value))}
                  className="w-full p-2 rounded-xl well border border-line text-sm text-fg"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-fg-muted block mb-1">Jumlah Kolom:</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={cols}
                  onChange={(e) => setCols(Number(e.target.value))}
                  className="w-full p-2 rounded-xl well border border-line text-sm text-fg"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-fg cursor-pointer">
              <input
                type="checkbox"
                checked={withHeader}
                onChange={(e) => setWithHeader(e.target.checked)}
                className="rounded accent-primary"
              />
              Gunakan baris pertama sebagai Header
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-line mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-well text-fg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleInsert}
                className="px-4 py-2 rounded-xl text-sm font-medium clay-primary flex items-center gap-1.5"
              >
                <Check size={16} /> Buat Tabel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
