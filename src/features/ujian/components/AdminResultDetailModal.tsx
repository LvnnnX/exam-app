'use client';

import React, { useCallback, useEffect, useState } from 'react';
import RichContent from '@/src/components/RichContent';
import { adminGetUjianDetailAction } from '../actions';
import type { AdminResultDetail, AdminResultRow } from '../types';
import Modal from './Modal';
import { BTN_SECONDARY, ErrorBlock, LoadingBlock } from './ui';

interface AdminResultDetailModalProps {
  row: AdminResultRow;
  onClose: () => void;
}

export default function AdminResultDetailModal({ row, onClose }: AdminResultDetailModalProps) {
  const [detail, setDetail] = useState<AdminResultDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await adminGetUjianDetailAction(row.id);
    if (res.success) {
      setDetail(res.data);
    } else {
      setError(res.error);
    }
  }, [row.id]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  return (
    <Modal
      title={`Detail jawaban: ${row.name}`}
      size="lg"
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={BTN_SECONDARY}>
          Tutup
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="well grid grid-cols-2 gap-3 rounded-2xl p-4 text-[13px] sm:grid-cols-4">
          <div>
            <dt className="text-fg-muted">Mode</dt>
            <dd className="font-semibold text-fg">
              {row.mode === 'exam' ? `Exam (${row.nav_mode})` : 'Survival'}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">Skor</dt>
            <dd className="font-semibold tabular-nums text-fg">
              {row.mode === 'exam' ? `${row.score}/${row.total} (${row.percent ?? 0}%)` : row.score}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">Status</dt>
            <dd className="font-semibold text-fg">
              {row.passed === null ? '-' : row.passed ? 'Lulus' : 'Tidak lulus'}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">Topik</dt>
            <dd className="truncate text-fg" title={row.topics_label}>
              {row.topics_label}
            </dd>
          </div>
        </dl>

        {error && <ErrorBlock title="Gagal memuat detail jawaban" detail={error} onRetry={load} />}
        {!detail && !error && <LoadingBlock label="Memuat jawaban siswa..." />}

        {detail && detail.items.length === 0 && (
          <p className="well rounded-2xl p-6 text-center text-[13px] text-fg-muted">
            Tidak ada item jawaban tersimpan untuk sesi ini.
          </p>
        )}

        {detail && detail.items.length > 0 && (
          <div className="flex flex-col gap-4">
            {detail.items.map((it) => {
              const isBlank = it.user_answer === null || it.user_answer === '';
              return (
                <article key={it.question_id} className="well flex flex-col gap-3 rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-fg">Soal #{it.index + 1}</span>
                    <div className="flex items-center gap-2 text-[12px] font-bold">
                      {it.doubtful && (
                        <span className="rounded-md bg-highlight/20 px-2 py-0.5 text-highlight-fg">Ragu-ragu</span>
                      )}
                      <span
                        className={`rounded-md px-2 py-0.5 ${
                          isBlank
                            ? 'well text-fg-muted'
                            : it.is_correct
                              ? 'bg-primary/15 text-primary'
                              : 'bg-danger/15 text-danger'
                        }`}
                      >
                        {isBlank ? 'Kosong' : it.is_correct ? 'Benar' : 'Salah'}
                      </span>
                    </div>
                  </div>

                  <RichContent html={it.body_html} className="text-[14px] leading-relaxed text-fg" />

                  {it.type === 'multiple_choice' && (
                    <div className="flex flex-col gap-1.5">
                      {it.options.map((opt) => {
                        const isUser = it.user_answer === opt.label;
                        const isKey = it.answer_key === opt.label;
                        return (
                          <div
                            key={opt.label}
                            className={`flex items-start gap-2 rounded-lg border p-2 text-[13px] ${
                              isKey
                                ? 'border-primary/40 bg-primary/10'
                                : isUser
                                  ? 'border-danger/40 bg-danger/10'
                                  : 'border-transparent'
                            }`}
                          >
                            <span className="font-bold text-fg">{opt.label}.</span>
                            <div className="min-w-0 flex-1">
                              <RichContent html={opt.text} className="text-fg" />
                            </div>
                            {isKey && <span className="text-[11px] font-bold text-primary">Kunci</span>}
                            {isUser && !isKey && <span className="text-[11px] font-bold text-danger">Siswa</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {it.type === 'short_answer' && (
                    <dl className="flex flex-col gap-1 text-[13px]">
                      <div>
                        <span className="text-fg-muted">Jawaban siswa: </span>
                        <span className="font-semibold text-fg">{it.user_answer ?? '(Kosong)'}</span>
                      </div>
                      <div>
                        <span className="text-fg-muted">Kunci: </span>
                        <span className="font-semibold text-primary">{it.answer_key}</span>
                      </div>
                    </dl>
                  )}

                  {it.explanation_html && (
                    <div className="border-t border-line pt-2">
                      <span className="text-[11px] font-bold text-fg-muted">Pembahasan:</span>
                      <RichContent html={it.explanation_html} className="mt-1 text-[13px] text-fg" />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
