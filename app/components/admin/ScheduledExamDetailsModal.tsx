"use client";

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { ScheduledExamRow } from '@/app/actions/admin/scheduled-exam';

type ScheduledExamDetailsModalProps = {
  exam: ScheduledExamRow | null;
  formatCategorySelectionLabel: (value?: string | null) => string;
  onClose: () => void;
  theme?: 'light' | 'dark';
};

function splitCategoryValues(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function formatCategoryChip(value: string | string[] | null | undefined, formatCategorySelectionLabel: (value?: string | null) => string) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  const values = Array.isArray(value) ? value : splitCategoryValues(value);
  if (values.length === 0) return null;
  const label = formatCategorySelectionLabel(values[0]);
  return values.length > 1 ? `${label} +${values.length - 1}` : label;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Makassar',
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    draft: { icon: <Clock size={12} />, cls: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
    published: { icon: <CheckCircle2 size={12} />, cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
    closed: { icon: <XCircle size={12} />, cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  };
  const entry = map[status] || map.draft;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${entry.cls}`}>
      {entry.icon} {status}
    </span>
  );
}

export default function ScheduledExamDetailsModal({
  exam,
  formatCategorySelectionLabel,
  onClose,
  theme = 'dark',
}: ScheduledExamDetailsModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (exam) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [exam]);

  const isDark = theme === 'dark';

  return (
    <AnimatePresence>
      {exam && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]"
            onClick={onClose}
          >
            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`rounded-[24px] shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden ${isDark ? 'bg-dark-800 border border-dark-border-subtle' : 'bg-white border border-nike-grey-200'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b sm:gap-4 ${isDark ? 'border-dark-border-subtle' : 'border-nike-grey-200'}`}>
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <h2 className={`text-[15px] font-semibold tracking-tight truncate ${isDark ? 'text-dark-text-primary' : 'text-gray-900'}`}>
                    {exam.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={exam.status} />
                    {exam.access_code && (
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold ${isDark ? 'bg-accent-blue/15 text-accent-blue' : 'bg-blue-50 text-blue-700'}`}>
                        {exam.access_code}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-spring-fast active:scale-90 shrink-0 ${isDark ? 'bg-white/5 text-dark-text-secondary hover:bg-white/10' : 'bg-black/5 text-gray-500 hover:bg-black/10'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Body */}
              <div className={`flex-1 overflow-y-auto px-5 py-4 space-y-3 ${isDark ? 'bg-dark-800' : 'bg-white'}`}>
                {/* Category chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {exam.mapels && (() => {
                    const chip = formatCategoryChip(exam.mapels!, formatCategorySelectionLabel);
                    return chip ? (
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${isDark ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
                        {chip}
                      </span>
                    ) : null;
                  })()}
                  {exam.babs && (() => {
                    const chip = formatCategoryChip(exam.babs!, formatCategorySelectionLabel);
                    return chip ? (
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${isDark ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
                        {chip}
                      </span>
                    ) : null;
                  })()}
                  {exam.sub_babs && (() => {
                    const chip = formatCategoryChip(exam.sub_babs!, formatCategorySelectionLabel);
                    return chip ? (
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${isDark ? 'bg-white/5 text-dark-text-secondary' : 'bg-black/5 text-gray-600'}`}>
                        {chip}
                      </span>
                    ) : null;
                  })()}
                </div>

                {/* Detail grid */}
                <div className={`rounded-2xl border p-4 space-y-2.5 ${isDark ? 'border-dark-border-subtle bg-white/[0.02]' : 'border-nike-grey-200 bg-black/[0.02]'}`}>
                  <DetailRow label="Jumlah soal" value={`${exam.question_count} soal`} theme={theme} />
                  <DetailRow label="Batas waktu" value={`${exam.time_limit_minutes} menit`} theme={theme} />
                  <DetailRow
                    label="Mode percobaan"
                    value={exam.attempt_mode === 'retake' ? 'Retake' : 'Sekali'}
                    theme={theme}
                  />
                  <DetailRow
                    label="Mode navigasi"
                    value={exam.nav_mode === 'strict' ? 'Strict' : 'Standard'}
                    theme={theme}
                  />
                  <DetailRow label="Waktu Mulai" value={formatDateTime(exam.window_start)} theme={theme} />
                  <DetailRow label="Waktu Selesai" value={formatDateTime(exam.window_end)} theme={theme} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DetailRow({ label, value, theme }: { label: string; value: string; theme: 'light' | 'dark' }) {
  const isDark = theme === 'dark';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-[12px] ${isDark ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-[12px] font-semibold tabular-nums ${isDark ? 'text-dark-text-primary' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}
