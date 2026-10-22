'use client';

import React from 'react';
import RichContent from '@/src/components/RichContent';
import type { UjianQuestion } from '../types';

interface QuestionCardProps {
  question: UjianQuestion;
  value: string | null;
  onChange: (v: string | null) => void;
  guards?: {
    onCopy: (e: React.ClipboardEvent) => void;
    onCut: (e: React.ClipboardEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
  };
}

export default function QuestionCard({ question, value, onChange, guards }: QuestionCardProps) {
  return (
    <article
      {...guards}
      className="glass flex select-none flex-col gap-6 rounded-3xl p-5 sm:p-7"
    >
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold text-fg-muted">
          {question.type === 'short_answer' ? 'Isian singkat' : 'Pilihan ganda'}
        </span>
        <RichContent html={question.body_html} className="text-[15px] leading-relaxed text-fg sm:text-[16px]" />
      </div>

      {question.type === 'short_answer' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="ujian-short-answer" className="text-[12px] font-medium text-fg-muted">
            Jawaban kamu
          </label>
          <input
            id="ujian-short-answer"
            data-testid="ujian-short-input"
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value.trim() ? e.target.value : null)}
            placeholder="Ketik jawaban di sini..."
            className="well h-12 rounded-xl px-4 text-[15px] font-medium text-fg placeholder:text-fg-subtle"
          />
        </div>
      ) : (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="sr-only">Pilihan jawaban</legend>
          {question.options.map((opt) => {
            const checked = value === opt.label;
            return (
              <label
                key={opt.label}
                data-testid={`ujian-option-${opt.label}`}
                className={`well well-hover transition-calm flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl p-3 sm:p-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
                  checked ? 'bg-primary text-on-primary shadow-xs' : 'text-fg'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${question.index}`}
                  value={opt.label}
                  checked={checked}
                  onChange={() => onChange(opt.label)}
                  className="sr-only"
                />
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${
                    checked ? 'bg-canvas text-fg' : 'clay text-fg'
                  }`}
                  aria-hidden="true"
                >
                  {opt.label}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <RichContent
                    html={opt.text}
                    className={`text-[14px] leading-relaxed sm:text-[15px] ${checked ? 'text-on-primary' : 'text-fg'}`}
                  />
                </div>
              </label>
            );
          })}
        </fieldset>
      )}
    </article>
  );
}
