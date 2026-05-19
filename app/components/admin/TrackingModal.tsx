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

  if (!isOpen || !trackingSession) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 z-[10000]" onClick={handleClose}>
      <div className={`rounded-[24px] sm:rounded-[28px] shadow-ios-xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
        <TrackingModalHeader
          trackingSession={trackingSession}
          formatCategorySelectionLabel={formatCategorySelectionLabel}
          onClose={handleClose}
          theme={theme}
        />

        {/* Tab Switcher */}
        <div className={`shrink-0 flex gap-1 px-4 py-2 border-b sm:px-6 sm:py-3 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 ${
              activeTab === 'current'
                ? theme === 'dark'
                  ? 'bg-white/10 text-dark-text-primary'
                  : 'bg-black/10 text-gray-900'
                : theme === 'dark'
                ? 'text-dark-text-tertiary hover:bg-white/5'
                : 'text-gray-500 hover:bg-black/5'
            }`}
          >
            Current question
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 h-9 rounded-full text-[12px] font-medium transition-spring-fast active:scale-95 ${
              activeTab === 'history'
                ? theme === 'dark'
                  ? 'bg-white/10 text-dark-text-primary'
                  : 'bg-black/10 text-gray-900'
                : theme === 'dark'
                ? 'text-dark-text-tertiary hover:bg-white/5'
                : 'text-gray-500 hover:bg-black/5'
            }`}
          >
            History · {Object.keys(trackingSession.user_answers || {}).length}
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 ${theme === 'dark' ? 'result-details-scroll-dark' : 'result-details-scroll-light'}`}>
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
