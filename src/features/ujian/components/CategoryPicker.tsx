'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { CategorySubject } from '../types';

export interface CategorySelection {
  subjectIds: string[];
  chapterIds: string[];
  topicIds: string[];
}

interface CategoryPickerProps extends CategorySelection {
  subjects: CategorySubject[];
  onChange: (next: CategorySelection) => void;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** Buang bab/sub-bab yang induknya tidak lagi dipilih. */
export function pruneSelection(subjects: CategorySubject[], sel: CategorySelection): CategorySelection {
  const subjectIds = sel.subjectIds.filter((id) => subjects.some((s) => s.id === id));
  const chapters = subjects.filter((s) => subjectIds.includes(s.id)).flatMap((s) => s.chapters);
  const chapterIds = sel.chapterIds.filter((id) => chapters.some((c) => c.id === id));
  const topicOk = new Set(chapters.filter((c) => chapterIds.includes(c.id)).flatMap((c) => c.topics.map((t) => t.id)));
  return { subjectIds, chapterIds, topicIds: sel.topicIds.filter((id) => topicOk.has(id)) };
}

function CheckRow({ label, checked, onChange, meta }: { label: string; checked: boolean; onChange: () => void; meta?: string }) {
  return (
    <label className="well well-hover transition-calm flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 accent-[var(--primary)]" />
      <span className="min-w-0 flex-1 text-[14px] font-medium text-fg">{label}</span>
      {meta && <span className="shrink-0 text-[12px] tabular-nums text-fg-muted">{meta}</span>}
    </label>
  );
}

function Group(props: { title: string; count: number; disabled: boolean; hint: string; children: React.ReactNode }) {
  const { title, count, disabled, hint, children } = props;
  if (disabled) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-fg-muted">{title}</span>
        <p className="well rounded-xl px-4 py-3 text-[13px] text-fg-muted">{hint}</p>
      </div>
    );
  }
  return (
    <details className="group" open>
      <summary className="well well-hover transition-calm flex h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 text-[14px] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 truncate">
          <span className="text-fg-muted">{title}: </span>
          <span className="font-semibold text-fg">{count ? `${count} dipilih` : 'Belum dipilih'}</span>
        </span>
        <ChevronDown size={16} className="transition-calm shrink-0 text-fg-muted group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-2 flex max-h-80 flex-col gap-2 overflow-y-auto">{children}</div>
    </details>
  );
}

export default function CategoryPicker({ subjects, subjectIds, chapterIds, topicIds, onChange }: CategoryPickerProps) {
  const sel = { subjectIds, chapterIds, topicIds };
  const set = (next: CategorySelection) => onChange(pruneSelection(subjects, next));
  const pickedSubjects = subjects.filter((s) => subjectIds.includes(s.id));
  const pickedChapters = pickedSubjects.flatMap((s) => s.chapters).filter((c) => chapterIds.includes(c.id));
  const allTopics = pickedChapters.flatMap((c) => c.topics.map((t) => t.id));
  const allSelected = allTopics.length > 0 && allTopics.every((t) => topicIds.includes(t));

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[12px] font-medium text-fg-muted">Mapel</legend>
        {subjects.length === 0 ? (
          <p className="well rounded-xl px-4 py-3 text-[13px] text-fg-muted">
            Belum ada mapel yang dibuka untuk ujian mandiri. Minta guru menampilkan soal di bank soal.
          </p>
        ) : (
          subjects.map((s) => (
            <CheckRow key={s.id} label={s.name} checked={subjectIds.includes(s.id)} onChange={() => set({ ...sel, subjectIds: toggle(subjectIds, s.id) })} />
          ))
        )}
      </fieldset>

      <Group title="Bab" count={chapterIds.length} disabled={pickedSubjects.length === 0} hint="Pilih mapel dulu untuk membuka daftar bab.">
        {pickedSubjects.map((s) => (
          <div key={s.id} className="flex flex-col gap-2">
            {pickedSubjects.length > 1 && <span className="pt-1 text-[12px] font-semibold text-fg-muted">{s.name}</span>}
            {s.chapters.map((c) => (
              <CheckRow key={c.id} label={c.name} checked={chapterIds.includes(c.id)} onChange={() => set({ ...sel, chapterIds: toggle(chapterIds, c.id) })} />
            ))}
          </div>
        ))}
      </Group>

      <Group title="Sub-bab" count={topicIds.length} disabled={pickedChapters.length === 0} hint="Pilih minimal satu bab untuk membuka daftar sub-bab.">
        <CheckRow label="Pilih semua sub-bab" checked={allSelected} onChange={() => set({ ...sel, topicIds: allSelected ? [] : allTopics })} />
        {pickedChapters.map((c) => (
          <div key={c.id} className="flex flex-col gap-2">
            <span className="pt-1 text-[12px] font-semibold text-fg-muted">{c.name}</span>
            {c.topics.map((t) => (
              <CheckRow
                key={t.id}
                label={t.name}
                meta={`${t.question_count} soal`}
                checked={topicIds.includes(t.id)}
                onChange={() => set({ ...sel, topicIds: toggle(topicIds, t.id) })}
              />
            ))}
          </div>
        ))}
      </Group>
    </div>
  );
}
