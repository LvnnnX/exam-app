'use client';

import { useState, useEffect } from 'react';

export type AdminTheme = 'light' | 'dark';

const DARK_BG = '#000000';
const DARK_FG = '#ffffff';

export function useAdminTheme() {
  const [theme, setTheme] = useState<AdminTheme>('dark');

  useEffect(() => {
    const stored = localStorage.getItem('admin-theme') as AdminTheme | null;
    if (stored) {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    const apply = () => {
      const adminPage = document.querySelector<HTMLElement>('[data-admin-page]');
      if (theme === 'dark') {
        body.classList.add('admin-dark-theme');
        root.classList.add('admin-dark-theme');
        root.style.setProperty('background-color', DARK_BG, 'important');
        body.style.setProperty('background-color', DARK_BG, 'important');
        body.style.setProperty('color', DARK_FG, 'important');
        root.style.colorScheme = 'dark';
        if (adminPage) {
          adminPage.style.setProperty('background-color', DARK_BG, 'important');
          adminPage.style.setProperty('color', DARK_FG, 'important');
        }
      } else {
        body.classList.remove('admin-dark-theme');
        root.classList.remove('admin-dark-theme');
        root.style.removeProperty('background-color');
        body.style.removeProperty('background-color');
        body.style.removeProperty('color');
        root.style.colorScheme = '';
        if (adminPage) {
          adminPage.style.removeProperty('background-color');
          adminPage.style.removeProperty('color');
        }
      }
    };

    apply();
    // Re-apply once more on the next frame to catch the admin-page wrapper
    // after React has had a chance to mount it.
    const raf = window.requestAnimationFrame(apply);

    localStorage.setItem('admin-theme', theme);

    return () => {
      window.cancelAnimationFrame(raf);
      body.classList.remove('admin-dark-theme');
      root.classList.remove('admin-dark-theme');
      root.style.removeProperty('background-color');
      body.style.removeProperty('background-color');
      body.style.removeProperty('color');
      root.style.colorScheme = '';
      const adminPage = document.querySelector<HTMLElement>('[data-admin-page]');
      if (adminPage) {
        adminPage.style.removeProperty('background-color');
        adminPage.style.removeProperty('color');
      }
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
}
