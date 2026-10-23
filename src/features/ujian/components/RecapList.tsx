'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import RichContent from '@/src/components/RichContent';
import { getUjianRecapAction } from '../actions';
import type { RecapItem, UjianRecap } from '../types';
import { BTN_SECONDARY, ErrorBlock, LoadingBlock } from './ui';

interface RecapListProps {
  sessionId: string;
  secret: string;
  onBack: () => void;
}

function ItemCard({ item }: { item: RecapItem }) {
  const isCorrect = item.is_correct;
  const isBlank = item.user_answer === null || item.user_answer === '';

  const statusTone = isBlank
    ? 'well text-fg-muted'
    : isCorrect
      ? 'bg-primary/15 text-primary'
      : 'bg-danger/15 text-danger';

  const statusText = isBlank ? 'Kosong' : isCorrect ? 'Benar' : 'Salah';

  return (
    <article
      data-testid="ujian-recap-item"
      className="glass flex flex-col gap-4 rounded-3xl p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="clay inline-flex h-8 items-center rounded-lg px-2.5 text-[12px] font-bold tabular-nums text-fg">
          Soal {item.index + 1}
        </span>
        <div className="flex items-center gap-2">
          {item.doubtful && (
            <span className="inline-flex h-7 items-center gap-1 rounded-lg bg-highlight/20 px-2 text-[12px] font-semibold text-highlight-fg">
              <Flag size={13} /> Ragu-ragu
            </span>
          )}
          <span className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[12px] font-bold ${statusTone}`}>
            {statusText}
          </span>
        </div>
      </div>

      <RichContent html={item.body_html} className="text-[14px] leading-relaxed text-fg sm:text-[15px]" />

      {item.type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {item.options.map((opt) => {
            const isUser = item.user_answer === opt.label;
            const isKey = item.answer_key === opt.label;
            const tone = isKey
              ? 'border-primary/40 bg-primary/10'
              : isUser
                ? 'border-danger/40 bg-danger/10'
                : 'well';
            return (
              <div
                key={opt.label}
                className={`flex min-h-11 items-start gap-3 rounded-xl border p-2.5 text-[13px] ${tone}`}
              >
                <span className="clay inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-fg">
                  {opt.label}
                </span>
                <div className="min-w-0 flex-1">
                  <RichContent html={opt.text} className="text-fg" />
                </div>
                {isKey && <span className="shrink-0 text-[11px] font-bold text-primary">Kunci</span>}
                {isUser && !isKey && <span className="shrink-0 text-[11px] font-bold text-danger">Jawabanmu</span>}
              </div>
            );
          })}
        </div>
      )}

      {item.type === 'short_answer' && (
        <dl className="well flex flex-col gap-1.5 rounded-xl p-3 text-[13px]">
          <div className="flex justify-between gap-2">
            <dt className="text-fg-muted">Jawaban kamu:</dt>
            <dd className="font-semibold text-fg">{item.user_answer ?? '(Kosong)'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-fg-muted">Kunci jawaban:</dt>
            <dd className="font-semibold text-primary">{item.answer_key}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}

export default function RecapList({ sessionId, secret, onBack }: RecapListProps) {
  const [recap, setRecap] = useState<UjianRecap | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await getUjianRecapAction(sessionId, secret);
    if (res.success) {
      setRecap(res.data);
    } else {
      setError(res.error);
    }
  }, [sessionId, secret]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  if (error) {
    return <ErrorBlock title="Gagal memuat rekap jawaban" detail={error} onRetry={load} />;
  }
  if (!recap) return <LoadingBlock label="Memuat pembahasan soal..." />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold text-fg">Pembahasan soal</h2>
          <p className="text-[13px] text-fg-muted">{recap.items.length} soal diperiksa</p>
        </div>
        <button type="button" onClick={onBack} className={BTN_SECONDARY}>
          Kembali ke nilai
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {recap.items.map((it) => (
          <ItemCard key={it.question_id} item={it} />
        ))}
      </div>
    </div>
  );
}
