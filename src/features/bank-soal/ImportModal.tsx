'use client';

import React, { useState } from 'react';
import { X, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { previewImportAction, executeImportAction } from './actions';
import type { ImportPreviewRow, ImportResult } from './types';

type ImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const resetState = React.useCallback(() => {
    setFile(null);
    setPreviewRows([]);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append('file', selected);
      const res = await previewImportAction(fd);
      if (!res.success || !res.rows) throw new Error(res.error || 'Gagal membaca file');
      setPreviewRows(res.rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setPreviewRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!previewRows.length) return;
    setLoading(true);
    setError(null);

    try {
      const res = await executeImportAction(previewRows);
      if (!res.success || !res.result) throw new Error(res.error || 'Gagal mengimpor');
      setResult(res.result);
      if (res.result.imported > 0) onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const validCount = previewRows.filter((r) => !r.error).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-glass-scrim backdrop-blur-xs">
      <div className="w-full max-w-3xl p-5 sm:p-6 rounded-3xl glass-sheet shadow-2xl border border-line-strong flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-primary" size={22} />
            <h2 className="text-lg font-bold text-fg">Impor Soal Massal (CSV / XLSX)</h2>
          </div>
          <button type="button" onClick={handleClose} aria-label="Tutup modal" className="p-1 rounded-xl hover:bg-well text-fg-subtle">
            <X size={20} />
          </button>
        </div>

        {/* Notice on default visibility */}
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>Aturan Visibilitas (BS-08 & HS-01):</strong> Semua soal hasil impor otomatis berstatus <strong>hidden</strong> agar guru dapat memeriksa dan memverifikasi isi soal sebelum disajikan ke siswa atau kuis.
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-brick-50 text-danger text-sm border border-brick-200">
            {error}
          </div>
        )}

        {result ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <CheckCircle2 size={48} className="text-primary" />
            <h3 className="text-base font-bold text-fg">Impor Selesai!</h3>
            <p className="text-xs text-fg-muted">
              Berhasil diimpor: <strong>{result.imported}</strong> soal (status: hidden).<br />
              Gagal / Dilewati: <strong>{result.failed}</strong> baris.
            </p>
            {result.errors.length > 0 && (
              <div className="w-full text-left max-h-40 overflow-y-auto p-3 rounded-xl well border border-line text-xs text-danger">
                {result.errors.map((e) => (
                  <div key={e.row}>Baris {e.row}: {e.error}</div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="mt-3 px-5 py-2.5 rounded-xl text-sm font-semibold clay-primary"
            >
              Tutup
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="border-2 border-dashed border-line-strong rounded-2xl p-6 text-center hover:bg-well/40 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                className="hidden"
                id="bulk-import-file"
              />
              <label htmlFor="bulk-import-file" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload size={32} className="text-primary" />
                <span className="text-sm font-semibold text-fg">
                  {file ? file.name : 'Pilih File CSV atau Excel (.xlsx)'}
                </span>
                <span className="text-xs text-fg-subtle">
                  Kolom yang didukung: tipe, mapel, bab, sub_bab, question_text, option_a..e, jawaban
                </span>
              </label>
            </div>

            {loading && <p className="text-xs text-center text-primary font-medium animate-pulse">Memproses file...</p>}

            {previewRows.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-fg-muted">
                  <span>Pratinjau Data ({validCount} valid dari {previewRows.length} baris):</span>
                </div>
                <div className="max-h-60 overflow-y-auto rounded-xl well border border-line text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-canvas/80 sticky top-0 border-b border-line">
                      <tr>
                        <th className="p-2">Baris</th>
                        <th className="p-2">Tipe</th>
                        <th className="p-2">Kategori</th>
                        <th className="p-2">Potongan Soal</th>
                        <th className="p-2">Kunci</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r) => (
                        <tr key={r.row_num} className={`border-b border-line/50 ${r.error ? 'bg-brick-500/10' : ''}`}>
                          <td className="p-2 font-mono">{r.row_num}</td>
                          <td className="p-2">{r.type === 'multiple_choice' ? 'PG' : 'Isian'}</td>
                          <td className="p-2">{r.subject_name} / {r.chapter_name}</td>
                          <td className="p-2 max-w-xs truncate">{r.body_html.replace(/<[^>]+>/g, '')}</td>
                          <td className="p-2 font-mono font-bold">{r.answer_key}</td>
                          <td className="p-2">
                            {r.error ? (
                              <span className="text-danger font-medium">{r.error}</span>
                            ) : (
                              <span className="text-primary font-medium">Siap</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-line mt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-well text-fg-muted"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecute}
                disabled={loading || validCount === 0}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold clay-primary disabled:opacity-50"
              >
                {loading ? 'Mengimpor...' : `Impor ${validCount} Soal (Default Hidden)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
