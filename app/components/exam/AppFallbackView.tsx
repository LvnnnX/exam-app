"use client";

import React from 'react';

type AppFallbackViewProps = {
  onReset: () => void;
};

export default function AppFallbackView({ onReset }: AppFallbackViewProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-[14px] font-medium text-nike-black tracking-tight mb-1">Something went wrong</p>
        <p className="text-[12px] text-nike-grey-500 tracking-tight mb-5">Reset the session and try again.</p>
        <button onClick={onReset} className="h-11 px-6 rounded-full bg-nike-black text-white text-[13px] font-medium hover:bg-nike-grey-500 transition-spring-fast active:scale-95 tracking-tight shadow-ios-sm">
          Reset session
        </button>
      </div>
    </div>
  );
}
