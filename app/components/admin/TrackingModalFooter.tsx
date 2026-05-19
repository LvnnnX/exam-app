"use client";

import React from 'react';

type TrackingModalFooterProps = {
  onClose: () => void;
  theme?: 'light' | 'dark';
};

export default function TrackingModalFooter({ onClose, theme = 'dark' }: TrackingModalFooterProps) {
  return (
    <div className={`shrink-0 flex justify-end px-4 py-3 border-t sm:px-6 sm:py-4 ${theme === 'dark' ? 'border-white/5' : 'border-black/5'}`}>
      <button onClick={onClose} className={`px-5 h-9 rounded-full text-[13px] font-medium text-white transition-spring-fast active:scale-95 ${theme === 'dark' ? 'bg-accent-blue hover:bg-accent-blue/90' : 'bg-blue-500 hover:bg-blue-600'}`}>Close</button>
    </div>
  );
}
