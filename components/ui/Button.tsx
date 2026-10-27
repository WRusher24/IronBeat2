"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "dark" | "soft" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-amber text-ink shadow-[0_10px_24px_-14px_rgba(198,125,59,0.9)] hover:bg-amber-soft",
  dark: "bg-ink text-cream hover:bg-ink-soft",
  soft: "bg-ink/[0.06] text-ink hover:bg-ink/[0.09]",
  ghost: "bg-transparent text-ink hover:bg-ink/[0.05]",
  outline: "border border-ink/15 bg-transparent text-ink hover:bg-ink/[0.04]",
  danger: "bg-[#7f2d20] text-cream hover:bg-[#93362a]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-full gap-1.5",
  md: "h-11 px-5 text-sm rounded-full gap-2",
  lg: "h-[52px] px-6 text-[15px] rounded-full gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", fullWidth, className, type, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(
          "inline-flex items-center justify-center font-semibold tracking-[-0.01em] transition-all duration-200",
          "disabled:pointer-events-none disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
          "active:scale-[0.985]",
          VARIANTS[variant],
          SIZES[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      />
    );
  },
);
