"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import MultiSelectDropdown from '@/app/components/MultiSelectDropdown';

const RichTextEditorField = dynamic(() => import('@/app/components/RichTextEditorField'), { ssr: false });

type QuestionDraft = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_answer: string;
  question_type: 'multiple_choice' | 'short_answer';
  short_answer: string;
  is_hidden: boolean;
  mapels: string[];
  babs: string[];
  sub_babs: string[];
};

type DropdownOption = {
  value: string;
  label: string;
};

type QuestionModalEditFormProps = {
  formData: QuestionDraft;
  filteredMapelsForForm: DropdownOption[];
  filteredBabsForForm: DropdownOption[];
  filteredSubBabsForForm: DropdownOption[];
  newMapelInput: string;
  newbabInput: string;
  newSubBabInput: string;
  addingCategory: boolean;
  handleInputChange: (field: keyof QuestionDraft, value: string | boolean | string[]) => void;
  setNewMapelInput: (value: string) => void;
  setNewbabInput: (value: string) => void;
  setNewSubBabInput: (value: string) => void;
  handleAddNewMapel: () => Promise<void> | void;
  handleAddNewbab: () => Promise<void> | void;
  handleAddNewSubBab: () => Promise<void> | void;
  theme?: 'light' | 'dark';
};

export default function QuestionModalEditForm({
  formData,
  filteredMapelsForForm,
  filteredBabsForForm,
  filteredSubBabsForForm,
  newMapelInput,
  newbabInput,
  newSubBabInput,
  addingCategory,
  handleInputChange,
  setNewMapelInput,
  setNewbabInput,
  setNewSubBabInput,
  handleAddNewMapel,
  handleAddNewbab,
  handleAddNewSubBab,
  theme = 'dark',
}: QuestionModalEditFormProps) {
  const fieldLabel = 'block text-[13px] font-semibold text-fg';
  const hint = 'ml-1.5 text-[12px] font-medium text-fg-muted';
  const segment = 'h-11 md:h-10 flex-1 rounded-lg px-4 text-[13px] font-semibold transition-calm';
  const newCategoryInput = 'well h-11 md:h-10 min-w-0 flex-1 rounded-lg px-3 text-[13px] text-fg placeholder:text-fg-subtle transition-calm';
  const newCategoryButton = 'h-11 md:h-10 shrink-0 rounded-lg bg-primary/12 px-3 text-[13px] font-semibold text-primary transition-calm hover:bg-primary/18 disabled:opacity-50';
  const emptyTier = 'w-full rounded-xl border border-dashed border-line-strong px-4 py-7 text-center text-[13px] text-fg-muted';

  return (
    <div className="space-y-6">
      <RichTextEditorField
        label="Question text"
        value={formData.question_text}
        onChange={(value: string) => handleInputChange('question_text', value)}
        density="compact"
        theme={theme}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <span className={fieldLabel}>Jenis pertanyaan</span>
          <div className="well flex max-w-sm gap-1 rounded-xl p-1" role="group" aria-label="Jenis pertanyaan">
            <button
              type="button"
              aria-pressed={formData.question_type === 'multiple_choice'}
              onClick={() => handleInputChange('question_type', 'multiple_choice')}
              className={`${segment} ${formData.question_type === 'multiple_choice' ? 'clay' : 'text-fg-muted hover:text-fg'}`}
            >
              Pilihan ganda
            </button>
            <button
              type="button"
              aria-pressed={formData.question_type === 'short_answer'}
              onClick={() => handleInputChange('question_type', 'short_answer')}
              className={`${segment} ${formData.question_type === 'short_answer' ? 'clay' : 'text-fg-muted hover:text-fg'}`}
            >
              Isian singkat
            </button>
          </div>
        </div>

        {formData.question_type === 'short_answer' && (
          <div className="space-y-2">
            <label htmlFor="short-answer-key" className={fieldLabel}>Jawaban singkat</label>
            <input
              id="short-answer-key"
              type="text"
              value={formData.short_answer}
              onChange={(event) => handleInputChange('short_answer', event.target.value)}
              placeholder="Jawaban teks atau angka"
              className="well h-11 w-full rounded-xl px-4 text-[14px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
            />
            <p className="text-[12px] text-fg-muted">Hanya teks atau angka.</p>
          </div>
        )}
      </div>

      {formData.question_type === 'multiple_choice' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <RichTextEditorField
            label="Option A"
            value={formData.option_a}
            onChange={(value: string) => handleInputChange('option_a', value)}
            density="compact"
            theme={theme}
          />
          <RichTextEditorField
            label="Option B"
            value={formData.option_b}
            onChange={(value: string) => handleInputChange('option_b', value)}
            density="compact"
            theme={theme}
          />
          <RichTextEditorField
            label="Option C"
            value={formData.option_c}
            onChange={(value: string) => handleInputChange('option_c', value)}
            density="compact"
            theme={theme}
          />
          <RichTextEditorField
            label="Option D"
            value={formData.option_d}
            onChange={(value: string) => handleInputChange('option_d', value)}
            density="compact"
            theme={theme}
          />
          <RichTextEditorField
            label="Option E"
            value={formData.option_e}
            onChange={(value: string) => handleInputChange('option_e', value)}
            density="compact"
            theme={theme}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="grid grid-cols-1 gap-6 md:col-span-2 md:grid-cols-3">
          <div className="space-y-2">
            <span className={fieldLabel}>
              Mapel
              <span className={hint}>multi-select</span>
            </span>
            <MultiSelectDropdown
              label="Mapel"
              options={filteredMapelsForForm}
              selectedValues={formData.mapels}
              onChange={(vals) => {
                handleInputChange('mapels', vals);
                handleInputChange('babs', []);
                handleInputChange('sub_babs', []);
              }}
              placeholder="Pilih Mapel..."
              hideSelectAll={true}
              theme={theme}
            />

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                aria-label="Mapel baru"
                value={newMapelInput}
                onChange={(e) => setNewMapelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddNewMapel(); } }}
                placeholder="Add new mapel..."
                className={newCategoryInput}
              />
              <button
                type="button"
                onClick={() => void handleAddNewMapel()}
                disabled={addingCategory || !newMapelInput.trim()}
                className={newCategoryButton}
              >
                + New
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <span className={fieldLabel}>
              Bab
              <span className={hint}>multi-select</span>
            </span>
            {formData.mapels.length === 0 ? (
              <div className={emptyTier}>
                Pilih mapel dulu untuk melihat bab.
              </div>
            ) : (
              <>
                <MultiSelectDropdown
                  label="Bab"
                  options={filteredBabsForForm}
                  selectedValues={formData.babs}
                  onChange={(vals) => {
                    handleInputChange('babs', vals);
                    handleInputChange('sub_babs', []);
                  }}
                  placeholder="Pilih Bab..."
                  hideSelectAll={true}
                  theme={theme}
                />

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    aria-label="Bab baru"
                    value={newbabInput}
                    onChange={(e) => setNewbabInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddNewbab(); } }}
                    placeholder="Add new bab..."
                    className={newCategoryInput}
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddNewbab()}
                    disabled={addingCategory || !newbabInput.trim()}
                    className={newCategoryButton}
                  >
                    + New
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <span className={fieldLabel}>
              Sub-bab
              <span className={hint}>multi-select</span>
            </span>
            {formData.babs.length === 0 ? (
              <div className={emptyTier}>
                Pilih bab dulu untuk melihat sub-bab.
              </div>
            ) : (
              <>
                <MultiSelectDropdown
                  label="Sub-bab"
                  options={filteredSubBabsForForm}
                  selectedValues={formData.sub_babs}
                  onChange={(vals) => handleInputChange('sub_babs', vals)}
                  placeholder="Pilih Sub-bab..."
                  hideSelectAll={true}
                  theme={theme}
                />

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    aria-label="Sub-bab baru"
                    value={newSubBabInput}
                    onChange={(e) => setNewSubBabInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddNewSubBab(); } }}
                    placeholder="Add new sub-bab..."
                    className={newCategoryInput}
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddNewSubBab()}
                    disabled={addingCategory || !newSubBabInput.trim()}
                    className={newCategoryButton}
                  >
                    + New
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {formData.question_type === 'multiple_choice' && (
          <div className="space-y-2">
            <label htmlFor="correct-answer-select" className={fieldLabel}>Correct answer</label>
            <div className="relative">
              <select
                id="correct-answer-select"
                value={formData.correct_answer}
                onChange={(event) => handleInputChange('correct_answer', event.target.value)}
                className="well well-hover h-12 w-full cursor-pointer appearance-none rounded-xl pl-4 pr-10 text-[14px] font-semibold text-fg transition-calm"
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
                <option value="E">Option E</option>
              </select>
              <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <span className={fieldLabel}>Visibility</span>
          <label
            className={`flex h-12 w-full cursor-pointer items-center justify-between rounded-xl px-4 transition-calm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)] ${formData.is_hidden ? 'bg-danger/10' : 'well'}`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={formData.is_hidden}
              onChange={(event) => handleInputChange('is_hidden', event.target.checked)}
            />
            <span className={`text-[14px] font-semibold ${formData.is_hidden ? 'text-danger' : 'text-fg'}`}>
              {formData.is_hidden ? 'Hidden' : 'Visible'}
            </span>
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-calm ${formData.is_hidden ? 'bg-danger' : 'bg-line-strong'}`}>
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${formData.is_hidden ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </span>
          </label>
          <p className="text-[12px] text-fg-muted">
            Hidden questions will be skipped for users.
          </p>
        </div>
      </div>
    </div>
  );
}
