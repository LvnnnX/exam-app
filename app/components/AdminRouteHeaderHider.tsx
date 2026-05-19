"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function AdminRouteHeaderHider() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.classList.toggle('admin-route', pathname.startsWith('/admin'));

    return () => {
      document.body.classList.remove('admin-route');
    };
  }, [pathname]);

  return null;
}
