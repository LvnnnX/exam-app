"use client";

import React from 'react';

type ResultsFooterProps = {
  onRestart: () => void;
};

export default function ResultsFooter({ onRestart }: ResultsFooterProps) {
  return (
    <div className="pt-6 border-t border-black/[0.06]">
      <button
        onClick={onRestart}
        className="w-full sm:w-auto sm:px-10 h-12 rounded-full bg-nike-black text-white text-[14px] font-medium hover:bg-nike-grey-500 transition-spring-fast active:scale-[0.98] tracking-tight shadow-ios-sm"
      >
        Start over
      </button>
    </div>
  );
}
