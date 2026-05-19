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
  return (
    <div className="space-y-6">
      <RichTextEditorField
        label="Question Text"
        value={formData.question_text}
        onChange={(value: string) => handleInputChange('question_text', value)}
        density="compact"
        theme={theme}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className={`block text-sm font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-700'}`}>Jenis Pertanyaan</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleInputChange('question_type', 'multiple_choice')}
              className={`px-4 h-10 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${formData.question_type === 'multiple_choice'
                ? (theme === 'dark' ? 'bg-accent-blue text-white' : 'bg-nike-black text-white')
                : (theme === 'dark' ? 'bg-dark-700 border border-dark-border-medium text-dark-text-secondary hover:border-accent-blue hover:text-accent-blue' : 'bg-white border border-slate-300 text-gray-500 hover:border-nike-black hover:text-nike-black')
                }`}
            >
              Pilihan Ganda
            </button>
            <button
              type="button"
              onClick={() => handleInputChange('question_type', 'short_answer')}
              className={`px-4 h-10 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${formData.question_type === 'short_answer'
                ? (theme === 'dark' ? 'bg-accent-blue text-white' : 'bg-nike-black text-white')
                : (theme === 'dark' ? 'bg-dark-700 border border-dark-border-medium text-dark-text-secondary hover:border-accent-blue hover:text-accent-blue' : 'bg-white border border-slate-300 text-gray-500 hover:border-nike-black hover:text-nike-black')
                }`}
            >
              Isian Singkat
            </button>
          </div>
        </div>

        {formData.question_type === 'short_answer' && (
          <div className="space-y-2">
            <label className={`block text-sm font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-700'}`}>Jawaban Singkat</label>
            <input
              type="text"
              value={formData.short_answer}
              onChange={(event) => handleInputChange('short_answer', event.target.value)}
              placeholder="Jawaban teks atau angka"
              className={`w-full px-4 h-11 border rounded-xl focus:outline-none focus:ring-2 text-sm font-medium ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700 text-dark-text-primary focus:ring-accent-blue/20 focus:border-accent-blue placeholder:text-dark-text-tertiary' : 'border-slate-300 bg-white text-gray-900 focus:ring-nike-black/10 focus:border-nike-black placeholder:text-gray-400'}`}
            />
            <p className={`text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>Hanya teks atau angka.</p>
          </div>
        )}
      </div>

      {formData.question_type === 'multiple_choice' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:col-span-2">
          <div className="space-y-2">
            <label className={`block text-sm font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-700'}`}>
              Mapel
              <span className={`ml-2 text-[10px] font-normal capitalize ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>(Multi-select)</span>
            </label>
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
                value={newMapelInput}
                onChange={(e) => setNewMapelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddNewMapel(); } }}
                placeholder="Add new mapel..."
                className={`flex-1 px-3 h-8 border rounded-lg text-[11px] focus:outline-none focus:ring-1 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700 text-dark-text-primary focus:ring-accent-green/50 placeholder:text-dark-text-tertiary' : 'border-slate-300 bg-white text-gray-900 focus:ring-green-500 placeholder:text-gray-400'}`}
              />
              <button
                type="button"
                onClick={() => void handleAddNewMapel()}
                disabled={addingCategory || !newMapelInput.trim()}
                className={`px-3 h-8 rounded-lg text-[10px] font-bold uppercase transition-colors disabled:opacity-50 ${theme === 'dark' ? 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
              >
                + New
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className={`block text-sm font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-700'}`}>
              Bab
              <span className={`ml-2 text-[10px] font-normal capitalize ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>(Multi-select)</span>
            </label>
            {formData.mapels.length === 0 ? (
              <div className={`w-full border border-dashed rounded-xl px-4 py-8 text-xs italic text-center ${theme === 'dark' ? 'bg-dark-700/50 border-dark-border-medium text-dark-text-tertiary' : 'bg-gray-50 border-slate-300 text-gray-400'}`}>
                Pilih Mapel dulu untuk melihat Bab
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
                    value={newbabInput}
                    onChange={(e) => setNewbabInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddNewbab(); } }}
                    placeholder="Add new bab..."
                    className={`flex-1 px-3 h-8 border rounded-lg text-[11px] focus:outline-none focus:ring-1 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700 text-dark-text-primary focus:ring-accent-green/50 placeholder:text-dark-text-tertiary' : 'border-slate-300 bg-white text-gray-900 focus:ring-green-500 placeholder:text-gray-400'}`}
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddNewbab()}
                    disabled={addingCategory || !newbabInput.trim()}
                    className={`px-3 h-8 rounded-lg text-[10px] font-bold uppercase transition-colors disabled:opacity-50 ${theme === 'dark' ? 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                  >
                    + New
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <label className={`block text-sm font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-700'}`}>
              Sub-bab
              <span className={`ml-2 text-[10px] font-normal capitalize ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>(Multi-select)</span>
            </label>
            {formData.babs.length === 0 ? (
              <div className={`w-full border border-dashed rounded-xl px-4 py-8 text-xs italic text-center ${theme === 'dark' ? 'bg-dark-700/50 border-dark-border-medium text-dark-text-tertiary' : 'bg-gray-50 border-slate-300 text-gray-400'}`}>
                Pilih Bab dulu untuk melihat Subbab
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
                    value={newSubBabInput}
                    onChange={(e) => setNewSubBabInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddNewSubBab(); } }}
                    placeholder="Add new sub-bab..."
                    className={`flex-1 px-3 h-8 border rounded-lg text-[11px] focus:outline-none focus:ring-1 ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700 text-dark-text-primary focus:ring-accent-green/50 placeholder:text-dark-text-tertiary' : 'border-slate-300 bg-white text-gray-900 focus:ring-green-500 placeholder:text-gray-400'}`}
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddNewSubBab()}
                    disabled={addingCategory || !newSubBabInput.trim()}
                    className={`px-3 h-8 rounded-lg text-[10px] font-bold uppercase transition-colors disabled:opacity-50 ${theme === 'dark' ? 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                  >
                    + New
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {formData.question_type === 'multiple_choice' && (
          <div className="space-y-1">
            <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-700'}`}>Correct Answer</label>
            <select
              value={formData.correct_answer}
              onChange={(event) => handleInputChange('correct_answer', event.target.value)}
              className={`w-full px-4 h-[48px] border-2 rounded-lg focus:outline-none transition-all font-medium appearance-none ${theme === 'dark' ? 'border-dark-border-medium bg-dark-700 text-dark-text-primary focus:border-accent-blue' : 'border-slate-300 bg-white text-gray-900 focus:border-nike-black'}`}
            >
              <option value="A">Option A</option>
              <option value="B">Option B</option>
              <option value="C">Option C</option>
              <option value="D">Option D</option>
              <option value="E">Option E</option>
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-700'}`}>Is Hidden</label>
          <label
            className={`flex items-center justify-between w-full h-[48px] px-4 border-2 rounded-lg cursor-pointer transition-all ${formData.is_hidden ? (theme === 'dark' ? 'border-accent-red/30 bg-accent-red/10' : 'border-red-200 bg-red-50') : (theme === 'dark' ? 'border-dark-border-medium bg-dark-700' : 'border-slate-300 bg-white')}`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={formData.is_hidden}
              onChange={(event) => handleInputChange('is_hidden', event.target.checked)}
            />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${formData.is_hidden ? (theme === 'dark' ? 'text-accent-red' : 'text-red-600') : (theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-500')}`}>
              {formData.is_hidden ? 'Hidden' : 'Visible'}
            </span>
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_hidden ? (theme === 'dark' ? 'bg-accent-red' : 'bg-red-500') : (theme === 'dark' ? 'bg-dark-600' : 'bg-gray-300')}`}>
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.is_hidden ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </span>
          </label>
          <p className={`text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-400'}`}>
            Hidden questions will be skipped for users.
          </p>
        </div>
      </div>
    </div>
  );
}
