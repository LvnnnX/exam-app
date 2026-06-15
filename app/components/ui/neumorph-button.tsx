"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type NeumorphButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  intent?: "default" | "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
  loading?: boolean;
  pressed?: boolean;
  children?: React.ReactNode;
};

const intentClasses = {
  default: "border border-white/15 bg-[#2b2b2b] text-white hover:bg-nike-black-hover",
  primary: "border border-white/15 bg-dark-800 text-white hover:bg-[#1f1f1f]",
  secondary: "border border-black/10 bg-white text-dark-600 hover:bg-surface-grey-200",
  danger: "border border-[#ff5a42] bg-status-red-warm text-white hover:bg-[#f0442f]",
};

const sizeClasses = {
  small: "h-9 px-4 text-[11px]",
  medium: "h-10 px-5 text-[12px]",
  large: "h-12 px-6 text-[13px]",
};

export default function NeumorphButton({
  intent = "default",
  size = "medium",
  fullWidth,
  loading,
  pressed,
  disabled,
  className,
  children,
  ...props
}: NeumorphButtonProps) {
  return (
    <motion.button
      disabled={disabled || loading}
      aria-pressed={pressed}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className={cn(
        "inline-flex items-center justify-center rounded-[6px] font-semibold uppercase tracking-[0.08em] transition-spring-fast hover:scale-[1.03] hover:animate-[neumorph-pulse_0.65s_ease-out] active:scale-95 disabled:cursor-not-allowed disabled:bg-black/5 disabled:text-nike-grey-500 disabled:opacity-70",
        pressed ? "neumorph-button-active" : "neumorph-button",
        intentClasses[intent],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children as React.ReactNode}
    </motion.button>
  );
}
