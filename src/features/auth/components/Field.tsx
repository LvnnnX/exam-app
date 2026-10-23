import React, { useId } from 'react';
import type { LucideIcon } from 'lucide-react';

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: LucideIcon;
  hint?: React.ReactNode;
};

export function Field({ label, icon: Icon, hint, ...input }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-fg-muted">
        {label}
      </label>
      <div className="relative">
        <Icon size={16} aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
        <input
          id={id}
          aria-describedby={hintId}
          {...input}
          className="well w-full rounded-2xl border border-line py-2.5 pl-10 pr-3 text-sm text-fg focus:border-primary focus:outline-none"
        />
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-fg-subtle">
          {hint}
        </p>
      )}
    </div>
  );
}
