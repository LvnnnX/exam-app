"use client";

import React from "react";
import { cn } from "@/lib/utils";

type NeumorphButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  intent?: "default" | "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
  loading?: boolean;
  pressed?: boolean;
};

const intentClasses = {
  default: "bg-[#f5f5f5] text-nike-black",
  primary: "bg-nike-black text-white hover:bg-nike-grey-500",
  secondary: "bg-white text-nike-black",
  danger: "bg-nike-red text-white hover:bg-red-600",
};

const sizeClasses = {
  small: "h-9 px-4 text-[12px]",
  medium: "h-10 px-5 text-[13px]",
  large: "h-12 px-6 text-[14px]",
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
    <button
      disabled={disabled || loading}
      aria-pressed={pressed}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium tracking-tight transition-spring-fast active:scale-95 disabled:cursor-not-allowed disabled:bg-black/5 disabled:text-nike-grey-500 disabled:opacity-70",
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
      {children}
    </button>
  );
}
