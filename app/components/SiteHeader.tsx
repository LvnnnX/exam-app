"use client";

import { usePathname } from 'next/navigation';

export default function SiteHeader() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) return null;

  return (
    <header className="global-site-header sticky top-0 z-50 px-3 pt-3 md:px-6">
      <div className="glass mx-auto flex h-14 max-w-[1440px] items-center rounded-3xl px-4 md:px-6">
        <span className="text-[15px] font-bold tracking-tight text-fg">
          OSK Smandapura 2026
        </span>
      </div>
    </header>
  );
}
