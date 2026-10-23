'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { countUjianQuestionsAction, listUjianCategoriesAction } from '../actions';
import { MIN_QUESTIONS, NAME_MAX, TIME_LIMIT_OPTIONS, canStartExam, clampPreset, presetOptions, validateStart } from '../logic';
import type { CategorySubject, NavMode, TopicLabels, UjianMode } from '../types';
import type { LastSetup } from '../client-storage';
import CategoryPicker, { pruneSelection, type CategorySelection } from './CategoryPicker';
import { RadioTiles, Segmented } from './Choice';
import { BTN_PRIMARY, ErrorBlock, LoadingBlock, Spinner } from './ui';

interface SetupFormProps {
  initial: LastSetup | null;
  onNext: (setup: LastSetup, labels: TopicLabels) => void;
}

type CountState = { status: 'idle' } | { status: 'loading' } | { status: 'ok'; n: number } | { status: 'error'; msg: string };

const NAV_HELP: Record<NavMode, string> = {
  standard: 'Bisa kembali ke soal sebelumnya, tandai ragu-ragu, dan buka daftar soal.',
  strict: 'Soal berurutan. Setelah lanjut atau lewati, soal tidak bisa dibuka lagi.',
};

function labelsOf(subjects: CategorySubject[], sel: CategorySelection): TopicLabels {
  const subs = subjects.filter((s) => sel.subjectIds.includes(s.id));
  const chaps = subs.flatMap((s) => s.chapters).filter((c) => sel.chapterIds.includes(c.id));
  const tops = chaps.flatMap((c) => c.topics).filter((t) => sel.topicIds.includes(t.id));
  return { mapel: subs.map((s) => s.name), bab: chaps.map((c) => c.name), sub_bab: tops.map((t) => t.name) };
}

export default function SetupForm({ initial, onNext }: SetupFormProps) {
  const [subjects, setSubjects] = useState<CategorySubject[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<UjianMode>(initial?.mode ?? 'exam');
  const [navMode, setNavMode] = useState<NavMode>(initial?.nav_mode ?? 'standard');
  const [name, setName] = useState(initial?.name ?? '');
  const [sel, setSel] = useState<CategorySelection>({
    subjectIds: initial?.subject_ids ?? [],
    chapterIds: initial?.chapter_ids ?? [],
    topicIds: initial?.topic_ids ?? [],
  });
  const [preset, setPreset] = useState<number | null>(initial?.question_count ?? null);
  const [timeLimit, setTimeLimit] = useState<number>(initial?.time_limit_minutes ?? 60);
  const [count, setCount] = useState<CountState>({ status: 'idle' });
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setLoadError(null);
    setSubjects(null);
    const res = await listUjianCategoriesAction();
    if (res.success) {
      setSubjects(res.data);
      setSel((prev) => pruneSelection(res.data, prev));
    } else {
      setLoadError(res.error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch awal sekali saat mount
    void loadCategories();
  }, [loadCategories]);

  const topicKey = [...sel.topicIds].sort().join(',');
  useEffect(() => {
    if (!topicKey) return;
    let alive = true;
    const t = setTimeout(async () => {
      setCount({ status: 'loading' });
      const res = await countUjianQuestionsAction(topicKey.split(','));
      if (!alive) return;
      if (res.success) {
        setCount({ status: 'ok', n: res.data });
        setPreset((p) => clampPreset(p, res.data));
      } else {
        setCount({ status: 'error', msg: res.error });
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [topicKey]);

  const available = topicKey && count.status === 'ok' ? count.n : null;
  const examBlocked = mode === 'exam' && available !== null && !canStartExam(available);
  const survivalEmpty = mode === 'survival' && available === 0;
  const countReady = available !== null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjects) return;
    const setup: LastSetup = {
      name: name.trim(),
      mode,
      nav_mode: mode === 'survival' ? 'strict' : navMode,
      subject_ids: sel.subjectIds,
      chapter_ids: sel.chapterIds,
      topic_ids: sel.topicIds,
      question_count: mode === 'exam' ? preset : null,
      time_limit_minutes: timeLimit,
    };
    const msg =
      validateStart({ ...setup, question_count: setup.question_count }, available ?? undefined) ??
      (!countReady ? 'Tunggu jumlah soal selesai dihitung.' : null);
    setError(msg);
    if (!msg) onNext(setup, labelsOf(subjects, sel));
  };

  if (loadError) {
    return <ErrorBlock title="Gagal memuat daftar mapel." detail={loadError} onRetry={loadCategories} />;
  }
  if (!subjects) return <LoadingBlock label="Memuat daftar mapel..." />;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Segmented
        label="Mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'exam', label: 'Exam', testId: 'ujian-mode-exam' },
          { value: 'survival', label: 'Survival', testId: 'ujian-mode-survival', danger: true },
        ]}
      />
      <p className="-mt-4 text-[13px] text-fg-muted">
        {mode === 'exam'
          ? 'Jawab sejumlah soal, skor dan pembahasan keluar di akhir.'
          : 'Kamu punya 3 nyawa. Jawaban salah mengurangi satu nyawa, ujian berhenti saat nyawa habis.'}
      </p>

      {mode === 'exam' && (
        <div className="flex flex-col gap-1.5">
          <Segmented
            label="Navigasi"
            value={navMode}
            onChange={setNavMode}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'strict', label: 'Strict' },
            ]}
          />
          <p className="text-[13px] text-fg-muted">{NAV_HELP[navMode]}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="ujian-name" className="text-[12px] font-medium text-fg-muted">
            Nama kamu
          </label>
          <span className="text-[12px] tabular-nums text-fg-muted" aria-live="polite">
            {name.length}/{NAME_MAX}
          </span>
        </div>
        <input
          id="ujian-name"
          data-testid="ujian-name"
          type="text"
          autoComplete="name"
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
          placeholder="Nama panggilan"
          className="well h-11 rounded-xl px-4 text-[14px] text-fg placeholder:text-fg-subtle"
        />
      </div>

      <CategoryPicker subjects={subjects} {...sel} onChange={setSel} />

      {topicKey && (
        <p className="text-[13px] text-fg-muted" aria-live="polite">
          {count.status === 'loading' && (
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" /> Menghitung soal tersedia...
            </span>
          )}
          {count.status === 'ok' && `${count.n} soal tersedia di sub-bab terpilih.`}
          {count.status === 'error' && <span className="text-danger">Gagal menghitung soal: {count.msg}</span>}
        </p>
      )}

      {mode === 'exam' && (
        <RadioTiles
          name="ujian-preset"
          legend="Jumlah soal"
          value={preset}
          onChange={setPreset}
          className="grid-cols-4"
          options={presetOptions(available ?? 0).map((o) => ({
            value: o.value,
            label: String(o.value),
            disabled: !o.enabled,
            note: available === null ? null : o.note,
            testId: `ujian-preset-${o.value}`,
          }))}
        />
      )}

      <RadioTiles
        name="ujian-time"
        legend="Batas waktu"
        value={timeLimit}
        onChange={setTimeLimit}
        className="grid-cols-2 min-[400px]:grid-cols-4"
        options={TIME_LIMIT_OPTIONS.map((m) => ({ value: m, label: m === 0 ? 'Tanpa batas' : `${m} menit` }))}
      />

      {examBlocked && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] font-medium text-danger">
          Soal di kategori ini baru {available}. Minimal {MIN_QUESTIONS} untuk mode Exam.
        </p>
      )}
      {survivalEmpty && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] font-medium text-danger">
          Belum ada soal di sub-bab ini. Pilih sub-bab lain.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        data-testid="ujian-start"
        disabled={examBlocked || survivalEmpty || count.status === 'loading'}
        className={`${BTN_PRIMARY} w-full`}
      >
        Lanjut ke konfirmasi
      </button>
    </form>
  );
}
