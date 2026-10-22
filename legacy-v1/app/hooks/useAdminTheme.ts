'use client';

import { useEffect, useSyncExternalStore } from 'react';

export type AdminTheme = 'light' | 'dark';

// Match --canvas / --fg of the dark theme in globals.css.
const DARK_BG = '#0e1416';
const DARK_FG = '#eef3f2';

const themeListeners = new Set<() => void>();

function readStoredTheme(): AdminTheme {
  try {
    const stored = window.localStorage.getItem('admin-theme');
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  } catch {
    return 'dark';
  }
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    themeListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function writeStoredTheme(next: AdminTheme) {
  try {
    window.localStorage.setItem('admin-theme', next);
  } catch {
    // Storage blocked: the theme still applies for this page view.
  }
  themeListeners.forEach((listener) => listener());
}

export function useAdminTheme() {
  // The server snapshot is always 'dark', so hydration matches the server HTML;
  // React then re-renders with the stored theme without a hydration error.
  const theme = useSyncExternalStore<AdminTheme>(subscribeTheme, readStoredTheme, () => 'dark');

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
        // The admin page stays transparent so the canvas light fields show
        // through the glass surfaces; only the text color is forced.
        if (adminPage) {
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
    writeStoredTheme(theme === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
}
