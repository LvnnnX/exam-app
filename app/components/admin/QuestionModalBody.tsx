"use client";

import React from 'react';
import { type RawQuestion } from '@/lib/questions';
import QuestionModalEditForm from '@/app/components/admin/QuestionModalEditForm';
import QuestionModalPreviewPane from '@/app/components/admin/QuestionModalPreviewPane';

type OptionLabel = 'a' | 'b' | 'c' | 'd' | 'e';

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

type QuestionModalBodyProps = {
  isAdding: boolean;
  isEditing: boolean;
  selectedQuestion: RawQuestion | null;
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
  getOptionText: (question: RawQuestion, label: OptionLabel) => string;
  formatCategorySelectionLabel: (value?: string | null) => string;
  theme?: 'light' | 'dark';
};

export default function QuestionModalBody({
  isAdding,
  isEditing,
  selectedQuestion,
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
  getOptionText,
  formatCategorySelectionLabel,
  theme = 'dark',
}: QuestionModalBodyProps) {
  return (
    <div className={`flex-1 overflow-y-auto px-6 py-6 quick-insert-scroll`}>
      {(isAdding || isEditing) ? (
        <QuestionModalEditForm
          formData={formData}
          filteredMapelsForForm={filteredMapelsForForm}
          filteredBabsForForm={filteredBabsForForm}
          filteredSubBabsForForm={filteredSubBabsForForm}
          newMapelInput={newMapelInput}
          newbabInput={newbabInput}
          newSubBabInput={newSubBabInput}
          addingCategory={addingCategory}
          handleInputChange={handleInputChange}
          setNewMapelInput={setNewMapelInput}
          setNewbabInput={setNewbabInput}
          setNewSubBabInput={setNewSubBabInput}
          handleAddNewMapel={handleAddNewMapel}
          handleAddNewbab={handleAddNewbab}
          handleAddNewSubBab={handleAddNewSubBab}
          theme={theme}
        />
      ) : (
        <QuestionModalPreviewPane
          selectedQuestion={selectedQuestion}
          getOptionText={getOptionText}
          formatCategorySelectionLabel={formatCategorySelectionLabel}
          theme={theme}
        />
      )}
    </div>
  );
}
