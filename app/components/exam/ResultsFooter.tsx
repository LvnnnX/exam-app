"use client";

import React from 'react';

type ResultsFooterProps = {
  onRestart: () => void;
};

export default function ResultsFooter({ onRestart }: ResultsFooterProps) {
  return (
    <div className="border-t border-line pt-6">
      <button
        type="button"
        onClick={onRestart}
        className="clay-primary h-12 w-full rounded-xl px-10 text-[15px] font-semibold sm:w-auto"
      >
        Start over
      </button>
    </div>
  );
}
