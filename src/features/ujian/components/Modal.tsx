'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  /** null = tidak bisa ditutup lewat Escape, scrim, atau tombol X (peringatan anti-curang). */
  onClose: (() => void) | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'lg';
  testId?: string;
  /** Alur siswa light only; admin ikut tema body. */
  theme?: 'light';
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal(props: ModalProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(<ModalInner {...props} />, document.body);
}

function ModalInner({ title, onClose, children, footer, size = 'sm', testId, theme }: ModalProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? ref.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Modal tanpa onClose menelan Escape di capture phase (DESIGN Modals exception).
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) return;
      const a = items[0];
      const b = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      opener?.focus();
    };
  }, []);

  return (
    <div
      className="glass-scrim fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      data-theme={theme}
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId}
        className={`glass-sheet animate-in flex max-h-[90dvh] w-full flex-col rounded-t-4xl sm:rounded-4xl ${
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 pb-4 pt-5">
          <h2 id={titleId} className="text-[20px] font-semibold leading-tight text-fg">
            {title}
          </h2>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Tutup" className="well well-hover inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg-muted">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
