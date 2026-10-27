"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Bottom sheet. Portal-rendered so it always sits above the mini player, with
 * body scroll locking and Escape-to-close.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
}: SheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/45 backdrop-blur-[3px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Panel"}
        className={cn(
          "relative mx-auto w-full max-w-[520px] animate-sheet-up rounded-t-[32px] bg-cream shadow-player",
          "max-h-[92dvh] overflow-y-auto overscroll-contain",
          className,
        )}
      >
        <div className="sticky top-0 z-10 bg-cream/95 px-5 pb-3 pt-3 backdrop-blur">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" />
          {title ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-[22px] leading-tight text-ink">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">{subtitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="tap -mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-ink-muted hover:bg-ink/10"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>
          ) : null}
        </div>

        <div className="safe-bottom px-5 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
