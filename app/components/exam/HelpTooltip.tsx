"use client";

import React from 'react';

type HelpTooltipProps = {
  text: string;
};

export default function HelpTooltip({ text }: HelpTooltipProps) {
  return (
    <span className="relative group inline-block ml-1.5 align-middle">
      <button type="button" className="w-[14px] h-[14px] rounded-full bg-black/10 text-nike-grey-500 text-[10px] font-medium flex items-center justify-center hover:bg-nike-black hover:text-white transition-spring-fast cursor-help">?</button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-nike-black text-white text-[11px] font-medium leading-relaxed rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-spring-fast z-10 text-center shadow-ios-md pointer-events-none tracking-tight">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-nike-black"></div>
      </div>
    </span>
  );
}
