"use client";

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type DeleteTopicError = {
  message: string;
  questionIds: number[];
};

type DeleteTopicErrorModalProps = {
  error: DeleteTopicError | null;
  onClose: () => void;
  theme?: 'light' | 'dark';
};

export default function DeleteTopicErrorModal({ error, onClose, theme = 'dark' }: DeleteTopicErrorModalProps) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          className="fixed inset-0 bg-black/30 backdrop-blur-2xl flex items-center justify-center p-2 sm:p-4 z-[9999]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={`rounded-[24px] shadow-ios-xl max-w-md w-full overflow-hidden ${theme === 'dark' ? 'bg-dark-800' : 'bg-white'}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-accent-red/15' : 'bg-red-50'}`}>
                  <svg className={`w-4 h-4 ${theme === 'dark' ? 'text-accent-red' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className={`text-[15px] font-semibold tracking-tight ${theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'}`}>Tidak dapat menghapus</h3>
              </div>
              <p className={`text-[13px] leading-relaxed mb-4 ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>{error.message}</p>
              <div className={`rounded-2xl px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.03]' : 'bg-black/[0.025]'}`}>
                <p className={`text-[11px] font-medium mb-2 ${theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'}`}>ID soal terdampak</p>
                <div className="flex flex-wrap gap-1.5">
                  {error.questionIds.map(id => (
                    <span key={id} className={`px-2.5 py-1 rounded-full text-[11px] font-medium font-mono tabular-nums ${theme === 'dark' ? 'bg-accent-red/15 text-accent-red' : 'bg-red-50 text-red-700'}`}>
                      #{id}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className={`flex justify-end px-4 py-3 border-t sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
              <button
                type="button"
                onClick={onClose}
                className={`px-4 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-blue hover:bg-accent-blue/90' : 'bg-blue-500 hover:bg-blue-600'}`}
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
