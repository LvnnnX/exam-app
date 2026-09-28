"use client";

import React from 'react';

type TrackingModalFooterProps = {
  onClose: () => void;
  theme?: 'light' | 'dark';
};

export default function TrackingModalFooter({ onClose }: TrackingModalFooterProps) {
  return (
    <div className="flex shrink-0 justify-end border-t border-line px-4 py-3 sm:px-6 sm:py-4">
      <button type="button" onClick={onClose} className="well well-hover h-11 rounded-xl px-5 text-[14px] font-medium text-fg transition-calm">Close</button>
    </div>
  );
}
