'use client';

import React, { useState } from 'react';
import { startUjianAction } from '../actions';
import { SURVIVAL_LIVES } from '../logic';
import type { TopicLabels } from '../types';
import { saveLastSetup, saveToken, type LastSetup, type SessionToken } from '../client-storage';
import { BTN_PRIMARY, BTN_SECONDARY, ChipList, Spinner, topicsSummary } from './ui';

interface ConfirmStepProps {
  setup: LastSetup;
  labels: TopicLabels;
  onEdit: () => void;
  onStarted: (token: SessionToken) => void;
}

export default function ConfirmStep({ setup, labels, onEdit, onStarted }: ConfirmStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setLoading(true);
    const res = await startUjianAction({
      name: setup.name,
      mode: setup.mode,
      nav_mode: setup.nav_mode,
      topic_ids: setup.topic_ids,
      question_count: setup.question_count,
      time_limit_minutes: setup.time_limit_minutes,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    const token: SessionToken = { sessionId: res.data.session_id, secret: res.data.secret };
    saveToken(token);
    saveLastSetup(setup);
    onStarted(token);
  };

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Nama', value: <span className="font-semibold text-fg">{setup.name}</span> },
    {
      label: 'Mode',
      value: (
        <span className="font-semibold text-fg">
          {setup.mode === 'exam' ? 'Exam' : 'Survival'}
          {setup.mode === 'exam' && <span className="text-[12px] font-normal text-fg-muted"> ({setup.nav_mode})</span>}
        </span>
      ),
    },
    { label: 'Topik', value: <ChipList items={topicsSummary(labels)} max={3} /> },
    {
      label: 'Jumlah soal',
      value: (
        <span className="tabular-nums text-fg">
          {setup.mode === 'exam' ? `${setup.question_count} soal` : 'Semua soal tersedia'}
        </span>
      ),
    },
    {
      label: 'Batas waktu',
      value: (
        <span className="tabular-nums text-fg">
          {setup.time_limit_minutes === 0 ? 'Tanpa batas' : `${setup.time_limit_minutes} menit`}
        </span>
      ),
    },
  ];

  if (setup.mode === 'survival') {
    rows.push({
      label: 'Nyawa',
      value: <span className="font-semibold tabular-nums text-danger">{SURVIVAL_LIVES} nyawa</span>,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-[20px] font-semibold text-fg">Periksa kembali data ujian</h2>
        <p className="text-[13px] text-fg-muted">
          Pastikan nama dan topik sudah benar. Sesi pengerjaan akan dimulai begitu kamu menekan tombol Mulai ujian.
        </p>
      </div>

      <dl className="well flex flex-col divide-y divide-line rounded-2xl p-4">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-[14px]">
            <dt className="text-fg-muted">{r.label}</dt>
            <dd className="text-right">{r.value}</dd>
          </div>
        ))}
      </dl>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onEdit} disabled={loading} className={BTN_SECONDARY}>
          Ubah
        </button>
        <button
          type="button"
          data-testid="ujian-confirm-start"
          onClick={start}
          disabled={loading}
          className={BTN_PRIMARY}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" /> Memulai...
            </span>
          ) : (
            'Mulai ujian'
          )}
        </button>
      </div>
    </div>
  );
}
