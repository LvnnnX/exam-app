"use client";

import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

// Kept under its original name so existing imports and `layoutId` morphs keep
// working. It now renders the clay / well recipes from DESIGN.md: one
// `primary` per view, `secondary` for everything beside it.
type NeumorphButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  intent?: "default" | "primary" | "secondary" | "danger" | "danger-soft";
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
  loading?: boolean;
  pressed?: boolean;
  children?: React.ReactNode;
};

const intentClasses = {
  default: "clay text-fg",
  primary: "clay-primary",
  secondary: "well well-hover text-fg disabled:cursor-not-allowed disabled:opacity-50",
  danger: "clay-danger",
  // A trigger that leads to a destructive confirm; only the confirm is clay.
  "danger-soft": "bg-danger/10 text-danger hover:bg-danger/15 disabled:opacity-50",
};

const sizeClasses = {
  small: "h-11 px-4 text-[13px] md:h-9",
  medium: "h-11 px-5 text-[14px]",
  large: "h-12 px-6 text-[15px]",
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
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-calm",
        pressed && intent === "secondary" ? "clay text-fg" : intentClasses[intent],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && <span className="spinner-calm h-4 w-4" aria-hidden="true" />}
      {children as React.ReactNode}
    </motion.button>
  );
}
