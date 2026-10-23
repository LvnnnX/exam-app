'use client';

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import RichTextEditor from './editor/RichTextEditor';
import { createQuestionAction, updateQuestionAction } from './actions';
import type { QuestionOption, QuestionType, QuestionWithTopics } from './types';
import type { SubjectNode, Visibility } from '@/src/features/kategori/types';

type QuestionFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  question?: QuestionWithTopics | null;
  categories: SubjectNode[];
  onSuccess: () => void;
};

function QuestionFormInner({
  question,
  categories,
  onClose,
  onSuccess,
}: {
  question?: QuestionWithTopics | null;
  categories: SubjectNode[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<QuestionType>(question?.type || 'multiple_choice');
  const [bodyHtml, setBodyHtml] = useState(question?.body_html || '');
  const [explanationHtml, setExplanationHtml] = useState(question?.explanation_html || '');
  const [answerKey, setAnswerKey] = useState(question?.answer_key || 'A');
  const [options, setOptions] = useState<QuestionOption[]>(
    question?.type === 'multiple_choice' && question.options?.length
      ? question.options
      : [
          { label: 'A', text: '' },
          { label: 'B', text: '' },
          { label: 'C', text: '' },
          { label: 'D', text: '' },
          { label: 'E', text: '' },
        ]
  );
  const [visibility, setVisibility] = useState<Visibility>(question?.visibility || 'shown');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    question?.topics[0]?.topic_id || categories[0]?.chapters[0]?.topics[0]?.id || ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedTopicId) {
      setError('Pilih minimal 1 sub-bab');
      return;
    }
    setLoading(true);

    try {
      if (question) {
        const res = await updateQuestionAction(question.id, {
          type,
          body_html: bodyHtml,
          explanation_html: explanationHtml || null,
          answer_key: answerKey,
          options: type === 'multiple_choice' ? options : [],
          visibility,
          topic_ids: [selectedTopicId],
        });
        if (!res.success) throw new Error(res.error);
      } else {
        const res = await createQuestionAction({
          type,
          body_html: bodyHtml,
          explanation_html: explanationHtml || null,
          answer_key: answerKey,
          options: type === 'multiple_choice' ? options : [],
          visibility,
          topic_ids: [selectedTopicId],
        });
        if (!res.success) throw new Error(res.error);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl p-5 sm:p-6 rounded-3xl glass-sheet shadow-2xl border border-line-strong flex flex-col gap-4 my-auto max-h-[92vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <h2 className="text-lg font-bold text-fg">
          {question ? `Edit Soal #${question.id}` : 'Tambah Soal Baru'}
        </h2>
        <button type="button" onClick={onClose} aria-label="Tutup modal" className="p-1 rounded-xl hover:bg-well text-fg-subtle">
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-brick-50 text-danger text-sm border border-brick-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs sm:text-sm">
        {/* Top Bar: Topic selector, Type, Visibility */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl well border border-line">
          <div>
            <label className="font-semibold text-fg-muted block mb-1">Kategori (Mapel / Bab / Sub-bab):</label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              aria-label="Pilih sub-bab kategori"
              className="w-full p-2 rounded-xl bg-canvas border border-line text-fg text-xs focus:outline-none"
            >
              <option value="">Pilih Sub-bab...</option>
              {categories.map((s) => (
                <optgroup key={s.id} label={`Mapel: ${s.name}`}>
                  {s.chapters.map((c) => (
                    <React.Fragment key={c.id}>
                      {c.topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {c.name} &rarr; {t.name}
                        </option>
                      ))}
                    </React.Fragment>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-fg-muted block mb-1">Tipe Soal:</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as QuestionType)}
              aria-label="Pilih tipe soal"
              className="w-full p-2 rounded-xl bg-canvas border border-line text-fg text-xs focus:outline-none"
            >
              <option value="multiple_choice">Pilihan Ganda (A-E)</option>
              <option value="short_answer">Isian Singkat</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-fg-muted block mb-1">Status Visibilitas:</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
              aria-label="Pilih status visibilitas"
              className="w-full p-2 rounded-xl bg-canvas border border-line text-fg text-xs focus:outline-none"
            >
              <option value="shown">Shown (Tampil ke siswa/kuis)</option>
              <option value="hidden">Hidden (Hanya admin)</option>
            </select>
          </div>
        </div>

        {/* Soal (RichTextEditor) */}
        <RichTextEditor
          label="Teks Soal (Wajib):"
          value={bodyHtml}
          onChange={setBodyHtml}
          placeholder="Tulis soal, rumus matematika, atau sisipkan gambar..."
        />

        {/* Pilihan Ganda / Isian Singkat */}
        {type === 'multiple_choice' ? (
          <div className="flex flex-col gap-3">
            <label className="font-semibold text-fg-muted">
              Pilihan Jawaban (Pilih radio untuk jawaban benar):
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {options.map((opt, idx) => (
                <div key={opt.label} className="flex items-start gap-2 p-2 rounded-2xl well border border-line">
                  <label className="flex items-center gap-1.5 pt-2 cursor-pointer font-bold text-fg">
                    <input
                      type="radio"
                      name="answer_key"
                      value={opt.label}
                      checked={answerKey === opt.label}
                      onChange={() => setAnswerKey(opt.label)}
                      className="accent-primary h-4 w-4"
                    />
                    <span className="w-5 text-center">{opt.label}</span>
                  </label>
                  <div className="flex-1">
                    <RichTextEditor
                      value={opt.text}
                      onChange={(val) => {
                        const next = [...options];
                        next[idx] = { ...next[idx], text: val };
                        setOptions(next);
                      }}
                      compactToolbar
                      placeholder={`Opsi ${opt.label}...`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-2xl well border border-line flex flex-col gap-1.5">
            <label className="font-semibold text-fg-muted">Kunci Jawaban Isian Singkat:</label>
            <input
              type="text"
              value={answerKey}
              onChange={(e) => setAnswerKey(e.target.value)}
              placeholder="Contoh: 42 atau fotosintesis"
              className="w-full p-2.5 rounded-xl bg-canvas border border-line text-sm text-fg focus:outline-none focus:border-primary"
            />
            <p className="text-[11px] text-fg-subtle">
              Penilaian tidak sensitif huruf besar/kecil dan mengabaikan semua spasi (BS-09).
            </p>
          </div>
        )}

        {/* Pembahasan (BS-04) */}
        <RichTextEditor
          label="Pembahasan (Opsional, hanya untuk admin):"
          value={explanationHtml}
          onChange={setExplanationHtml}
          compactToolbar
          placeholder="Tulis langkah penyelesaian atau penjelasan..."
        />

        {/* Action buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-line mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-well text-fg-muted"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold clay-primary flex items-center gap-2 disabled:opacity-50"
          >
            <Check size={16} /> {loading ? 'Menyimpan...' : 'Simpan Soal'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function QuestionFormModal({
  isOpen,
  onClose,
  question,
  categories,
  onSuccess,
}: QuestionFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-glass-scrim backdrop-blur-xs overflow-y-auto">
      <QuestionFormInner
        key={question ? `edit-${question.id}` : 'create-new'}
        question={question}
        categories={categories}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </div>
  );
}
