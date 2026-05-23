"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/ui';

type Theme = 'light' | 'dark';

type PrimitiveProps = {
  children: React.ReactNode;
  className?: string;
  theme?: Theme;
};

export function GradientHeading({ children, className }: PrimitiveProps) {
  return (
    <h1 className={cn('font-display text-[42px] leading-[0.96] tracking-[-0.06em] text-transparent bg-clip-text bg-[linear-gradient(115deg,#111_0%,#707072_42%,#111_76%)] sm:text-[64px]', className)}>
      {children}
    </h1>
  );
}

export function NeumorphEyebrow({ children, className, theme = 'light' }: PrimitiveProps) {
  return (
    <span className={cn('inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]', theme === 'dark' ? 'border-white/10 bg-white/5 text-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'border-black/5 bg-[#f4f4f2] text-black/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_24px_rgba(0,0,0,0.05)]', className)}>
      {children}
    </span>
  );
}

export function NeumorphButton({ children, className, theme = 'light', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & PrimitiveProps) {
  return (
    <button
      {...props}
      className={cn('rounded-full px-5 py-3 text-sm font-bold tracking-tight transition-spring-fast active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45', theme === 'dark' ? 'bg-white text-black shadow-[0_18px_40px_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.16)] hover:bg-white/90' : 'bg-[#111] text-white shadow-[0_18px_40px_rgba(0,0,0,0.22),inset_0_-2px_0_rgba(255,255,255,0.15)] hover:bg-[#2a2a2a]', className)}
    >
      {children}
    </button>
  );
}

export function CutoutCard({ children, className, theme = 'light' }: PrimitiveProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-[34px] border p-5', theme === 'dark' ? 'border-white/10 bg-white/[0.04] text-white shadow-[0_28px_80px_rgba(0,0,0,0.5)]' : 'border-black/5 bg-[#f7f7f3] text-black shadow-[18px_18px_50px_rgba(0,0,0,0.08),-14px_-14px_40px_rgba(255,255,255,0.95)]', className)}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/60 blur-2xl" />
      {children}
    </div>
  );
}

export function DistortedGlass({ children, className, theme = 'light' }: PrimitiveProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-[28px] border backdrop-blur-2xl', theme === 'dark' ? 'border-white/10 bg-white/[0.06]' : 'border-white/70 bg-white/55 shadow-[0_20px_70px_rgba(0,0,0,0.08)]', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.65),transparent_28%),radial-gradient(circle_at_82%_10%,rgba(17,17,17,0.08),transparent_24%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

export function ChoicePoll({ options, value, onChange, className }: { options: { value: string; label: string; tone?: 'red' | 'black' }[]; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <div className={cn('grid gap-2 rounded-[28px] bg-black/[0.04] p-1.5 sm:grid-cols-2', className)}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn('rounded-[22px] px-4 py-3 text-sm font-bold transition-spring-fast active:scale-[0.98]', active ? option.tone === 'red' ? 'bg-nike-red text-white shadow-ios-sm' : 'bg-white text-black shadow-ios-sm' : 'text-black/45 hover:bg-white/45')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ExpandableScreen({ title, children, className }: PrimitiveProps & { title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <CutoutCard className={className}>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left">
        <span className="text-sm font-black tracking-tight">{title}</span>
        <span className="rounded-full bg-black px-2 py-1 text-[10px] font-black text-white">{open ? 'Hide' : 'View'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-4 text-sm text-black/60">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </CutoutCard>
  );
}

export function TextAnimate({ children, className }: PrimitiveProps) {
  return (
    <motion.span initial={{ y: 14, opacity: 0, filter: 'blur(8px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.span>
  );
}

export function FamilyDrawer({ children, label = 'Tools', className }: PrimitiveProps & { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-black px-4 py-2 text-xs font-black text-white shadow-ios-sm">{label}</button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-black/40 p-4 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} onClick={(event) => event.stopPropagation()} className="mx-auto mt-24 max-w-md rounded-[34px] bg-white p-6 shadow-ios-xl">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-black tracking-tight">{label}</p>
                <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold">Close</button>
              </div>
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
