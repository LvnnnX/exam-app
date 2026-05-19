"use client";

import { usePathname } from 'next/navigation';

export default function SiteHeader() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) return null;

  return (
    <header className="sticky top-0 z-50 bg-nike-white border-b border-nike-grey-200">
      <div className="max-w-[1440px] mx-auto px-4 md:px-12 h-[60px] flex items-center justify-center">
        <div className="font-display text-2xl font-bold tracking-[0.04em] uppercase">
          OSK SMANDAPURA 2026
        </div>
      </div>
    </header>
  );
}
