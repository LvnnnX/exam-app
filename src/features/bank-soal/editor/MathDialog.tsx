'use client';

import React, { useState, useMemo } from 'react';
import katex from 'katex';
import { X, Check } from 'lucide-react';

type MathDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string, isBlock: boolean) => void;
};

const SYMBOLS = [
  { label: 'Pecahan', latex: '\\frac{a}{b}' },
  { label: 'Akar', latex: '\\sqrt{x}' },
  { label: 'Akar n', latex: '\\sqrt[n]{x}' },
  { label: 'Pangkat', latex: 'x^{2}' },
  { label: 'Subskrip', latex: 'x_{i}' },
  { label: 'Perkalian', latex: '\\times' },
  { label: 'Pembagian', latex: '\\div' },
  { label: 'Plus-minus', latex: '\\pm' },
  { label: 'Kurang-lebih', latex: '\\approx' },
  { label: 'Tak hingga', latex: '\\infty' },
  { label: 'Jumlah (sigma)', latex: '\\sum_{i=1}^{n}' },
  { label: 'Integral', latex: '\\int_{a}^{b} f(x) dx' },
  { label: 'Limit', latex: '\\lim_{x \\to \\infty}' },
  { label: 'Alfa', latex: '\\alpha' },
  { label: 'Beta', latex: '\\beta' },
  { label: 'Theta', latex: '\\theta' },
  { label: 'Pi', latex: '\\pi' },
  { label: 'Delta', latex: '\\Delta' },
];

export default function MathDialog({ isOpen, onClose, onInsert }: MathDialogProps) {
  const [latex, setLatex] = useState('');
  const [isBlock, setIsBlock] = useState(false);

  const previewHtml = useMemo(() => {
    if (!latex.trim()) return '<span class="text-fg-subtle italic">Pratinjau rumus akan muncul di sini...</span>';
    try {
      return katex.renderToString(latex, { displayMode: isBlock, throwOnError: false });
    } catch {
      return '<span class="text-danger italic">Sintaks LaTeX tidak valid</span>';
    }
  }, [latex, isBlock]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!latex.trim()) return;
    onInsert(latex.trim(), isBlock);
    setLatex('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-glass-scrim backdrop-blur-xs">
      <div className="w-full max-w-lg p-5 rounded-2xl glass-sheet shadow-2xl border border-line-strong flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="font-semibold text-fg">Sisipkan Rumus Matematika (KaTeX)</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-well text-fg-subtle">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-fg-muted mb-1 block">Simbol Cepat:</label>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-xl well border border-line">
            {SYMBOLS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setLatex((prev) => (prev ? `${prev} ${s.latex}` : s.latex))}
                className="px-2 py-1 text-xs rounded-lg bg-glass hover:bg-white text-fg font-mono border border-line"
                title={s.latex}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-fg-muted mb-1 block">Kode LaTeX:</label>
          <textarea
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            placeholder="Contoh: \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
            rows={3}
            className="w-full p-2.5 rounded-xl well border border-line text-sm font-mono focus:outline-none focus:border-primary text-fg"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-fg cursor-pointer">
            <input
              type="checkbox"
              checked={isBlock}
              onChange={(e) => setIsBlock(e.target.checked)}
              className="rounded accent-primary"
            />
            Tampilkan sebagai Blok Sendiri (Tengah)
          </label>
        </div>

        <div className="p-3 rounded-xl well border border-line min-h-[60px] flex items-center justify-center overflow-x-auto">
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-well text-fg-muted"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!latex.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium clay-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            <Check size={16} /> Sisipkan
          </button>
        </div>
      </div>
    </div>
  );
}
