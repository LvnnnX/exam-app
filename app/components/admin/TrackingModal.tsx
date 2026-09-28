"use client";

import React, { useEffect, useState } from 'react';
import { type RawQuestion } from '@/lib/questions';
import TrackingModalHeader from '@/app/components/admin/TrackingModalHeader';
import TrackingCurrentQuestionPanel from '@/app/components/admin/TrackingCurrentQuestionPanel';
import TrackingSessionHistoryPanel from '@/app/components/admin/TrackingSessionHistoryPanel';

type OptionLabel = 'a' | 'b' | 'c' | 'd' | 'e';

type TrackingSession = {
  name: string;
  mode: string;
  mapel: string;
  bab: string;
  sub_bab: string;
  start_time: string;
  question_count: number;
  question_ids: number[];
  current_index: number;
  user_answers: Record<string, string>;
  lives?: number;
};

type TrackingModalProps = {
  isOpen: boolean;
  trackingSession: TrackingSession | null;
  detailLoading: boolean;
  detailQuestions: RawQuestion[];
  currentTrackedQuestion: RawQuestion | null;
  formatCategorySelectionLabel: (value?: string | null) => string;
  getOptionText: (question: RawQuestion, label: OptionLabel) => string;
  getCorrectOptionText: (question: RawQuestion) => string;
  onClose: () => void;
  theme?: 'light' | 'dark';
};

export default function TrackingModal({
  isOpen,
  trackingSession,
  detailLoading,
  detailQuestions,
  currentTrackedQuestion,
  formatCategorySelectionLabel,
  getOptionText,
  getCorrectOptionText,
  onClose,
  theme = 'dark',
}: TrackingModalProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  useEffect(() => {
    if (!isOpen || !trackingSession) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, trackingSession]);

  const handleClose = () => {
    document.body.style.overflow = '';
    onClose();
  };

  useEffect(() => {
    if (!isOpen || !trackingSession) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        document.body.style.overflow = '';
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, trackingSession, onClose]);

  if (!isOpen || !trackingSession) return null;

  const tabClass = (active: boolean) =>
    `h-11 md:h-10 flex-1 rounded-lg text-[13px] font-semibold transition-calm ${active ? 'clay' : 'text-fg-muted hover:text-fg'}`;

  return (
    <div data-theme={theme} className="glass-scrim fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4" onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Live tracking ${trackingSession.name}`}
        className="glass-sheet animate-in flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-4xl text-fg sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <TrackingModalHeader
          trackingSession={trackingSession}
          formatCategorySelectionLabel={formatCategorySelectionLabel}
          onClose={handleClose}
          theme={theme}
        />

        {/* Tab Switcher */}
        <div className="shrink-0 border-b border-line px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="well flex gap-1 rounded-xl p-1" role="group" aria-label="Tracking view">
            <button
              type="button"
              aria-pressed={activeTab === 'current'}
              onClick={() => setActiveTab('current')}
              className={tabClass(activeTab === 'current')}
            >
              Current question
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              className={tabClass(activeTab === 'history')}
            >
              History · {Object.keys(trackingSession.user_answers || {}).length}
            </button>
          </div>
        </div>

        <div className="result-details-scroll-light flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {activeTab === 'current' ? (
            <TrackingCurrentQuestionPanel
              key="current-question"
              detailLoading={detailLoading}
              currentTrackedQuestion={currentTrackedQuestion}
              getOptionText={getOptionText}
              theme={theme}
            />
          ) : (
            <TrackingSessionHistoryPanel
              key="session-history"
              detailLoading={detailLoading}
              detailQuestions={detailQuestions}
              trackingSession={trackingSession}
              getCorrectOptionText={getCorrectOptionText}
              theme={theme}
            />
          )}
        </div>
      </div>
    </div>
  );
}
