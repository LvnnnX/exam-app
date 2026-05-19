"use client";

import React from 'react';
import { type RawQuestion } from '@/lib/questions';
import { formatCategorySelectionLabel } from '@/lib/categories';
import QuestionModalShell from '@/app/components/admin/QuestionModalShell';
import QuestionModalBody from '@/app/components/admin/QuestionModalBody';
import TrackingModal from '@/app/components/admin/TrackingModal';
import ResultDetailsModal from '@/app/components/admin/ResultDetailsModal';

type ResultAnswer = {
  question_id: number;
  user_answer: string;
  is_correct: boolean;
};

type ExamResult = {
  id: number;
  name: string;
  score: number;
  total_questions: number;
  mapel: string;
  bab: string;
  sub_bab: string;
  taken_at: string;
  user_answers?: ResultAnswer[];
  duration_seconds?: number;
  mode?: string;
};

type LiveSession = {
  session_id: string;
  name: string;
  mapel: string;
  bab: string;
  sub_bab: string;
  mode: string;
  question_count: number;
  question_ids: number[];
  current_index: number;
  user_answers: Record<string, string>;
  lives: number;
  start_time: string;
};

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

type AdminPrimaryModalsProps = {
  selectedQuestion: RawQuestion | null;
  isAdding: boolean;
  isEditing: boolean;
  savingQuestion: boolean;
  formData: QuestionDraft;
  filteredMapelsForForm: DropdownOption[];
  filteredBabsForForm: DropdownOption[];
  filteredSubBabsForForm: DropdownOption[];
  newMapelInput: string;
  newbabInput: string;
  newSubBabInput: string;
  addingCategory: boolean;
  trackingSession: LiveSession | null;
  currentTrackedQuestion: RawQuestion | null;
  isTrackingModalOpen: boolean;
  viewingResult: ExamResult | null;
  detailLoading: boolean;
  detailQuestions: RawQuestion[];
  onCloseQuestionModal: () => void;
  onSaveQuestion: () => void;
  handleInputChange: (field: keyof QuestionDraft, value: string | string[] | boolean) => void;
  setNewMapelInput: (value: string) => void;
  setNewbabInput: (value: string) => void;
  setNewSubBabInput: (value: string) => void;
  onAddNewMapel: () => void;
  onAddNewbab: () => void;
  onAddNewSubBab: () => void;
  getOptionText: (question: RawQuestion, label: 'a' | 'b' | 'c' | 'd' | 'e') => string;
  getCorrectOptionText: (question: RawQuestion) => string;
  onCloseTrackingModal: () => void;
  onCloseResultDetailsModal: () => void;
  theme?: 'light' | 'dark';
};

export default function AdminPrimaryModals({
  selectedQuestion,
  isAdding,
  isEditing,
  savingQuestion,
  formData,
  filteredMapelsForForm,
  filteredBabsForForm,
  filteredSubBabsForForm,
  newMapelInput,
  newbabInput,
  newSubBabInput,
  addingCategory,
  trackingSession,
  currentTrackedQuestion,
  isTrackingModalOpen,
  viewingResult,
  detailLoading,
  detailQuestions,
  onCloseQuestionModal,
  onSaveQuestion,
  handleInputChange,
  setNewMapelInput,
  setNewbabInput,
  setNewSubBabInput,
  onAddNewMapel,
  onAddNewbab,
  onAddNewSubBab,
  getOptionText,
  getCorrectOptionText,
  onCloseTrackingModal,
  onCloseResultDetailsModal,
  theme = 'dark',
}: AdminPrimaryModalsProps) {
  return (
    <>
      <QuestionModalShell
        isOpen={Boolean(selectedQuestion || isAdding || isEditing)}
        isAdding={isAdding}
        isEditing={isEditing}
        selectedQuestion={selectedQuestion}
        savingQuestion={savingQuestion}
        onClose={onCloseQuestionModal}
        onSave={onSaveQuestion}
        theme={theme}
      >
        <QuestionModalBody
          isAdding={isAdding}
          isEditing={isEditing}
          selectedQuestion={selectedQuestion}
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
          handleAddNewMapel={onAddNewMapel}
          handleAddNewbab={onAddNewbab}
          handleAddNewSubBab={onAddNewSubBab}
          getOptionText={getOptionText}
          formatCategorySelectionLabel={formatCategorySelectionLabel}
          theme={theme}
        />
      </QuestionModalShell>

      <TrackingModal
        isOpen={isTrackingModalOpen}
        trackingSession={trackingSession}
        detailLoading={detailLoading}
        detailQuestions={detailQuestions}
        currentTrackedQuestion={currentTrackedQuestion}
        formatCategorySelectionLabel={formatCategorySelectionLabel}
        getOptionText={getOptionText}
        getCorrectOptionText={getCorrectOptionText}
        onClose={onCloseTrackingModal}
        theme={theme}
      />

      <ResultDetailsModal
        viewingResult={viewingResult}
        detailLoading={detailLoading}
        detailQuestions={detailQuestions}
        formatCategorySelectionLabel={formatCategorySelectionLabel}
        getCorrectOptionText={getCorrectOptionText}
        onClose={onCloseResultDetailsModal}
        theme={theme}
      />
    </>
  );
}
