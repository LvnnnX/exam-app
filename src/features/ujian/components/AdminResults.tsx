'use client';

import React, { useEffect, useState } from 'react';
import { Eye, FileSpreadsheet, Search } from 'lucide-react';
import { adminListUjianResultsAction } from '../actions';
import type { AdminResultFilter, AdminResultRow } from '../types';
import AdminResultDetailModal from './AdminResultDetailModal';
import { ErrorBlock, LoadingBlock } from './ui';

interface AdminResultsProps {
  initialRows?: AdminResultRow[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function defaultDates(): { from: string; to: string } {
  const now = new Date();
  const past = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const toYmd = (d: Date) => d.toISOString().slice(0, 10);
  return { from: toYmd(past), to: toYmd(now) };
}

export default function AdminResults({ initialRows }: AdminResultsProps) {
  const [dates, setDates] = useState(defaultDates);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rows, setRows] = useState<AdminResultRow[] | null>(initialRows ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<AdminResultRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = async (filter: AdminResultFilter) => {
    setLoading(true);
    setError(null);
    const res = await adminListUjianResultsAction(filter);
    setLoading(false);
    if (res.success) {
      setRows(res.data);
    } else {
      setError(res.error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch tiap kali filter tanggal/pencarian berubah
    void load({ from: dates.from, to: dates.to, search: debouncedSearch || undefined });
  }, [dates.from, dates.to, debouncedSearch]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="clay-primary inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white">
            <FileSpreadsheet size={20} />
          </span>
          <div>
            <h1 className="text-[20px] font-bold text-fg">Hasil Ujian Mandiri</h1>
            <p className="text-[13px] text-fg-muted">
              Rekap seluruh sesi Exam dan Survival siswa beserta detail jawaban tiap nomor.
            </p>
          </div>
        </div>
        <span className="well rounded-full px-3 py-1 text-[12px] font-semibold tabular-nums text-fg-muted">
          {rows ? `${rows.length} hasil` : '...'}
        </span>
      </div>

      {/* Filter bar */}
      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-3 text-fg-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama siswa..."
            aria-label="Cari nama siswa"
            className="well h-10 w-full rounded-xl pl-9 pr-3 text-[13px] text-fg placeholder:text-fg-subtle"
          />
        </div>

        <div className="flex items-center gap-2 text-[13px]">
          <label htmlFor="filter-from" className="text-fg-muted">
            Dari
          </label>
          <input
            id="filter-from"
            type="date"
            value={dates.from}
            onChange={(e) => setDates((p) => ({ ...p, from: e.target.value }))}
            className="well h-10 rounded-xl px-2.5 text-[13px] text-fg"
          />
          <label htmlFor="filter-to" className="text-fg-muted">
            Sampai
          </label>
          <input
            id="filter-to"
            type="date"
            value={dates.to}
            onChange={(e) => setDates((p) => ({ ...p, to: e.target.value }))}
            className="well h-10 rounded-xl px-2.5 text-[13px] text-fg"
          />
        </div>
      </div>

      {loading && <LoadingBlock label="Memuat hasil ujian..." />}
      {error && !loading && (
        <ErrorBlock
          title="Gagal memuat rekap hasil"
          detail={error}
          onRetry={() => load({ from: dates.from, to: dates.to, search: debouncedSearch || undefined })}
        />
      )}

      {rows && !loading && rows.length === 0 && (
        <div className="glass rounded-3xl p-12 text-center text-[14px] text-fg-muted">
          Tidak ada hasil ujian pada rentang tanggal dan pencarian ini.
        </div>
      )}

      {rows && !loading && rows.length > 0 && (
        <div className="glass overflow-hidden rounded-3xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-line text-[11px] font-semibold text-fg-muted">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Topik</th>
                  <th className="px-4 py-3">Skor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} data-testid="admin-hasil-row" className="hover:bg-well transition-calm">
                    <td className="px-4 py-3 font-semibold text-fg">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-fg">
                        {r.mode === 'exam' ? `Exam (${r.nav_mode})` : 'Survival'}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-fg-muted" title={r.topics_label}>
                      {r.topics_label}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-fg">
                      {r.mode === 'exam' ? `${r.score}/${r.total} (${r.percent ?? 0}%)` : r.score}
                    </td>
                    <td className="px-4 py-3">
                      {r.passed === null ? (
                        <span className="text-fg-muted">-</span>
                      ) : (
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            r.passed ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger'
                          }`}
                        >
                          {r.passed ? 'Lulus' : 'Tidak lulus'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-fg-muted">{formatDate(r.started_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        data-testid="admin-hasil-peek"
                        disabled={!r.has_answers}
                        title={!r.has_answers ? 'Detail jawaban tidak tersedia untuk data lama' : 'Intip jawaban siswa'}
                        onClick={() => setSelectedRow(r)}
                        className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-primary/12 px-3 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/18 disabled:cursor-not-allowed disabled:bg-well disabled:text-fg-subtle md:h-10"
                      >
                        <Eye size={14} />
                        <span>Intip jawaban</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedRow && (
        <AdminResultDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </div>
  );
}
