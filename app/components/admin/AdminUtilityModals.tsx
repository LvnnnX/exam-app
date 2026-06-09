"use client";

import React from 'react';
import DeleteTopicErrorModal from '@/app/components/admin/DeleteTopicErrorModal';
import BatchVisibilityConfirmModal from '@/app/components/admin/BatchVisibilityConfirmModal';
import BatchDeleteConfirmModal from '@/app/components/admin/BatchDeleteConfirmModal';
import DeleteQuestionConfirmModal from '@/app/components/admin/DeleteQuestionConfirmModal';

type DeleteTopicError = {
  message: string;
  questionIds: number[];
};

type DeletingQuestion = {
  question_text: string;
};

type AdminUtilityModalsProps = {
  deleteTopicError: DeleteTopicError | null;
  batchVisibilityModalOpen: boolean;
  batchVisibilityTarget: boolean;
  selectedQuestionCount: number;
  batchProcessing: boolean;
  batchDeleteModalOpen: boolean;
  deletingQuestion: DeletingQuestion | null;
  deletingQuestionPreview: string;
  onCloseDeleteTopicError: () => void;
  onCancelBatchVisibility: () => void;
  onConfirmBatchVisibility: () => void;
  onCancelBatchDelete: () => void;
  onConfirmBatchDelete: () => void;
  onCancelDeleteQuestion: () => void;
  onConfirmDeleteQuestion: () => void;
  theme?: 'light' | 'dark';
};

export default function AdminUtilityModals({
  deleteTopicError,
  batchVisibilityModalOpen,
  batchVisibilityTarget,
  selectedQuestionCount,
  batchProcessing,
  batchDeleteModalOpen,
  deletingQuestion,
  deletingQuestionPreview,
  onCloseDeleteTopicError,
  onCancelBatchVisibility,
  onConfirmBatchVisibility,
  onCancelBatchDelete,
  onConfirmBatchDelete,
  onCancelDeleteQuestion,
  onConfirmDeleteQuestion,
  theme = 'dark',
}: AdminUtilityModalsProps) {
  return (
    <>
      <DeleteTopicErrorModal
        error={deleteTopicError}
        onClose={onCloseDeleteTopicError}
        theme={theme}
      />

      <BatchVisibilityConfirmModal
        isOpen={batchVisibilityModalOpen}
        batchVisibilityTarget={batchVisibilityTarget}
        selectedCount={selectedQuestionCount}
        batchProcessing={batchProcessing}
        onCancel={onCancelBatchVisibility}
        onConfirm={onConfirmBatchVisibility}
        theme={theme}
      />

      <BatchDeleteConfirmModal
        isOpen={batchDeleteModalOpen}
        selectedCount={selectedQuestionCount}
        batchProcessing={batchProcessing}
        onCancel={onCancelBatchDelete}
        onConfirm={onConfirmBatchDelete}
        theme={theme}
      />

      <DeleteQuestionConfirmModal
        deletingQuestion={deletingQuestion}
        previewText={deletingQuestionPreview}
        onCancel={onCancelDeleteQuestion}
        onConfirm={onConfirmDeleteQuestion}
        theme={theme}
      />
    </>
  );
}
