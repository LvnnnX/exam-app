"use client";

import React from 'react';
import NeumorphButton from '@/app/components/ui/neumorph-button';

type ResultsFooterProps = {
  onRestart: () => void;
};

export default function ResultsFooter({ onRestart }: ResultsFooterProps) {
  return (
    <div className="pt-6 border-t border-black/[0.06]">
      <NeumorphButton
        type="button"
        intent="primary"
        size="medium"
        fullWidth
        onClick={onRestart}
        className="h-12 sm:w-auto sm:px-10"
      >
        Start over
      </NeumorphButton>
    </div>
  );
}
